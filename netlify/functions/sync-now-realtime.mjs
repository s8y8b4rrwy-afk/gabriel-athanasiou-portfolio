import { syncAirtableData } from '../../Old Sync Functions/scheduled-sync-realtime.mjs';

/**
 * Manual trigger endpoint for the realtime sync function
 * 
 * Call this via: /.netlify/functions/sync-now-realtime
 * 
 * Useful for:
 * - Testing the realtime sync process
 * - Forcing an immediate full sync with fresh uploads
 * - Initial data population
 */
export const handler = async (event, context) => {
  // Optional: Add authentication to prevent abuse
  const authHeader = event.headers['authorization'];
  const expectedToken = process.env.SYNC_TOKEN;
  
  // If SYNC_TOKEN is set, require authentication
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    console.log('Manual realtime sync triggered');
    const result = await syncAirtableData();
    return result;
  } catch (error) {
    console.error('Manual realtime sync failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
    };
  }
};
