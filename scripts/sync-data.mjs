#!/usr/bin/env node
// Build-time data generator - creates static portfolio-data.json
// Uses shared sync-core for consistency with Netlify functions

import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { syncAllData } from './lib/sync-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.local first, then .env
config({ path: path.resolve(__dirname, '../.env.local') });
config({ path: path.resolve(__dirname, '../.env') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.VITE_AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID || '';

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
  console.error('[sync-data] ❌ Missing Airtable credentials');
  process.exit(1);
}

const OUTPUT_DIR = path.resolve('public');

console.log('[sync-data] 🔄 Starting data sync...');

// Run the sync using shared core logic
(async () => {
  try {
    const results = await syncAllData({
      airtableToken: AIRTABLE_TOKEN,
      airtableBaseId: AIRTABLE_BASE_ID,
      outputDir: OUTPUT_DIR,
      verbose: true
    });

    console.log('[sync-data] ✅ Sync complete!');
    console.log(`[sync-data]    - ${results.projects.length} projects`);
    console.log(`[sync-data]    - ${results.journal.length} journal posts`);
    console.log(`[sync-data]    - Generated at: ${results.timestamp}`);
    process.exit(0);
  } catch (error) {
    console.error('[sync-data] ❌ Sync failed:', error);
    process.exit(1);
  }
})();
