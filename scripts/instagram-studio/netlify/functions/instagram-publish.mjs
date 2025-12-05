/**
 * Instagram Publish Netlify Function
 * 
 * Handles Instagram content publishing securely on the server side:
 * - Create single image posts
 * - Create carousel posts (up to 10 images)
 * - Check media container status
 * - Publish media to Instagram
 * 
 * This avoids CORS issues by making API calls from the server.
 * 
 * NOTE: Netlify functions have a 10-second timeout on free tier.
 * We use shorter polling intervals and fail fast if processing takes too long.
 */

const GRAPH_API_BASE = 'https://graph.instagram.com';
const GRAPH_API_VERSION = 'v21.0';

// Netlify Pro has 26 second timeout, Free has 10 seconds
// We'll use 25 seconds to be safe - if on free tier, it will just timeout
const MAX_PROCESSING_WAIT = 25000; // 25 seconds max
const POLL_INTERVAL = 2000; // Poll every 2 seconds

export const handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { action, accessToken, accountId, imageUrl, imageUrls, caption, containerId, childIds } = body;

    if (!accessToken || !accountId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing accessToken or accountId' }),
      };
    }

    switch (action) {
      case 'publishSingle':
        return await handlePublishSingle(headers, accessToken, accountId, imageUrl, caption);
      
      case 'publishCarousel':
        return await handlePublishCarousel(headers, accessToken, accountId, imageUrls, caption);
      
      // Step-by-step carousel actions (for handling timeouts)
      case 'createCarouselItem':
        return await handleCreateCarouselItem(headers, accessToken, accountId, imageUrl);
      
      case 'createCarouselContainer':
        return await handleCreateCarouselContainer(headers, accessToken, accountId, childIds, caption);
      
      case 'publishContainer':
        return await handlePublishContainer(headers, accessToken, accountId, containerId);
      
      case 'checkStatus':
        return await handleCheckStatus(headers, accessToken, containerId);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown action: ${action}` }),
        };
    }
  } catch (error) {
    console.error('Instagram publish error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

/**
 * Publish a single image post
 */
async function handlePublishSingle(headers, accessToken, accountId, imageUrl, caption) {
  try {
    console.log('📸 Creating single image container...', { imageUrl: imageUrl?.substring(0, 50) });
    
    // Step 1: Create media container
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

    const containerResult = await containerResponse.json();
    
    if (containerResult.error) {
      console.error('Container creation failed:', containerResult.error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: containerResult.error.message }),
      };
    }

    const containerId = containerResult.id;
    console.log('✅ Container created:', containerId);

    // Step 2: Wait for processing
    const ready = await waitForProcessing(containerId, accessToken);
    if (!ready.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: ready.error }),
      };
    }

    // Step 3: Publish
    const publishResult = await publishMedia(containerId, accessToken, accountId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(publishResult),
    };
  } catch (error) {
    console.error('Single image publish error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

/**
 * Publish a carousel post (multiple images)
 */
async function handlePublishCarousel(headers, accessToken, accountId, imageUrls, caption) {
  try {
    if (!imageUrls || imageUrls.length < 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Carousel requires at least 2 images' }),
      };
    }

    if (imageUrls.length > 10) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Carousel cannot have more than 10 images' }),
      };
    }

    console.log(`📸 Creating carousel with ${imageUrls.length} images...`);

    // Step 1: Create child containers for each image
    const childIds = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      console.log(`Creating carousel item ${i + 1}/${imageUrls.length}...`);
      
      const response = await fetch(
        `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: url,
            is_carousel_item: true,
            access_token: accessToken,
          }),
        }
      );

      const result = await response.json();
      
      if (result.error) {
        console.error(`Carousel item ${i + 1} failed:`, result.error);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Failed to create carousel item ${i + 1}: ${result.error.message}` }),
        };
      }

      childIds.push(result.id);
      console.log(`✅ Carousel item ${i + 1} created:`, result.id);

      // Wait for each item to be processed
      const ready = await waitForProcessing(result.id, accessToken);
      if (!ready.success) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Carousel item ${i + 1} processing failed: ${ready.error}` }),
        };
      }
    }

    // Step 2: Create carousel container
    console.log('Creating carousel container with children:', childIds);
    
    // Instagram API expects children as an array, not comma-separated string
    const carouselResponse = await fetch(
      `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          children: childIds,  // Pass as array, not string
          caption: caption,
          access_token: accessToken,
        }),
      }
    );

    const carouselResult = await carouselResponse.json();
    
    if (carouselResult.error) {
      console.error('Carousel container creation failed:', carouselResult.error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: carouselResult.error.message }),
      };
    }

    const carouselContainerId = carouselResult.id;
    console.log('✅ Carousel container created:', carouselContainerId);

    // Step 3: Wait for carousel processing
    const ready = await waitForProcessing(carouselContainerId, accessToken);
    if (!ready.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: ready.error }),
      };
    }

    // Step 4: Publish
    const publishResult = await publishMedia(carouselContainerId, accessToken, accountId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(publishResult),
    };
  } catch (error) {
    console.error('Carousel publish error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

/**
 * Check media container status
 */
async function handleCheckStatus(headers, accessToken, containerId) {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${containerId}?fields=status_code&access_token=${accessToken}`
    );

    const result = await response.json();
    
    if (result.error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: result.error.message }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: result.status_code }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

