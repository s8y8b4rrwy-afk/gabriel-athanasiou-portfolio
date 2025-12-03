#!/usr/bin/env node
/**
 * Sync BOTH portfolios with a single Airtable fetch
 * 
 * This saves ~50% of Airtable API calls by:
 * 1. Fetching all data from Airtable ONCE
 * 2. Processing and writing portfolio-data-directing.json
 * 3. Processing and writing portfolio-data-postproduction.json
 * 
 * Usage:
 *   npm run sync:both
 *   node scripts/sync-data-both.mjs
 *   FORCE_FULL_SYNC=true node scripts/sync-data-both.mjs
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { syncBothPortfolios } from './lib/sync-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.local first, then .env
config({ path: path.resolve(__dirname, '../.env.local') });
config({ path: path.resolve(__dirname, '../.env') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.VITE_AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID || '';
const FORCE_FULL_SYNC = process.env.FORCE_FULL_SYNC === 'true';

const OUTPUT_DIR = path.resolve('public');

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
  const directingPath = path.resolve(OUTPUT_DIR, 'portfolio-data-directing.json');
  const postprodPath = path.resolve(OUTPUT_DIR, 'portfolio-data-postproduction.json');
  
  if (fs.existsSync(directingPath) && fs.existsSync(postprodPath)) {
    console.warn('[sync-both] ⚠️  Missing Airtable credentials. Preserving existing portfolio data files');
    console.log('[sync-both] ℹ️  To sync, ensure AIRTABLE_TOKEN and AIRTABLE_BASE_ID are set.');
    process.exit(0);
  } else {
    console.error('[sync-both] ❌ Missing Airtable credentials and no existing data found');
    process.exit(1);
  }
}

console.log('[sync-both] 🔄 Starting DUAL portfolio sync (fetch once, write both)...');

// Run the sync using shared core logic
(async () => {
  try {
    const results = await syncBothPortfolios({
      airtableToken: AIRTABLE_TOKEN,
      airtableBaseId: AIRTABLE_BASE_ID,
      outputDir: OUTPUT_DIR,
      verbose: true,
      forceFullSync: FORCE_FULL_SYNC
    });

    console.log('\n[sync-both] ✅ Dual sync complete!');
    console.log(`[sync-both]    - Directing: ${results.portfolios.directing?.projects?.length || 0} projects`);
    console.log(`[sync-both]    - Postproduction: ${results.portfolios.postproduction?.projects?.length || 0} projects`);
    console.log(`[sync-both]    - Generated at: ${results.timestamp}`);
    console.log(`[sync-both]    - Sync mode: ${results.syncStats.mode}`);
    console.log(`[sync-both]    - API calls: ${results.syncStats.apiCalls}`);
    console.log(`[sync-both]    - API calls saved: ${results.syncStats.apiCallsSaved}`);
    console.log(`[sync-both]    - 💰 ~50% fewer API calls than syncing separately!`);

  } catch (error) {
    console.error('[sync-both] ❌ Sync failed:', error.message);
    process.exit(1);
  }
})();
