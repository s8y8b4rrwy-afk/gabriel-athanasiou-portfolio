/**
 * Instagram Studio Shared Library
 * 
 * Single source of truth for:
 * - Constants (API URLs, Cloudinary config, timing)
 * - Cloudinary operations (fetch, upload, merge)
 * - Instagram Graph API (publish single, carousel)
 * - Email notifications (via Resend)
 * - Utility functions (hashtag validation, caption building)
 * 
 * @see REFACTORING_PLAN.md for architecture decisions
 */

import crypto from 'crypto';

// ============================================
// CONSTANTS
// ============================================

// Instagram Graph API
export const GRAPH_API_BASE = 'https://graph.instagram.com';
export const GRAPH_API_VERSION = 'v21.0';

// Cloudinary
export const CLOUDINARY_CLOUD = 'date24ay6';
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Default timing (can be overridden via options)
export const DEFAULT_MAX_WAIT = 60000;  // 60 seconds
export const DEFAULT_POLL_INTERVAL = 2000;  // 2 seconds
export const MAX_RETRIES = 3;  // For status check retries

/**
 * Fetch schedule data from Cloudinary
 */
export async function fetchScheduleData() {
  const url = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/raw/upload/instagram-studio/schedule-data?t=${Date.now()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch schedule data: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('❌ Error fetching schedule data:', error.message);
    return null;
  }
}

/**
 * Upload data to Cloudinary as a raw resource
 */
export async function uploadToCloudinary(data) {
  if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary credentials not configured');
  }

  data.lastUpdated = new Date().toISOString();
  data.lastMergedAt = new Date().toISOString();

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = 'instagram-studio/schedule-data';

  // Cloudinary requires ALL parameters to be included in signature (alphabetically sorted)
  const signatureString = `overwrite=true&public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

  const formData = new URLSearchParams();
  formData.append(
    'file',
    `data:application/json;base64,${Buffer.from(JSON.stringify(data, null, 2)).toString('base64')}`
  );
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', CLOUDINARY_API_KEY);
  formData.append('signature', signature);
  formData.append('resource_type', 'raw');
  formData.append('overwrite', 'true');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/raw/upload`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetails = errorText;
    try {
      const firstLine = errorText.split('\n')[0];
      errorDetails = `${response.status} ${response.statusText} - ${firstLine.substring(0, 500)}`;
    } catch (e) {}
    
    console.error('❌ Cloudinary upload failed:', errorDetails);
    throw new Error(`Failed to save to Cloudinary: ${errorDetails}`);
  }

  const result = await response.json();
  console.log('✅ Cloudinary upload successful:', { publicId, url: result.secure_url?.substring(0, 100) });
  return result;
}

/**
 * Update the status of a specific schedule slot
 */
export async function updateScheduleStatus(slotId, status, mediaIdOrError) {
  if (!slotId || slotId === 'direct-publish') return;

  const update = { status };
  if (status === 'published') {
    update.publishedAt = new Date().toISOString();
    update.instagramMediaId = mediaIdOrError;
  } else if (status === 'failed') {
    update.error = mediaIdOrError;
  }

  const statusUpdates = new Map([[slotId, update]]);
  return await saveWithSmartMerge(statusUpdates);
}

/**
 * Save status updates with smart merge and retry logic
 */
