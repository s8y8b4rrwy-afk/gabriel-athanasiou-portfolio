import { syncAllData } from '../../scripts/lib/sync-core.mjs';

/**
 * Manual trigger endpoint for the sync function
 * 
 * Call this via: /.netlify/functions/sync-now
 * Force full sync: /.netlify/functions/sync-now?force=true
 * 
 * Useful for:
 * - Triggering sync via webhook after Airtable updates
 * - Testing the sync process
 * - Forcing an immediate sync
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
    console.log('📊 Manual sync triggered via Netlify function');
    
    // Get environment variables
    const airtableToken = process.env.VITE_AIRTABLE_TOKEN || process.env.AIRTABLE_TOKEN;
    const airtableBaseId = process.env.VITE_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;
    
    if (!airtableToken || !airtableBaseId) {
      throw new Error('Missing Airtable credentials');
    }
    
    // Check for force parameter
    const forceFullSync = event.queryStringParameters?.force === 'true';
    
    if (forceFullSync) {
      console.log('⚡ Force full sync requested');
    }
    
    // Use shared sync core logic
    const results = await syncAllData({
      airtableToken,
      airtableBaseId,
      outputDir: 'public',
      verbose: true
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Sync completed successfully',
        stats: {
          projects: results.projects.length,
          journal: results.journal.length,
          timestamp: results.timestamp
        }
      })
    };
  } catch (error) {
    console.error('❌ Manual sync failed:', error);
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
};
