/**
 * Instagram API Service
 * 
 * Handles all Instagram Graph API interactions including:
 * - OAuth authentication flow
 * - Token management (exchange, refresh)
 * - Content publishing (single image, carousel)
 * - Status checking
 */

import type { 
  InstagramCredentials, 
  InstagramUserResponse,
  PublishResult,
  RateLimitInfo 
} from '../types/instagram';

// Instagram App credentials from environment
// App ID is hardcoded as fallback since it's not secret
const INSTAGRAM_APP_ID = import.meta.env.VITE_INSTAGRAM_APP_ID || '1386961439465356';

// IMPORTANT: For OAuth to work, the redirect_uri must be registered in Meta Dashboard
// Meta does NOT allow localhost URLs - only HTTPS production URLs work
// Use env variable for local ngrok testing, fallback to production for deployed app
const INSTAGRAM_REDIRECT_URI = import.meta.env.VITE_INSTAGRAM_REDIRECT_URI || 
  'https://studio.lemonpost.studio/auth/callback';

// Auth function URL (on main site)
const AUTH_FUNCTION_URL = import.meta.env.VITE_AUTH_FUNCTION_URL ||
  'https://lemonpost.studio/.netlify/functions/instagram-auth';

// Sync function URL (for storing/retrieving credentials)
const SYNC_FUNCTION_URL = import.meta.env.VITE_SYNC_FUNCTION_URL || 
  'https://lemonpost.studio/.netlify/functions/instagram-studio-sync';

// Publish function URL (server-side proxy to avoid CORS)
const PUBLISH_FUNCTION_URL = import.meta.env.VITE_PUBLISH_FUNCTION_URL ||
  'https://studio.lemonpost.studio/.netlify/functions/instagram-publish';

// Local storage keys
const CREDENTIALS_KEY = 'instagram-studio-ig-credentials';
const RATE_LIMIT_KEY = 'instagram-studio-rate-limit';

// Instagram API scopes required for publishing
const SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_messages',
].join(',');

/**
 * Debug function to check OAuth configuration
 */
export function debugOAuthConfig(): void {
  console.log('=== Instagram OAuth Configuration ===');
  console.log('App ID:', INSTAGRAM_APP_ID);
  console.log('Redirect URI:', INSTAGRAM_REDIRECT_URI);
  console.log('Auth Function URL:', AUTH_FUNCTION_URL);
  console.log('');
  console.log('ℹ️  OAuth always uses production redirect URI.');
  console.log('   After auth, you\'ll be redirected to production site.');
  console.log('   The token will be saved and synced via Cloudinary.');
  console.log('=====================================');
}

/**
 * Get the Instagram OAuth authorization URL
 * 
 * IMPORTANT: The redirect_uri MUST exactly match what's configured in:
 * Meta App Dashboard → Instagram → API setup with Instagram login → 
 * Business login settings → OAuth Redirect URIs
 * 
 * Including:
 * - Protocol (https vs http)
 * - Domain
 * - Path
 * - Trailing slash (or lack thereof)
 */
export function getAuthorizationUrl(): string {
  // Debug: Log the redirect URI being used
  console.log('🔐 Instagram OAuth - Using redirect_uri:', INSTAGRAM_REDIRECT_URI);
  console.log('🔐 Instagram OAuth - Using App ID:', INSTAGRAM_APP_ID);
  
  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: INSTAGRAM_REDIRECT_URI,
    scope: SCOPES,
    response_type: 'code',
  });
  
  const authUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  console.log('🔐 Instagram OAuth - Full auth URL:', authUrl);
  
  return authUrl;
}

/**
 * Exchange authorization code for access token
 * This calls our Netlify function which handles the actual token exchange
 */
