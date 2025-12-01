#!/usr/bin/env node
/**
 * Test full sync flow with incremental sync implementation
 */

import { syncAllData } from './lib/sync-core.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const TOKEN = process.env.VITE_AIRTABLE_TOKEN || process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;

if (!TOKEN || !BASE_ID) {
  console.error('❌ Missing Airtable credentials');
  process.exit(1);
}

async function testFullSync() {
  console.log('🧪 Testing Full Sync with Current Implementation\n');
  
  try {
    console.log('Running sync...');
    const startTime = Date.now();
    
    const results = await syncAllData({
      airtableToken: TOKEN,
      airtableBaseId: BASE_ID,
      outputDir: 'public',
      verbose: true
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n✅ Sync completed successfully!');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Projects: ${results.projects.length}`);
    console.log(`📝 Journal: ${results.journal.length}`);
    
    // Check if syncMetadata exists
    const dataFile = path.join(process.cwd(), 'public', 'portfolio-data.json');
    if (fs.existsSync(dataFile)) {
      const content = fs.readFileSync(dataFile, 'utf-8');
      const data = JSON.parse(content);
      
      console.log('\n📋 Data Structure:');
      console.log(`   Has syncMetadata: ${!!data.syncMetadata}`);
      console.log(`   Has _rawRecords: ${!!data._rawRecords}`);
      console.log(`   Has syncStats: ${!!results.syncStats}`);
      
      if (results.syncStats) {
        console.log('\n📈 Sync Stats:');
        console.log(`   Mode: ${results.syncStats.mode}`);
        console.log(`   API Calls: ${results.syncStats.apiCalls || 'N/A'}`);
        console.log(`   API Calls Saved: ${results.syncStats.apiCallsSaved || 'N/A'}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testFullSync();