/**
 * Wait for media container to finish processing
 */
async function waitForProcessing(containerId, accessToken) {
  const startTime = Date.now();
  let retryCount = 0;
  const maxRetries = 3;
  
  while (Date.now() - startTime < MAX_PROCESSING_WAIT) {
    const response = await fetch(
      `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${containerId}?fields=status_code&access_token=${accessToken}`
    );

    const result = await response.json();
    
    if (result.error) {
      // Handle "Unsupported get request" - this can happen temporarily
      // Retry a few times before failing
      if (result.error.message?.includes('Unsupported get request') && retryCount < maxRetries) {
        console.log(`⚠️ Got "Unsupported get request" for ${containerId}, retrying (${retryCount + 1}/${maxRetries})...`);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL * 2));
        continue;
      }
      return { success: false, error: result.error.message };
    }
    
    // Reset retry count on successful response
    retryCount = 0;

    const status = result.status_code;
    console.log(`Container ${containerId} status: ${status}`);

    if (status === 'FINISHED') {
      return { success: true };
    }
    
    if (status === 'ERROR' || status === 'EXPIRED') {
      return { success: false, error: `Container status: ${status}` };
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }

  return { success: false, error: 'Processing timeout' };
}

/**
 * Publish a media container
 */
async function publishMedia(containerId, accessToken, accountId) {
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
 * Create a single carousel item (for step-by-step approach)
 */
async function handleCreateCarouselItem(headers, accessToken, accountId, imageUrl) {
  try {
    console.log('Creating carousel item:', imageUrl?.substring(0, 50));
    
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

    const result = await response.json();
    
    if (result.error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: result.error.message }),
      };
    }

    // Wait briefly for processing
    const ready = await waitForProcessing(result.id, accessToken);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        containerId: result.id,
        ready: ready.success,
        error: ready.error
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

/**
 * Create carousel container from child IDs
 */
async function handleCreateCarouselContainer(headers, accessToken, accountId, childIds, caption) {
  const maxRetries = 3;
  const retryDelay = 3000; // 3 seconds between retries
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Creating carousel container (attempt ${attempt}/${maxRetries}) with children:`, childIds);
      
      // Wait a bit before first attempt to let child items process
      if (attempt === 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Instagram API expects children as an array, not comma-separated string
      const response = await fetch(
        `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_type: 'CAROUSEL',
            children: childIds,  // Pass as array, not string
            caption: caption,
            access_token: accessToken,
          }),
        }
      );

      const result = await response.json();
      
      if (result.error) {
        // Retry on "Unsupported get request" error - means children aren't ready yet
        if (result.error.message?.includes('Unsupported') && attempt < maxRetries) {
          console.log(`Got "${result.error.message}", retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: result.error.message }),
        };
      }

      // Wait briefly for processing
      const ready = await waitForProcessing(result.id, accessToken);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          containerId: result.id,
          ready: ready.success,
          error: ready.error
        }),
      };
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(`Error on attempt ${attempt}, retrying...`, error.message);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }
  
  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({ error: 'Max retries exceeded' }),
  };
}

/**
 * Publish a container by ID
 */
async function handlePublishContainer(headers, accessToken, accountId, containerId) {
  try {
    const result = await publishMedia(containerId, accessToken, accountId);
    
    return {
      statusCode: result.success ? 200 : 400,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