export async function exchangeCodeForToken(code: string): Promise<{
  success: boolean;
  credentials?: InstagramCredentials;
  error?: string;
}> {
  try {
    const response = await fetch(AUTH_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        action: 'exchange',
        code,
        redirectUri: INSTAGRAM_REDIRECT_URI,
      }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error || 'Token exchange failed');
    }

    // Save credentials locally
    const credentials: InstagramCredentials = {
      connected: true,
      accountId: result.accountId,
      username: result.username,
      accessToken: result.accessToken,
      tokenExpiry: result.tokenExpiry,
      lastRefreshed: new Date().toISOString(),
    };

    saveCredentialsLocally(credentials);

    return { success: true, credentials };
  } catch (error) {
    console.error('Token exchange error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Refresh the access token before it expires
 */
export async function refreshAccessToken(): Promise<{
  success: boolean;
  credentials?: InstagramCredentials;
  error?: string;
}> {
  try {
    const credentials = getCredentialsLocally();
    if (!credentials?.accessToken) {
      throw new Error('No access token to refresh');
    }

    const response = await fetch(AUTH_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        action: 'refresh',
        accessToken: credentials.accessToken,
      }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error || 'Token refresh failed');
    }

    // Update credentials
    const updatedCredentials: InstagramCredentials = {
      ...credentials,
      accessToken: result.accessToken,
      tokenExpiry: result.tokenExpiry,
      lastRefreshed: new Date().toISOString(),
    };

    saveCredentialsLocally(updatedCredentials);

    return { success: true, credentials: updatedCredentials };
  } catch (error) {
    console.error('Token refresh error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Check if token needs refresh (within 7 days of expiry)
 */
export function shouldRefreshToken(credentials: InstagramCredentials): boolean {
  if (!credentials.tokenExpiry) return false;
  
  const expiryDate = new Date(credentials.tokenExpiry);
  const now = new Date();
  const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  
  return daysUntilExpiry < 7;
}

/**
 * Check if token is expired
 */
export function isTokenExpired(credentials: InstagramCredentials): boolean {
  if (!credentials.tokenExpiry) return true;
  
  const expiryDate = new Date(credentials.tokenExpiry);
  return new Date() >= expiryDate;
}

/**
 * Get Instagram user info
 */
export async function getUserInfo(accessToken: string): Promise<InstagramUserResponse | null> {
  try {
    const response = await fetch(
      `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${accessToken}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to get user info');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Get user info error:', error);
    return null;
  }
}

/**
 * Create a single image media container
 */
export async function createImageContainer(
  imageUrl: string,
  caption: string,
  accessToken: string,
  accountId: string
): Promise<{ success: boolean; containerId?: string; error?: string }> {
  try {
    incrementRateLimit();
    
    const response = await fetch(
      `https://graph.instagram.com/v21.0/${accountId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: caption,
          access_token: accessToken,
        }),
      }
    );

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return { success: true, containerId: result.id };
  } catch (error) {
    console.error('Create image container error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Create a carousel item container
 */
export async function createCarouselItem(
  imageUrl: string,
  accessToken: string,
  accountId: string
): Promise<{ success: boolean; containerId?: string; error?: string }> {
  try {
    incrementRateLimit();
    
    const response = await fetch(
      `https://graph.instagram.com/v21.0/${accountId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          is_carousel_item: true,
          access_token: accessToken,
        }),
      }
    );

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return { success: true, containerId: result.id };
  } catch (error) {
    console.error('Create carousel item error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Create a carousel container with multiple images
 */
export async function createCarouselContainer(
  childIds: string[],
  caption: string,
  accessToken: string,
  accountId: string
): Promise<{ success: boolean; containerId?: string; error?: string }> {
  try {
    if (childIds.length < 2 || childIds.length > 10) {
      throw new Error('Carousel must have 2-10 images');
    }

    incrementRateLimit();
    
    const response = await fetch(
      `https://graph.instagram.com/v21.0/${accountId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          children: childIds,
          caption: caption,
          access_token: accessToken,
        }),
      }
    );

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return { success: true, containerId: result.id };
  } catch (error) {
    console.error('Create carousel container error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Publish a media container to Instagram
 */
export async function publishMedia(
  containerId: string,
  accessToken: string,
  accountId: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    incrementRateLimit();
    incrementPostCount();
    
    const response = await fetch(
      `https://graph.instagram.com/v21.0/${accountId}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      }
    );

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return { success: true, postId: result.id };
  } catch (error) {
    console.error('Publish media error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Check media container status
 */
export async function checkMediaStatus(
  containerId: string,
  accessToken: string
): Promise<{ status: string; error?: string }> {
  try {
    incrementRateLimit();
    
    const response = await fetch(
      `https://graph.instagram.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`
    );

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return { status: result.status_code };
  } catch (error) {
    console.error('Check media status error:', error);
    return { 
      status: 'ERROR', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Wait for media container to be ready (status = FINISHED)
 */
export async function waitForMediaReady(
  containerId: string,
  accessToken: string,
  maxAttempts: number = 10,
  delayMs: number = 3000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const { status } = await checkMediaStatus(containerId, accessToken);
    
    if (status === 'FINISHED') {
      return true;
    }
    
    if (status === 'ERROR' || status === 'EXPIRED') {
      return false;
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  return false;
}

/**
 * Format Instagram API error messages to be more user-friendly
 */
function formatInstagramError(error: string): string {
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('rate limit') || lowerError.includes('request limit')) {
    return 'Instagram rate limit reached. Please wait about an hour and try again.';
  }
  if (lowerError.includes('token') && lowerError.includes('expired')) {
    return 'Instagram token expired. Please reconnect in Settings.';
  }
  if (lowerError.includes('invalid') && lowerError.includes('token')) {
    return 'Invalid Instagram token. Please reconnect in Settings.';
  }
  if (lowerError.includes('permission')) {
    return 'Permission denied. Make sure your Instagram account has the required permissions.';
  }
  if (lowerError.includes('not found')) {
    return 'Resource not found. The image may not be accessible.';
  }
  
  return error;
}

/**
 * Publish a single image post (via server-side proxy to avoid CORS)
 */
export async function publishSingleImage(
  imageUrl: string,
  caption: string,
  accessToken: string,
  accountId: string
): Promise<PublishResult> {
  console.log('========================================');
  console.log('📤 PUBLISH SINGLE IMAGE - START');
  console.log('========================================');
  console.log('🔗 Function URL:', PUBLISH_FUNCTION_URL);
  console.log('🖼️ Image URL:', imageUrl);
  console.log('📝 Caption length:', caption?.length || 0);
  console.log('🔑 Token (first 20 chars):', accessToken?.substring(0, 20) + '...');
  console.log('👤 Account ID:', accountId);
  
  if (!imageUrl) {
    console.error('❌ No image URL provided');
    return { success: false, error: 'No image URL provided' };
  }
  
  if (!accessToken) {
    console.error('❌ No access token provided');
    return { success: false, error: 'No access token provided' };
  }
  
  if (!accountId) {
    console.error('❌ No account ID provided');
    return { success: false, error: 'No account ID provided' };
  }
  
  try {
    incrementRateLimit();
    
    const requestBody = {
      action: 'publishSingle',
      accessToken,
      accountId,
      imageUrl,
      caption,
    };
    
    console.log('📦 Request body:', JSON.stringify({ ...requestBody, accessToken: '[HIDDEN]' }, null, 2));
    
    const response = await fetch(PUBLISH_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log('📬 Response status:', response.status);
    console.log('📬 Response ok:', response.ok);

    const result = await response.json();
    
    console.log('📦 Response body:', JSON.stringify(result, null, 2));
    
    if (!response.ok || result.error) {
      const errorMsg = formatInstagramError(result.error || 'Publishing failed');
      console.error('❌ Publish failed:', errorMsg);
      console.log('========================================');
      console.log('📤 PUBLISH SINGLE IMAGE - FAILED');
      console.log('========================================');
      return { success: false, error: errorMsg };
    }

    // Only increment post count after successful publish
    incrementPostCount();
    
    console.log('✅ Published successfully! Post ID:', result.postId);
    console.log('📎 Permalink:', result.permalink);
    console.log('========================================');
    console.log('📤 PUBLISH SINGLE IMAGE - SUCCESS');
    console.log('========================================');
    return { success: true, instagramPostId: result.postId, permalink: result.permalink };
  } catch (error) {
    console.error('❌ Publish exception:', error);
    const errorMsg = formatInstagramError(error instanceof Error ? error.message : 'Unknown error');
    console.log('========================================');
    console.log('📤 PUBLISH SINGLE IMAGE - EXCEPTION');
    console.log('========================================');
    return { success: false, error: errorMsg };
  }
}

/**
 * Verify if a post was actually published (useful after rate limit errors)
 * Calls the server to check recent media on the Instagram account
 */
export async function verifyPublishStatus(
  containerId: string
): Promise<{ verified: boolean; postId?: string; permalink?: string; error?: string; message?: string }> {
  const credentials = getCredentialsLocally();
  if (!credentials?.accessToken || !credentials?.accountId) {
    return { verified: false, error: 'No credentials available' };
  }
  
  try {
    console.log('🔍 Verifying publish status for container:', containerId);
    
    const response = await fetch(PUBLISH_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verifyPublish',
        accessToken: credentials.accessToken,
        accountId: credentials.accountId,
        containerId,
      }),
    });
    
    const result = await response.json();
    console.log('🔍 Verify result:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Error verifying publish status:', error);
    return { verified: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Publish a carousel post (2-10 images, via server-side proxy to avoid CORS)
 * Uses step-by-step approach to avoid Netlify function timeouts
 */
export async function publishCarousel(
  imageUrls: string[],
  caption: string,
  accessToken: string,
  accountId: string
): Promise<PublishResult> {
  console.log('========================================');
  console.log('📤 PUBLISH CAROUSEL - START');
  console.log('========================================');
  console.log('🔗 Function URL:', PUBLISH_FUNCTION_URL);
  console.log('🖼️ Image count:', imageUrls?.length || 0);
  console.log('🖼️ Image URLs:', imageUrls);
  console.log('📝 Caption length:', caption?.length || 0);
  console.log('🔑 Token (first 20 chars):', accessToken?.substring(0, 20) + '...');
  console.log('👤 Account ID:', accountId);
  
  // Fall back to single image if only 1
  if (!imageUrls || imageUrls.length < 2) {
    console.log('⚠️ Less than 2 images, falling back to single image publish');
    if (!imageUrls || imageUrls.length === 0) {
      return { success: false, error: 'No images provided' };
    }
    return publishSingleImage(imageUrls[0], caption, accessToken, accountId);
  }
  
  if (!accessToken) {
    console.error('❌ No access token provided');
    return { success: false, error: 'No access token provided' };
  }
  
  if (!accountId) {
    console.error('❌ No account ID provided');
    return { success: false, error: 'No account ID provided' };
  }

  // Limit to 10 images
  const urls = imageUrls.slice(0, 10);
  
  incrementRateLimit();
  
  console.log(`📤 Creating carousel with ${urls.length} images (step-by-step)...`);
  
  // Step 1: Create each carousel item one at a time
  const childIds: string[] = [];
  
  try {
    for (let i = 0; i < urls.length; i++) {
      console.log(`📸 Creating carousel item ${i + 1}/${urls.length}...`);
      console.log(`   URL: ${urls[i]}`);
      
      const requestBody = {
        action: 'createCarouselItem',
        accessToken,
        accountId,
        imageUrl: urls[i],
      };
      
      const response = await fetch(PUBLISH_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log(`   Response status: ${response.status}`);
      
      const result = await response.json();
      console.log(`   Response body:`, result);
      
      if (!response.ok || result.error) {
        const errorMsg = formatInstagramError(result.error || 'Failed to create carousel item');
        console.error(`❌ Carousel item ${i + 1} failed:`, errorMsg);
        console.log('========================================');
        console.log('📤 PUBLISH CAROUSEL - FAILED AT ITEM CREATION');
        console.log('========================================');
        return { success: false, error: `Failed to create carousel item ${i + 1}: ${errorMsg}` };
      }

      if (!result.containerId) {
        console.error(`❌ Carousel item ${i + 1} - no containerId in response`);
        console.log('========================================');
        console.log('📤 PUBLISH CAROUSEL - FAILED: NO CONTAINER ID');
        console.log('========================================');
        return { success: false, error: `Carousel item ${i + 1}: Server didn't return container ID` };
      }

      childIds.push(result.containerId);
      console.log(`✅ Carousel item ${i + 1} created: ${result.containerId}`);
    }

    console.log('📦 All child IDs:', childIds);

    // Step 2: Create carousel container
    console.log('🎠 Creating carousel container...');
    const containerRequestBody = {
      action: 'createCarouselContainer',
      accessToken,
      accountId,
      childIds,
      caption,
    };
    
    const containerResponse = await fetch(PUBLISH_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerRequestBody),
    });

    console.log(`   Response status: ${containerResponse.status}`);
    
    const containerResult = await containerResponse.json();
    console.log(`   Response body:`, containerResult);
    
    if (!containerResponse.ok || containerResult.error) {
      const errorMsg = formatInstagramError(containerResult.error || 'Failed to create carousel');
      console.error('❌ Carousel container failed:', errorMsg);
      console.log('========================================');
      console.log('📤 PUBLISH CAROUSEL - FAILED AT CONTAINER CREATION');
      console.log('========================================');
      return { success: false, error: errorMsg };
    }

    if (!containerResult.containerId) {
      console.error('❌ Carousel container - no containerId in response');
      console.log('========================================');
      console.log('📤 PUBLISH CAROUSEL - FAILED: NO CAROUSEL CONTAINER ID');
      console.log('========================================');
      return { success: false, error: 'Server didn\'t return carousel container ID' };
    }

    console.log('✅ Carousel container created:', containerResult.containerId);

    // Step 3: Publish the carousel
    console.log('🚀 Publishing carousel...');
    const publishRequestBody = {
      action: 'publishContainer',
      accessToken,
      accountId,
      containerId: containerResult.containerId,
    };
    
    const publishResponse = await fetch(PUBLISH_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publishRequestBody),
    });

    console.log(`   Response status: ${publishResponse.status}`);
    
    const publishResult = await publishResponse.json();
    console.log(`   Response body:`, publishResult);
    
    // Check if it succeeded (including rate limit recovery)
    if (publishResult.success) {
      // Only increment post count after successful publish
      incrementPostCount();
      
      const rateLimitNote = publishResult.rateLimitHit ? ' (recovered from rate limit)' : '';
      console.log(`✅ Carousel published successfully${rateLimitNote}! Post ID:`, publishResult.postId);
      console.log('📎 Permalink:', publishResult.permalink);
      console.log('========================================');
      console.log('📤 PUBLISH CAROUSEL - SUCCESS');
      console.log('========================================');
      return { success: true, instagramPostId: publishResult.postId, permalink: publishResult.permalink };
    }
    
    // If we got a rate limit error, try to verify if the post was actually published
    const errorMsg = publishResult.error || 'Publishing failed';
    const isRateLimit = errorMsg.toLowerCase().includes('rate limit') || 
                        errorMsg.toLowerCase().includes('request limit');
    
    if (isRateLimit) {
      console.log('⚠️ Rate limit error, verifying if post was actually published...');
      const verifyResult = await verifyPublishStatus(containerResult.containerId);
      
      if (verifyResult.verified) {
        incrementPostCount();
        console.log('✅ Post was actually published despite rate limit error!');
        console.log('📎 Permalink:', verifyResult.permalink);
        console.log('========================================');
        console.log('📤 PUBLISH CAROUSEL - SUCCESS (VERIFIED AFTER RATE LIMIT)');
        console.log('========================================');
        return { 
          success: true, 
          instagramPostId: verifyResult.postId, 
          permalink: verifyResult.permalink 
        };
      }
    }
    
    const formattedError = formatInstagramError(errorMsg);
    console.error('❌ Carousel publish failed:', formattedError);
    console.log('========================================');
    console.log('📤 PUBLISH CAROUSEL - FAILED AT PUBLISH');
    console.log('========================================');
    return { success: false, error: formattedError };
  } catch (error) {
    console.error('❌ Carousel publish exception:', error);
    const errorMsg = formatInstagramError(error instanceof Error ? error.message : 'Unknown error');
    console.log('========================================');
    console.log('📤 PUBLISH CAROUSEL - EXCEPTION');
    console.log('========================================');
    return { success: false, error: errorMsg };
  }
}

// ===== Local Storage Functions =====

/**
 * Save credentials to local storage
 */
export function saveCredentialsLocally(credentials: InstagramCredentials): void {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
}

/**
 * Get credentials from local storage
 */
export function getCredentialsLocally(): InstagramCredentials | null {
  const stored = localStorage.getItem(CREDENTIALS_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Clear credentials from local storage
 */
export function clearCredentialsLocally(): void {
  localStorage.removeItem(CREDENTIALS_KEY);
}

/**
 * Disconnect Instagram account
 */
export function disconnectInstagram(): void {
  clearCredentialsLocally();
  clearRateLimitLocally();
}

// ===== Rate Limit Tracking =====

/**
 * Get current rate limit info
 */
export function getRateLimitInfo(): RateLimitInfo {
  const stored = localStorage.getItem(RATE_LIMIT_KEY);
  const defaults: RateLimitInfo = {
    callsRemaining: 200,
    callsLimit: 200,
    resetTime: null,
    postsToday: 0,
    postsLimit: 25,
  };

  if (!stored) return defaults;

  try {
    const info = JSON.parse(stored) as RateLimitInfo;
    
    // Reset if it's a new hour
    if (info.resetTime) {
      const resetDate = new Date(info.resetTime);
      if (new Date() >= resetDate) {
        info.callsRemaining = info.callsLimit;
        info.resetTime = null;
      }
    }
    
    // Reset posts count if it's a new day
    const lastUpdate = localStorage.getItem(RATE_LIMIT_KEY + '-date');
    const today = new Date().toDateString();
    if (lastUpdate !== today) {
      info.postsToday = 0;
      localStorage.setItem(RATE_LIMIT_KEY + '-date', today);
    }
    
    return info;
  } catch {
    return defaults;
  }
}

/**
 * Increment API call count
 */
function incrementRateLimit(): void {
  const info = getRateLimitInfo();
  
  info.callsRemaining = Math.max(0, info.callsRemaining - 1);
  
  // Set reset time if not set
  if (!info.resetTime) {
    const resetTime = new Date();
    resetTime.setHours(resetTime.getHours() + 1);
    info.resetTime = resetTime.toISOString();
  }
  
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(info));
}

/**
 * Increment daily post count
 */
function incrementPostCount(): void {
  const info = getRateLimitInfo();
  info.postsToday = Math.min(info.postsLimit, info.postsToday + 1);
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(info));
  localStorage.setItem(RATE_LIMIT_KEY + '-date', new Date().toDateString());
}

/**
 * Clear rate limit tracking (exported for manual reset)
 */
export function clearRateLimitLocally(): void {
  localStorage.removeItem(RATE_LIMIT_KEY);
  localStorage.removeItem(RATE_LIMIT_KEY + '-date');
}

/**
 * Reset daily post count (useful after testing or errors)
 */
export function resetDailyPostCount(): void {
  const info = getRateLimitInfo();
  info.postsToday = 0;
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(info));
  console.log('✅ Daily post count reset to 0');
}

/**
 * Check if we can make more API calls
 */
export function canMakeApiCall(): boolean {
  const info = getRateLimitInfo();
  return info.callsRemaining > 0;
}

/**
 * Check if we can publish more posts today
 */
export function canPublishPost(): boolean {
  const info = getRateLimitInfo();
  return info.postsToday < info.postsLimit;
}
