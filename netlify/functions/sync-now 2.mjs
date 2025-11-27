import { syncAirtableData } from './scheduled-sync.mjs';

/**
 * Manual trigger endpoint for the sync function
 * 
 * Call this via: /.netlify/functions/sync-now
 * 
 * Useful for:
 * - Testing the sync process
 * - Forcing an immediate sync after Airtable changes
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
    console.log('Manual sync triggered');
    const result = await syncAirtableData();
    return result;
  } catch (error) {
    console.error('Manual sync failed:', error);
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
