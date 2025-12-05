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
 */

const GRAPH_API_BASE = 'https://graph.instagram.com';
const GRAPH_API_VERSION = 'v21.0';

// Maximum wait time for media processing (30 seconds)
const MAX_PROCESSING_WAIT = 30000;
const POLL_INTERVAL = 2000;

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
    const { action, accessToken, accountId, imageUrl, imageUrls, caption } = body;

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
      
      case 'checkStatus':
        return await handleCheckStatus(headers, accessToken, body.containerId);
      
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
    
    const carouselResponse = await fetch(
      `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          children: childIds.join(','),
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

  console.log('✅ Published! Post ID:', result.id);
  return { success: true, postId: result.id };
}