export async function saveWithSmartMerge(statusUpdates) {
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`💾 Saving status updates (attempt ${attempt}/${maxRetries})...`);
      
      const freshData = await fetchScheduleData();
      if (!freshData) {
        throw new Error('Cannot save: failed to fetch fresh data for merge');
      }

      let updatedCount = 0;
      for (const slot of freshData.scheduleSlots || []) {
        const update = statusUpdates.get(slot.id);
        if (update) {
          slot.status = update.status;
          if (update.publishedAt) slot.publishedAt = update.publishedAt;
          if (update.instagramMediaId) slot.instagramMediaId = update.instagramMediaId;
          if (update.error) slot.error = update.error;
          slot.updatedAt = new Date().toISOString();
          updatedCount++;
          console.log(`  ✓ Applied status update to slot ${slot.id}: ${update.status}`);
        }
      }

      console.log(`🔄 Smart merge: Applied ${updatedCount} status updates`);
      await uploadToCloudinary(freshData);
      console.log('💾 Status updates saved successfully');
      return true;
    } catch (error) {
      lastError = error;
      console.error(`❌ Save attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        const waitMs = Math.pow(2, attempt) * 1000; // 2s, 4s
        console.log(`⏳ Waiting ${waitMs}ms before retry...`);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  }

  throw lastError;
}

// ============================================
// IMAGE MODE & ASPECT RATIO HELPERS
// ============================================

/**
 * Instagram aspect ratio constants
 * Instagram accepts: 4:5 (0.8) to 1.91:1 (1.91)
 */
const INSTAGRAM_ASPECT_RATIOS = {
  PORTRAIT_4_5: '0.8',       // 4:5 as decimal
  LANDSCAPE_191_100: '1.91', // 1.91:1 as decimal
};

/**
 * Fetch image dimensions from Cloudinary via their API
 * Uses fl_getinfo to get dimensions without downloading the full image
 * 
 * @param {string} projectId - Project record ID
 * @param {number} imageIndex - Image index in the project gallery
 * @returns {Promise<{width: number, height: number} | null>}
 */
async function getImageDimensions(projectId, imageIndex) {
  try {
    // Use Cloudinary's fl_getinfo to get dimensions without downloading full image
    const publicId = `portfolio-projects-${projectId}-${imageIndex}`;
    const infoUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/fl_getinfo/${publicId}.jpg`;
    
    const response = await fetch(infoUrl);
    if (!response.ok) {
      console.warn(`Failed to get dimensions for ${publicId}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (data.input && data.input.width && data.input.height) {
      return { width: data.input.width, height: data.input.height };
    }
    
    return null;
  } catch (error) {
    console.warn(`Error getting image dimensions: ${error.message}`);
    return null;
  }
}

/**
 * Build Cloudinary URL for Instagram carousel with consistent aspect ratio
 * 
 * @param {string} projectId - Project ID
 * @param {number} imageIndex - Image index
 * @param {string} aspectRatio - Target aspect ratio (e.g., "0.8", "1.91")
 * @param {'lfill' | 'pad'} cropMode - 'lfill' = fill and crop (no bars), 'pad' = letterbox (preserve full image)
 * @returns {string} Cloudinary URL
 */
function buildCloudinaryUrlForCarousel(projectId, imageIndex, aspectRatio, cropMode) {
  const publicId = `portfolio-projects-${projectId}-${imageIndex}`;
  
  // Build transformation based on crop mode
  let transforms;
  if (cropMode === 'pad') {
    // FIT mode: letterbox with black bars, preserve full image
    transforms = [
      `ar_${aspectRatio}`,
      'c_pad',
      'b_black',
      'g_center',
      'q_95',
      'f_jpg'
    ].join(',');
  } else {
    // FILL mode: crop to fill, no letterbox bars
    transforms = [
      `ar_${aspectRatio}`,
      'c_lfill',
      'b_black',
      'g_center',
      'q_95',
      'f_jpg'
    ].join(',');
  }
  
  // Chain width limit transformation
  const widthLimit = 'w_1440,c_limit';
  
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/${transforms}/${widthLimit}/${publicId}.jpg`;
}

/**
 * Generate Instagram-ready URLs from Cloudinary portfolio IDs
 * Supports imageMode for fill (crop) vs fit (letterbox) behavior
 * 
 * @param {string[]} imageUrls - Original image URLs
 * @param {string} projectId - Project record ID
 * @param {'fill' | 'fit'} imageMode - 'fill' = crop to fill, 'fit' = letterbox (preserve full image)
 * @returns {Promise<string[]>} Instagram-optimized Cloudinary URLs
 */
export async function getInstagramUrls(imageUrls, projectId, imageMode = 'fill') {
  console.log(`📐 getInstagramUrls called with imageMode: ${imageMode}`);
  
  // First pass: Get dimensions for all images and determine their categories
  const imageData = [];
  let landscapeCount = 0;
  let portraitCount = 0;
  let normalCount = 0;
  
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    
    // Find the actual image index from the URL
    let imageIndex = i;
    if (url.includes('res.cloudinary.com')) {
      const match = url.match(/portfolio-projects-[^-]+-([\d]+)/);
      if (match) {
        imageIndex = parseInt(match[1], 10);
      }
    }
    
    // Get dimensions from Cloudinary
    const dimensions = await getImageDimensions(projectId, imageIndex);
    imageData.push({ url, imageIndex, dimensions });
    
    if (dimensions) {
      const ratio = dimensions.width / dimensions.height;
      // Categorize: landscape (>1.0), portrait (<0.8), or normal (0.8-1.0)
      if (ratio > 1.0) {
        landscapeCount++;
      } else if (ratio < 0.8) {
        portraitCount++;
      } else {
        normalCount++;
      }
    }
  }
  
  // Determine majority orientation
  const isLandscapeMajority = landscapeCount >= portraitCount && landscapeCount >= normalCount;
  
  // Choose target aspect ratio based on majority
  const targetAspectRatio = isLandscapeMajority
    ? INSTAGRAM_ASPECT_RATIOS.LANDSCAPE_191_100
    : INSTAGRAM_ASPECT_RATIOS.PORTRAIT_4_5;
  
  console.log(`📊 Orientation analysis: ${landscapeCount}L, ${portraitCount}P, ${normalCount}N → ${isLandscapeMajority ? 'Landscape' : 'Portrait'} majority`);
  
  // FILL MODE: Crop to fill (no letterbox), respecting majority orientation
  if (imageMode === 'fill') {
    console.log(`📐 FILL mode: Cropping to ${targetAspectRatio} with c_lfill`);
    
    return imageData.map(({ imageIndex }) => {
      return buildCloudinaryUrlForCarousel(projectId, imageIndex, targetAspectRatio, 'lfill');
    });
  }
  
  // FIT MODE: Preserve full images with letterbox bars
  console.log(`📐 FIT mode: Padding to ${targetAspectRatio} with c_pad`);
  
  return imageData.map(({ imageIndex, dimensions }, i) => {
    console.log(
      `📐 Image ${i + 1}/${imageUrls.length} (index ${imageIndex}): ${dimensions ? `${dimensions.width}x${dimensions.height}` : 'unknown'} → ${targetAspectRatio} c_pad`
    );
    return buildCloudinaryUrlForCarousel(projectId, imageIndex, targetAspectRatio, 'pad');
  });
}

/**
 * Publish a post (single or carousel) to Instagram
 * Auto-detects based on number of images
 * @param {Object} post - { imageUrls: string[], caption: string }
 * @param {string} accessToken - Instagram access token
 * @param {string} accountId - Instagram account ID
 * @param {Object} options - { maxWait?: number, pollInterval?: number }
 * @returns {Promise<{success: boolean, postId?: string, mediaId?: string, permalink?: string, error?: string}>}
 */
export async function publishPost(post, accessToken, accountId, options = {}) {
  const { imageUrls, caption } = post;
  const { maxWait = DEFAULT_MAX_WAIT, pollInterval = DEFAULT_POLL_INTERVAL } = options;

  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('No images to publish');
  }

  if (imageUrls.length === 1) {
    return await publishSingleImage(imageUrls[0], caption, accessToken, accountId, { maxWait, pollInterval });
  } else {
    return await publishCarousel(imageUrls, caption, accessToken, accountId, { maxWait, pollInterval });
  }
}

/**
 * Publish a single image post
 * @param {string} imageUrl - Image URL
 * @param {string} caption - Post caption
 * @param {string} accessToken - Instagram access token
 * @param {string} accountId - Instagram account ID
 * @param {Object} options - { maxWait?: number, pollInterval?: number }
 * @returns {Promise<{success: boolean, postId?: string, mediaId?: string, permalink?: string, error?: string}>}
 */
export async function publishSingleImage(imageUrl, caption, accessToken, accountId, options = {}) {
  console.log('📸 Creating single image container...');
  
  const containerResponse = await fetch(
    `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption,
        access_token: accessToken,
      }),
    }
  );

  const containerData = await containerResponse.json();
  if (containerData.error) {
    const errorDetail = containerData.error.error_user_msg || containerData.error.message || 'Unknown error';
    throw new Error(errorDetail);
  }

  const containerId = containerData.id;
  console.log('✅ Container created:', containerId);

  // Wait for processing
  const ready = await waitForMediaReady(containerId, accessToken, options);
  if (!ready.success) {
    throw new Error(ready.error || 'Media processing failed');
  }

  // Publish with rate limit detection
  const publishResult = await publishMediaContainer(containerId, accessToken, accountId);
  
  if (!publishResult.success) {
    throw new Error(publishResult.error || 'Publish failed');
  }

  return { 
    success: true,
    mediaId: publishResult.postId, 
    postId: publishResult.postId,
    permalink: publishResult.permalink,
    rateLimitHit: publishResult.rateLimitHit
  };
}

/**
 * Publish a carousel post (2-10 images)
 * @param {string[]} imageUrls - Array of image URLs
 * @param {string} caption - Post caption
 * @param {string} accessToken - Instagram access token
 * @param {string} accountId - Instagram account ID
 * @param {Object} options - { maxWait?: number, pollInterval?: number }
 * @returns {Promise<{success: boolean, postId?: string, mediaId?: string, permalink?: string, error?: string}>}
 */
export async function publishCarousel(imageUrls, caption, accessToken, accountId, options = {}) {
  if (imageUrls.length < 2) {
    throw new Error('Carousel requires at least 2 images');
  }
  if (imageUrls.length > 10) {
    throw new Error('Carousel cannot have more than 10 images');
  }

  console.log(`📸 Creating carousel with ${imageUrls.length} images...`);
  const childIds = [];

  // Step 1: Create child containers for each image
  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    console.log(`Creating carousel item ${i + 1}/${imageUrls.length}...`);
    
    const childResponse = await fetch(
      `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          is_carousel_item: true,
          access_token: accessToken,
        }),
      }
    );

    const childData = await childResponse.json();
    if (childData.error) {
      throw new Error(`Failed to create carousel item ${i + 1}: ${childData.error.message}`);
    }

    childIds.push(childData.id);
    console.log(`✅ Carousel item ${i + 1} created:`, childData.id);

    // Wait for each item to be processed
    const ready = await waitForMediaReady(childData.id, accessToken, options);
    if (!ready.success) {
      throw new Error(`Carousel item ${i + 1} processing failed: ${ready.error}`);
    }
  }

  // Step 2: Create carousel container
  console.log('Creating carousel container with children:', childIds);
  
  const containerResponse = await fetch(
    `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: childIds,
        caption: caption,
        access_token: accessToken,
      }),
    }
  );

  const containerData = await containerResponse.json();
  if (containerData.error) {
    throw new Error(containerData.error.message);
  }

  const containerId = containerData.id;
  console.log('✅ Carousel container created:', containerId);

  // Step 3: Wait for carousel processing
  const ready = await waitForMediaReady(containerId, accessToken, options);
  if (!ready.success) {
    throw new Error(ready.error || 'Carousel processing failed');
  }

  // Step 4: Publish with rate limit detection
  const publishResult = await publishMediaContainer(containerId, accessToken, accountId);
  
  if (!publishResult.success) {
    throw new Error(publishResult.error || 'Publish failed');
  }

  return { 
    success: true,
    mediaId: publishResult.postId, 
    postId: publishResult.postId,
    permalink: publishResult.permalink,
    rateLimitHit: publishResult.rateLimitHit
  };
}

/**
 * Check media container status (single check, no polling)
 * Use this for client-side polling or one-shot status checks
 * @param {string} containerId - Media container ID
 * @param {string} accessToken - Instagram access token
 * @returns {Promise<{success: boolean, status?: string, error?: string}>}
 */
export async function checkMediaStatus(containerId, accessToken) {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${containerId}?fields=status_code&access_token=${accessToken}`
    );

    const result = await response.json();
    
    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, status: result.status_code };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Wait for Instagram media container to be ready
 * Includes retry logic for transient "Unsupported get request" errors
 * @param {string} mediaId - Media container ID
 * @param {string} accessToken - Instagram access token
 * @param {Object} options - { maxWait?: number, pollInterval?: number }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function waitForMediaReady(mediaId, accessToken, options = {}) {
  const { maxWait = DEFAULT_MAX_WAIT, pollInterval = DEFAULT_POLL_INTERVAL } = options;
  const startTime = Date.now();
  let retryCount = 0;

  while (Date.now() - startTime < maxWait) {
    const response = await fetch(
      `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${mediaId}?fields=status_code&access_token=${accessToken}`
    );

    const data = await response.json();
    
    if (data.error) {
      // Handle "Unsupported get request" - this can happen temporarily
      // Retry a few times before failing
      if (data.error.message?.includes('Unsupported get request') && retryCount < MAX_RETRIES) {
        console.log(`⚠️ Got "Unsupported get request" for ${mediaId}, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, pollInterval * 2));
        continue;
      }
      return { success: false, error: data.error.message };
    }
    
    // Reset retry count on successful response
    retryCount = 0;

    const status = data.status_code;
    console.log(`Container ${mediaId} status: ${status}`);

    if (status === 'FINISHED') {
      return { success: true };
    }

    if (status === 'ERROR' || status === 'EXPIRED') {
      return { success: false, error: `Container status: ${status}` };
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return { success: false, error: 'Media processing timeout' };
}

/**
 * Verify if a container was successfully published by checking recent media
 * Useful when publish call returns error but post might have succeeded (rate limit)
 * @param {string} containerId - Container ID
 * @param {string} accessToken - Instagram access token
 * @param {string} accountId - Instagram account ID
 * @returns {Promise<{verified: boolean, postId?: string, permalink?: string, error?: string}>}
 */
export async function verifyPublishStatus(containerId, accessToken, accountId) {
  try {
    // First, try to get the container status
    const containerResponse = await fetch(
      `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${containerId}?fields=id,status_code&access_token=${accessToken}`
    );
    const containerResult = await containerResponse.json();
    
    // If we can't access the container (might be consumed after publish), check recent media
    if (containerResult.error) {
      console.log('Container not accessible, checking recent media...');
    }
    
    // Check recent media from the account to see if our content was published
    const mediaResponse = await fetch(
      `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media?fields=id,timestamp,permalink&limit=5&access_token=${accessToken}`
    );
    const mediaResult = await mediaResponse.json();
    
    if (mediaResult.error) {
      console.log('Could not verify publish status:', mediaResult.error.message);
      return { verified: false, error: mediaResult.error.message };
    }
    
    // Check if there's a recent post (within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentPosts = (mediaResult.data || []).filter(post => {
      const postTime = new Date(post.timestamp);
      return postTime > fiveMinutesAgo;
    });
    
    if (recentPosts.length > 0) {
      console.log('✅ Found recent post that may be ours:', recentPosts[0].id);
      return { 
        verified: true, 
        postId: recentPosts[0].id, 
        permalink: recentPosts[0].permalink,
        message: 'Post appears to have been published successfully'
      };
    }
    
    return { verified: false, message: 'Could not find recently published post' };
  } catch (error) {
    console.error('Error verifying publish status:', error);
    return { verified: false, error: error.message };
  }
}

/**
 * Publish a media container to Instagram
 * Includes rate limit detection with verification fallback
 * @param {string} containerId - Container ID to publish
 * @param {string} accessToken - Instagram access token
 * @param {string} accountId - Instagram account ID
 * @returns {Promise<{success: boolean, postId?: string, permalink?: string, error?: string, rateLimitHit?: boolean}>}
 */
export async function publishMediaContainer(containerId, accessToken, accountId) {
  const response = await fetch(
    `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    }
  );

  const result = await response.json();
  
  if (result.error) {
    // If we hit a rate limit, the post might still have succeeded
    // Try to verify by checking recent media
    const isRateLimit = result.error.message?.toLowerCase().includes('rate limit') ||
                        result.error.message?.toLowerCase().includes('request limit') ||
                        result.error.code === 4 || // OAuthException rate limit
                        result.error.code === 32;  // Rate limit error code
    
    if (isRateLimit) {
      console.log('⚠️ Rate limit error during publish, verifying status...');
      const verification = await verifyPublishStatus(containerId, accessToken, accountId);
      
      if (verification.verified) {
        console.log('✅ Post was actually published despite rate limit error!');
        return { 
          success: true, 
          postId: verification.postId, 
          permalink: verification.permalink,
          rateLimitHit: true 
        };
      }
    }
    
    return { success: false, error: result.error.message };
  }

  const postId = result.id;
  console.log('✅ Published! Post ID:', postId);

  // Fetch the permalink for the published post
  let permalink = null;
  try {
    const mediaResponse = await fetch(
      `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${postId}?fields=permalink&access_token=${accessToken}`
    );
    const mediaResult = await mediaResponse.json();
    if (mediaResult.permalink) {
      permalink = mediaResult.permalink;
      console.log('📎 Permalink:', permalink);
    }
  } catch (err) {
    console.warn('Could not fetch permalink:', err.message);
  }

  return { success: true, postId, permalink };
}

/**
 * Send notification email via Resend
 */
export async function sendNotification(results, scheduleData, options = {}) {
  const { 
    type = 'Scheduled', 
    saveSuccess = true, 
    saveError = null 
  } = options;
  
  const resendApiKey = process.env.RESEND_API_KEY;
  const notificationEmail = process.env.NOTIFICATION_EMAIL;

  if (!resendApiKey || !notificationEmail) {
    console.log('📧 Notification skipped: RESEND_API_KEY or NOTIFICATION_EMAIL not configured');
    return;
  }

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  const subject =
    failed.length > 0
      ? `⚠️ Instagram ${type} Publish: ${successful.length} published, ${failed.length} failed`
      : `✅ Instagram ${type} Publish: ${successful.length} post(s) published`;

  let html = `<h2>Instagram ${type} Publish Report</h2>`;
  html += `<p>Time: ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>`;

  if (!saveSuccess) {
    html += `<div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px; margin: 16px 0;">`;
    html += `<p style="margin: 0; color: #856404;"><strong>⚠️ Status Update Warning</strong></p>`;
    html += `<p style="margin: 8px 0 0 0; color: #856404; font-size: 14px;">Posts were published but status updates could not be saved to the schedule. Error: ${saveError?.message || 'Unknown error'}</p>`;
    html += `</div>`;
  }

  if (successful.length > 0) {
    html += `<h3>✅ Successfully Published (${successful.length})</h3><ul>`;
    for (const r of successful) {
      const post = (scheduleData.scheduleSlots || []).find((p) => p.id === r.postId);
      html += `<li><strong>${post?.projectId || r.projectId || r.postId}</strong> - Media ID: ${r.mediaId}</li>`;
    }
    html += `</ul>`;
  }

  if (failed.length > 0) {
    html += `<h3>❌ Failed (${failed.length})</h3><ul>`;
    for (const r of failed) {
      const post = (scheduleData.scheduleSlots || []).find((p) => p.id === r.postId);
      html += `<li><strong>${post?.projectId || r.projectId || r.postId}</strong> - Error: ${r.error}</li>`;
    }
    html += `</ul>`;
  }

  html += `<p><a href="https://studio.lemonpost.studio">Open Instagram Studio →</a></p>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Instagram Studio <noreply@lemonpost.studio>',
        to: [notificationEmail],
        subject: subject,
        html: html,
      }),
    });

    if (response.ok) {
      console.log('📧 Notification email sent successfully');
    } else {
      const error = await response.text();
      console.error('📧 Failed to send notification:', error);
    }
  } catch (error) {
    console.error('📧 Notification error:', error.message);
  }
}

// ============================================
// UTILITIES
// ============================================

/**
 * Validate hashtag count in caption
 * Instagram allows maximum 30 hashtags per post
 * @param {string} caption - Caption to validate
 * @returns {{valid: boolean, count: number, error?: string}}
 */
export function validateHashtags(caption) {
  const hashtagCount = (caption?.match(/#\w+/g) || []).length;
  if (hashtagCount > 30) {
    return { 
      valid: false, 
      count: hashtagCount, 
      error: `Too many hashtags (${hashtagCount}). Instagram allows maximum 30.` 
    };
  }
  return { valid: true, count: hashtagCount };
}

/**
 * Build full caption with hashtags
 * Trims to 30 hashtags if more are provided
 * @param {string} caption - Base caption
 * @param {string[]} hashtags - Array of hashtags (without # prefix is fine)
 * @returns {string} Full caption with hashtags
 */
export function buildCaption(caption, hashtags = []) {
  let tags = hashtags.map(tag => tag.startsWith('#') ? tag : `#${tag}`);
  
  if (tags.length > 30) {
    console.log(`⚠️ Trimming hashtags from ${tags.length} to 30`);
    tags = tags.slice(0, 30);
  }
  
  return tags.length > 0 ? `${caption}\n\n${tags.join(' ')}` : caption;
}

/**
 * Create a media container on Instagram (low-level function)
 * Used for step-by-step carousel creation
 * @param {string} imageUrl - Image URL
 * @param {string|null} caption - Caption (null for carousel items)
 * @param {string} accessToken - Instagram access token
 * @param {string} accountId - Instagram account ID
 * @param {boolean} isCarouselItem - Whether this is a carousel item
 * @returns {Promise<{id: string}>} Container ID
 */
export async function createMediaContainer(imageUrl, caption, accessToken, accountId, isCarouselItem = false) {
  const body = {
    image_url: imageUrl,
    access_token: accessToken,
  };
  
  if (isCarouselItem) {
    body.is_carousel_item = true;
  } else if (caption) {
    body.caption = caption;
  }

  const response = await fetch(
    `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  const result = await response.json();
  
  if (result.error) {
    const errorDetail = result.error.error_user_msg || result.error.message || 'Unknown error';
    throw new Error(errorDetail);
  }

  return { id: result.id };
}

/**
 * Create a carousel container from child media IDs
 * @param {string[]} childIds - Array of child media container IDs
 * @param {string} caption - Carousel caption
 * @param {string} accessToken - Instagram access token
 * @param {string} accountId - Instagram account ID
 * @returns {Promise<{id: string}>} Container ID
 */
export async function createCarouselContainer(childIds, caption, accessToken, accountId) {
  const response = await fetch(
    `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  return { id: result.id };
}
