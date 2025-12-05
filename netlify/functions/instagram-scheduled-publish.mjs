/**
 * Instagram Scheduled Publish - Netlify Scheduled Function
 * 
 * Runs every hour to check for scheduled posts that are due
 * and publishes them automatically.
 * 
 * Posts are considered "due" if their scheduled time is within the last hour
 * (giving a 1-hour window to catch any posts that should have been published).
 * 
 * Schedule: Every hour at minute 0
 * 
 * Notifications: Sends email via Resend when posts are published or fail
 */

import crypto from 'crypto';

const GRAPH_API_BASE = 'https://graph.instagram.com';
const GRAPH_API_VERSION = 'v21.0';
const CLOUDINARY_CLOUD = 'date24ay6';
const CLOUDINARY_API_KEY = '889494878498498';

// Maximum wait time for media processing
const MAX_PROCESSING_WAIT = 30000;
const POLL_INTERVAL = 2000;

// Window for catching scheduled posts (1 hour in milliseconds)
const SCHEDULE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Netlify scheduled function config
export const config = {
  schedule: '0 * * * *', // Every hour at minute 0
};

/**
 * Send notification email about publish results
 * Uses Resend API (set RESEND_API_KEY and NOTIFICATION_EMAIL in env)
 */
async function sendNotification(results, scheduleData) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const notificationEmail = process.env.NOTIFICATION_EMAIL;
  
  if (!resendApiKey || !notificationEmail) {
    console.log('📧 Notification skipped: RESEND_API_KEY or NOTIFICATION_EMAIL not configured');
    return;
  }
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  const subject = failed.length > 0 
    ? `⚠️ Instagram: ${successful.length} published, ${failed.length} failed`
    : `✅ Instagram: ${successful.length} post(s) published`;
  
  // Build HTML email
  let html = `<h2>Instagram Scheduled Publish Report</h2>`;
  html += `<p>Time: ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>`;
  
  if (successful.length > 0) {
    html += `<h3>✅ Successfully Published (${successful.length})</h3><ul>`;
    for (const r of successful) {
      const post = (scheduleData.schedules || []).find(p => p.id === r.postId);
      html += `<li><strong>${post?.projectId || r.postId}</strong> - Media ID: ${r.mediaId}</li>`;
    }
    html += `</ul>`;
  }
  
  if (failed.length > 0) {
    html += `<h3>❌ Failed (${failed.length})</h3><ul>`;
    for (const r of failed) {
      const post = (scheduleData.schedules || []).find(p => p.id === r.postId);
      html += `<li><strong>${post?.projectId || r.postId}</strong> - Error: ${r.error}</li>`;
    }
    html += `</ul>`;
  }
  
  html += `<p><a href="https://studio.lemonpost.studio">Open Instagram Studio →</a></p>`;
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
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

