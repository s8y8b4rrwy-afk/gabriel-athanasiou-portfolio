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
 * 
 * @see lib/instagram-lib.mjs for shared Instagram API functions
 */

import {
  GRAPH_API_BASE,
  GRAPH_API_VERSION,
  validateHashtags,
  waitForMediaReady,
  publishMediaContainer,
  verifyPublishStatus,
  createMediaContainer,
  createCarouselContainer,
} from './lib/instagram-lib.mjs';

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
      
      case 'verifyPublish':
        return await handleVerifyPublish(headers, accessToken, accountId, containerId);
      
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
    console.log('📸 Creating single image container...');
    console.log('   imageUrl:', imageUrl);
    console.log('   caption length:', caption?.length);
    console.log('   accountId:', accountId);
    
    // Validate hashtag count (Instagram max is 30)
    const hashtagValidation = validateHashtags(caption);
    console.log('   hashtag count:', hashtagValidation.count);
    if (!hashtagValidation.valid) {
      console.error('Too many hashtags:', hashtagValidation.count);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: hashtagValidation.error }),
      };
    }
    
    // Step 1: Create media container using lib function
    const container = await createMediaContainer(imageUrl, caption, accessToken, accountId, false);
    const containerId = container.id;
    console.log('✅ Container created:', containerId);

    // Step 2: Wait for processing using lib function
    const ready = await waitForMediaReady(containerId, accessToken, { 
      maxWait: MAX_PROCESSING_WAIT, 
      pollInterval: POLL_INTERVAL 
    });
    if (!ready.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: ready.error }),
      };
    }

    // Step 3: Publish using lib function (includes rate limit detection)
    const publishResult = await publishMediaContainer(containerId, accessToken, accountId);
    
    return {
      statusCode: publishResult.success ? 200 : 400,
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
 * Uses shared library functions from instagram-lib.mjs
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

    // Step 1: Create child containers for each image using shared lib
    const childIds = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      console.log(`Creating carousel item ${i + 1}/${imageUrls.length}...`);
      
      const result = await createMediaContainer(accessToken, accountId, url, null, true);
      
      if (result.error) {
        console.error(`Carousel item ${i + 1} failed:`, result.error);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Failed to create carousel item ${i + 1}: ${result.error}` }),
        };
      }

      childIds.push(result.id);
      console.log(`✅ Carousel item ${i + 1} created:`, result.id);

      // Wait for each item to be processed using shared lib
      const ready = await waitForMediaReady(result.id, accessToken);
      if (!ready.success) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Carousel item ${i + 1} processing failed: ${ready.error}` }),
        };
      }
    }

    // Step 2: Create carousel container using shared lib
    console.log('Creating carousel container with children:', childIds);
    const carouselResult = await createCarouselContainer(accessToken, accountId, childIds, caption);
    
    if (carouselResult.error) {
      console.error('Carousel container creation failed:', carouselResult.error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: carouselResult.error }),
      };
    }

    const carouselContainerId = carouselResult.id;
    console.log('✅ Carousel container created:', carouselContainerId);

    // Step 3: Wait for carousel processing using shared lib
    const ready = await waitForMediaReady(carouselContainerId, accessToken);
    if (!ready.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: ready.error }),
      };
    }

    // Step 4: Publish using shared lib (includes rate limit handling)
    const publishResult = await publishMediaContainer(carouselContainerId, accessToken, accountId);
    
    return {
      statusCode: publishResult.success ? 200 : 400,
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
 * Create a single carousel item (for step-by-step approach)
 * Uses shared library functions from instagram-lib.mjs
 */
async function handleCreateCarouselItem(headers, accessToken, accountId, imageUrl) {
  try {
    console.log('Creating carousel item:', imageUrl?.substring(0, 50));
    
    // Use shared lib to create carousel item
    const result = await createMediaContainer(accessToken, accountId, imageUrl, null, true);
    
    if (result.error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: result.error }),
      };
    }

    // Wait briefly for processing using shared lib
    const ready = await waitForMediaReady(result.id, accessToken);
    
    // Don't include error field on success - client checks for it
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        containerId: result.id,
        ready: ready.success
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
 * Uses shared library functions from instagram-lib.mjs
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
      
      // Use shared lib to create carousel container
      const result = await createCarouselContainer(accessToken, accountId, childIds, caption);
      
      if (result.error) {
        // Retry on "Unsupported get request" error - means children aren't ready yet
        if (result.error.includes('Unsupported') && attempt < maxRetries) {
          console.log(`Got "${result.error}", retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: result.error }),
        };
      }

      // Wait briefly for processing using shared lib
      const ready = await waitForMediaReady(result.id, accessToken);
      
      // Don't include error field on success - client checks for it
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          containerId: result.id,
          ready: ready.success
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
 * Uses shared library functions from instagram-lib.mjs
 */
async function handlePublishContainer(headers, accessToken, accountId, containerId) {
  try {
    // Use shared lib for publishing (includes rate limit handling)
    const result = await publishMediaContainer(containerId, accessToken, accountId);
    
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

/**
 * Verify if a post was successfully published
 * This can be called by the client when a publish fails to double-check
 */
async function handleVerifyPublish(headers, accessToken, accountId, containerId) {
  try {
    const result = await verifyPublishStatus(containerId, accessToken, accountId);
    
    return {
      statusCode: 200,
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
