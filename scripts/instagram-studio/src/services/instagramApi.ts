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
// Always use the production redirect URI, even when testing locally
const INSTAGRAM_REDIRECT_URI = 'https://studio.lemonpost.studio/auth/callback';

// Auth function URL (on main site)
const AUTH_FUNCTION_URL = import.meta.env.VITE_AUTH_FUNCTION_URL ||
  'https://gabriel-athanasiou.netlify.app/.netlify/functions/instagram-auth';

// Sync function URL (for storing/retrieving credentials)
const SYNC_FUNCTION_URL = import.meta.env.VITE_SYNC_FUNCTION_URL || 
  'https://gabriel-athanasiou.netlify.app/.netlify/functions/instagram-studio-sync';

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
 * Publish a single image post
 */
export async function publishSingleImage(
  imageUrl: string,
  caption: string,
  accessToken: string,
  accountId: string
): Promise<PublishResult> {
  // Create container
  const containerResult = await createImageContainer(imageUrl, caption, accessToken, accountId);
  if (!containerResult.success || !containerResult.containerId) {
    return { success: false, error: containerResult.error };
  }

  // Wait for processing
  const isReady = await waitForMediaReady(containerResult.containerId, accessToken);
  if (!isReady) {
    return { success: false, error: 'Media processing timed out or failed' };
  }

  // Publish
  const publishResult = await publishMedia(containerResult.containerId, accessToken, accountId);
  if (!publishResult.success) {
    return { success: false, error: publishResult.error };
  }

  return { success: true, instagramPostId: publishResult.postId };
}

/**
 * Publish a carousel post (2-10 images)
 */
export async function publishCarousel(
  imageUrls: string[],
  caption: string,
  accessToken: string,
  accountId: string
): Promise<PublishResult> {
  if (imageUrls.length < 2) {
    // Fall back to single image
    return publishSingleImage(imageUrls[0], caption, accessToken, accountId);
  }

  // Limit to 10 images
  const urls = imageUrls.slice(0, 10);

  // Create child containers for each image
  const childIds: string[] = [];
  for (const url of urls) {
    const result = await createCarouselItem(url, accessToken, accountId);
    if (!result.success || !result.containerId) {
      return { success: false, error: `Failed to create carousel item: ${result.error}` };
    }
    childIds.push(result.containerId);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Wait for all items to be ready
  for (const id of childIds) {
    const isReady = await waitForMediaReady(id, accessToken);
    if (!isReady) {
      return { success: false, error: 'Carousel item processing timed out' };
    }
  }

  // Create carousel container
  const containerResult = await createCarouselContainer(childIds, caption, accessToken, accountId);
  if (!containerResult.success || !containerResult.containerId) {
    return { success: false, error: containerResult.error };
  }

  // Wait for carousel to be ready
  const isReady = await waitForMediaReady(containerResult.containerId, accessToken);
  if (!isReady) {
    return { success: false, error: 'Carousel processing timed out' };
  }

  // Publish
  const publishResult = await publishMedia(containerResult.containerId, accessToken, accountId);
  if (!publishResult.success) {
    return { success: false, error: publishResult.error };
  }

  return { success: true, instagramPostId: publishResult.postId };
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
 * Clear rate limit tracking
 */
function clearRateLimitLocally(): void {
  localStorage.removeItem(RATE_LIMIT_KEY);
  localStorage.removeItem(RATE_LIMIT_KEY + '-date');
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
