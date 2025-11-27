import { builder } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

const KV_DATA_KEY = 'airtable-data';

const getDataHandler = async (event, context) => {
    // Initialize KV store
    const kvStore = getStore('portfolio-kv');

    // Initialize KV store
    const kvStore = getStore('portfolio-kv');

  try {
    // Fetch cached data from KV storage
    const cachedDataStr = await kvStore.get(KV_DATA_KEY, { type: 'text' });
    
    if (!cachedDataStr) {
      // No data available yet - scheduled sync hasn't run
      return { 
        statusCode: 503, 
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Retry-After': '300'
        },
        body: JSON.stringify({ 
          error: 'Data not yet synced', 
          message: 'Please wait for initial sync to complete'
        })
      };
    }
    
    const cachedData = JSON.parse(cachedDataStr);
    
    // Return cached data from CDN-backed storage
    return { 
      statusCode: 200, 
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Netlify-CDN-Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
        'X-Data-Version': cachedData.version || '1.0',
        'X-Last-Updated': cachedData.lastUpdated || 'unknown'
      },
      body: JSON.stringify({ 
        projects: cachedData.projects, 
        posts: cachedData.posts, 
        config: cachedData.config 
      }),
      ttl: 3600 // Cache for 1 hour at edge
    };

  } catch (error) {
    console.error('Failed to fetch cached data:', error);
    return { 
      statusCode: 500, 
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch cached data',
        message: error.message
      })
    };
  }
};

export const handler = builder(getDataHandler);