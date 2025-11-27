import { builder } from '@netlify/functions';
import { syncAirtableData } from './scheduled-sync.mjs';

const getDataHandler = async (event, context) => {
  try {
    // Call the sync function to get fresh (or cached) data
    const result = await syncAirtableData();
    
    // Return the data with CDN cache headers
    return {
      statusCode: result.statusCode,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
      body: result.body,
      ttl: 3600 // Cache at edge for 1 hour
    };

  } catch (error) {
    console.error('Failed to fetch data:', error);
    return { 
      statusCode: 500, 
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch data',
        message: error.message
      })
    };
  }
};

export const handler = builder(getDataHandler);