export const handler = async (event) => {
  console.log('⏰ Scheduled publish check started at:', new Date().toISOString());
  
  try {
    // 1. Fetch schedule data from Cloudinary
    const scheduleData = await fetchScheduleData();
    
    if (!scheduleData) {
      console.log('📭 No schedule data found');
      return { statusCode: 200, body: JSON.stringify({ message: 'No schedule data' }) };
    }
    
    // 2. Check Instagram connection
    if (!scheduleData.instagram?.connected || !scheduleData.instagram?.accessToken) {
      console.log('🔌 Instagram not connected');
      return { statusCode: 200, body: JSON.stringify({ message: 'Instagram not connected' }) };
    }
    
    const { accessToken, accountId } = scheduleData.instagram;
    
    // 3. Find posts that are due (scheduled time within the last hour, status = 'pending')
    // Data structure: scheduleSlots links to drafts via postDraftId
    // scheduleSlot: { id, postDraftId, scheduledDate, scheduledTime, status }
    // draft: { id, projectId, caption, hashtags, selectedImages }
    const now = new Date();
    const windowStart = new Date(now.getTime() - SCHEDULE_WINDOW_MS);
    
    const draftsMap = new Map((scheduleData.drafts || []).map(d => [d.id, d]));
    
    const duePosts = (scheduleData.scheduleSlots || []).filter(slot => {
      if (slot.status !== 'pending') return false;
      
      // Combine date and time into a proper datetime
      const scheduledDateTime = new Date(`${slot.scheduledDate}T${slot.scheduledTime}:00`);
      
      // Post is due if scheduled time is between (now - 1 hour) and now
      return scheduledDateTime <= now && scheduledDateTime >= windowStart;
    }).map(slot => {
      const draft = draftsMap.get(slot.postDraftId);
      return { slot, draft };
    }).filter(({ draft }) => draft !== undefined);
    
    if (duePosts.length === 0) {
      console.log('📭 No posts due for publishing');
      return { statusCode: 200, body: JSON.stringify({ message: 'No posts due' }) };
    }
    
    console.log(`📬 Found ${duePosts.length} post(s) to publish`);
    
    // 4. Publish each due post
    const results = [];
    for (const { slot, draft } of duePosts) {
      try {
        console.log(`📤 Publishing post: ${draft.projectId}`);
        
        // Build full caption with hashtags
        const fullCaption = draft.hashtags?.length > 0 
          ? `${draft.caption}\n\n${draft.hashtags.join(' ')}`
          : draft.caption;
        
        // Get Cloudinary URLs for images (convert from Airtable URLs if needed)
        const imageUrls = await getInstagramUrls(draft.selectedImages, draft.projectId);
        
        const result = await publishPost({ imageUrls, caption: fullCaption }, accessToken, accountId);
        
        // Update slot status
        slot.status = 'published';
        slot.publishedAt = new Date().toISOString();
        slot.instagramMediaId = result.mediaId;
        
        results.push({ postId: slot.id, projectId: draft.projectId, success: true, mediaId: result.mediaId });
        console.log(`✅ Published: ${draft.projectId}`);
      } catch (error) {
        console.error(`❌ Failed to publish ${draft.projectId}:`, error.message);
        slot.status = 'failed';
        slot.error = error.message;
        results.push({ postId: slot.id, projectId: draft.projectId, success: false, error: error.message });
      }
    }
    
    // 5. Save updated schedule data back to Cloudinary
    await saveScheduleData(scheduleData);
    
    // 6. Send notification email
    await sendNotification(results, scheduleData);
    
    console.log('✅ Scheduled publish complete:', results);
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Scheduled publish complete',
        results 
      }),
    };
  } catch (error) {
    console.error('❌ Scheduled publish error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

/**
 * Fetch schedule data from Cloudinary
 */
async function fetchScheduleData() {
  // Note: The file is stored without .json extension
  const url = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/raw/upload/instagram-studio/schedule-data?t=${Date.now()}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching schedule data:', error);
    return null;
  }
}

/**
 * Save schedule data to Cloudinary using signed upload
 */
async function saveScheduleData(data) {
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiSecret) {
    throw new Error('CLOUDINARY_API_SECRET not configured');
  }
  
  // Update metadata
  data.lastUpdated = new Date().toISOString();
  
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = 'instagram-studio/schedule-data';
  
  // Create signature (must match Cloudinary's expected format)
  const signatureString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');
  
  // Use URLSearchParams for form data (works in all Node.js versions)
  const formData = new URLSearchParams();
  formData.append('file', `data:application/json;base64,${Buffer.from(JSON.stringify(data, null, 2)).toString('base64')}`);
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
      body: formData.toString()
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to save to Cloudinary: ${error}`);
  }
  
  return await response.json();
}

/**
 * Instagram aspect ratios (Instagram accepts 0.8 to 1.91)
 */
const ASPECT_PORTRAIT = '0.8';  // 4:5
const ASPECT_LANDSCAPE = '1.91'; // 1.91:1

/**
 * Convert image URLs to Cloudinary Instagram-ready URLs
 * Uses the same pattern as the client: portfolio-projects-{projectId}-{index}
 */
async function getInstagramUrls(imageUrls, projectId) {
  const results = [];
  
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    
    // Find the image index from the URL
    let imageIndex = i;
    
    if (url.includes('res.cloudinary.com')) {
      // Already a Cloudinary URL - extract index
      const match = url.match(/portfolio-projects-[^-]+-(\d+)/);
      if (match) {
        imageIndex = parseInt(match[1], 10);
      }
    }
    
    // Build Instagram-optimized Cloudinary URL
    // Default to portrait (0.8) ratio - most common for Instagram
    const publicId = `portfolio-projects-${projectId}-${imageIndex}`;
    const instagramUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/ar_${ASPECT_PORTRAIT},c_pad,b_black,g_center,q_95,f_jpg/w_1440,c_limit/${publicId}.jpg`;
    
    results.push(instagramUrl);
  }
  
  return results;
}

/**
 * Publish a post to Instagram
 */
async function publishPost(post, accessToken, accountId) {
  const { imageUrls, caption } = post;
  
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('No images to publish');
  }
  
  // Single image or carousel?
  if (imageUrls.length === 1) {
    return await publishSingleImage(imageUrls[0], caption, accessToken, accountId);
  } else {
    return await publishCarousel(imageUrls, caption, accessToken, accountId);
  }
}

/**
 * Publish a single image post
 */
async function publishSingleImage(imageUrl, caption, accessToken, accountId) {
  // Create container
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
    throw new Error(containerData.error.message);
  }
  
  const containerId = containerData.id;
  
  // Wait for processing
  await waitForMediaReady(containerId, accessToken);
  
  // Publish
  const publishResponse = await fetch(
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
  
  const publishData = await publishResponse.json();
  if (publishData.error) {
    throw new Error(publishData.error.message);
  }
  
  return { mediaId: publishData.id };
}

/**
 * Publish a carousel post
 */
async function publishCarousel(imageUrls, caption, accessToken, accountId) {
  // Create child containers (one at a time to avoid rate limits)
  const childIds = [];
  for (const imageUrl of imageUrls.slice(0, 10)) {
    const response = await fetch(
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
    
    const data = await response.json();
    if (data.error) {
      throw new Error(`Child container error: ${data.error.message}`);
    }
    
    childIds.push(data.id);
    
    // Small delay between children
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Wait for all children to be ready
  for (const childId of childIds) {
    await waitForMediaReady(childId, accessToken);
  }
  
  // Create carousel container
  const carouselResponse = await fetch(
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
  
  const carouselData = await carouselResponse.json();
  if (carouselData.error) {
    throw new Error(carouselData.error.message);
  }
  
  // Wait for carousel to be ready
  await waitForMediaReady(carouselData.id, accessToken);
  
  // Publish
  const publishResponse = await fetch(
    `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: carouselData.id,
        access_token: accessToken,
      }),
    }
  );
  
  const publishData = await publishResponse.json();
  if (publishData.error) {
    throw new Error(publishData.error.message);
  }
  
  return { mediaId: publishData.id };
}

/**
 * Wait for media container to be ready
 */
async function waitForMediaReady(containerId, accessToken) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < MAX_PROCESSING_WAIT) {
    const response = await fetch(
      `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${containerId}?fields=status_code,status&access_token=${accessToken}`
    );
    
    const data = await response.json();
    
    if (data.status_code === 'FINISHED') {
      return true;
    }
    
    if (data.status_code === 'ERROR') {
      throw new Error(`Media processing error: ${data.status || 'Unknown error'}`);
    }
    
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
  
  throw new Error('Media processing timeout');
}
