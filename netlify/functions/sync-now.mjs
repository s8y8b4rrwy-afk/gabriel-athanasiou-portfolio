import { syncAllData } from '../../scripts/lib/sync-core.mjs';
import os from 'os';
import path from 'path';

/**
 * Manual trigger endpoint for the sync function
 * 
 * IMPORTANT: Netlify Functions run in a read-only serverless environment.
 * The only writable directory is /tmp. This function uses /tmp for any
 * file operations during sync. Note that /tmp is ephemeral and cleared
 * between invocations.
 * 
 * For persistent data sync that updates your repository files, use:
 * - GitHub Actions workflow (sync-data.yml) - recommended for production
 * - Local npm run build:data - for development
 * 
 * This function is useful for:
 * - Testing the sync process without committing changes
 * - Triggering webhooks to validate Airtable connectivity
 * - Checking what data would be synced
 * - Debugging sync issues
 * 
 * Call this via: /.netlify/functions/sync-now
 * Force full sync: /.netlify/functions/sync-now?force=true
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
    
    // Use /tmp directory for Netlify Functions (serverless environment)
    // The 'public' directory doesn't exist and can't be created in Netlify Functions
    const tmpOutputDir = path.join(os.tmpdir(), 'sync-output');
    console.log(`📁 Using temporary output directory: ${tmpOutputDir}`);
    
    // Use shared sync core logic with serverless-compatible settings
    const results = await syncAllData({
      airtableToken,
      airtableBaseId,
      outputDir: tmpOutputDir,
      verbose: true,
      forceFullSync,
      skipFileWrites: true  // Don't write files in serverless - just return data
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Mode': results.syncStats.mode
      },
      body: JSON.stringify({
        success: true,
        message: 'Sync completed successfully',
        stats: {
          projects: results.projects.length,
          journal: results.journal.length,
          timestamp: results.timestamp
        },
        syncStats: results.syncStats
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
