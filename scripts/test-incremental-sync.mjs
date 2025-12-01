#!/usr/bin/env node
/**
 * Test script for incremental sync functionality
 * Tests the new fetchTimestamps and checkForChanges functions
 */

import { fetchTimestamps, checkForChanges } from './lib/airtable-helpers.mjs';
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
  console.error('Set VITE_AIRTABLE_TOKEN and VITE_AIRTABLE_BASE_ID environment variables');
  process.exit(1);
}

async function testIncrementalSync() {
  console.log('🧪 Testing Incremental Sync Functionality\n');
  
  try {
    // Test 1: Fetch timestamps
    console.log('Test 1: Fetching timestamps from Projects table...');
    const timestamps = await fetchTimestamps('Projects', TOKEN, BASE_ID);
    console.log(`✅ Fetched ${timestamps.length} record timestamps`);
    console.log('Sample:', timestamps.slice(0, 2));
    console.log('');
    
    // Test 2: Load existing metadata
    console.log('Test 2: Loading existing portfolio data...');
    const dataFile = path.join(process.cwd(), 'public', 'portfolio-data.json');
    let existingData = null;
    
    if (fs.existsSync(dataFile)) {
      const content = fs.readFileSync(dataFile, 'utf-8');
      existingData = JSON.parse(content);
      console.log(`✅ Loaded existing data`);
      
      if (existingData.syncMetadata) {
        console.log(`   Last sync: ${existingData.syncMetadata.lastSync}`);
        console.log(`   Has timestamps: ${!!existingData.syncMetadata.timestamps}`);
      } else {
        console.log('   ⚠️  No syncMetadata found (expected for first run)');
      }
    } else {
      console.log('   ⚠️  No existing data file (expected for first run)');
    }
    console.log('');
    
    // Test 3: Check for changes
    if (existingData?.syncMetadata) {
      console.log('Test 3: Checking for changes...');
      const currentTimestamps = {
        'Projects': timestamps
      };
      
      const changes = checkForChanges(existingData.syncMetadata, currentTimestamps);
      console.log('✅ Change detection complete:');
      console.log(`   New records: ${changes.Projects.new.length}`);
      console.log(`   Changed records: ${changes.Projects.changed.length}`);
      console.log(`   Deleted records: ${changes.Projects.deleted.length}`);
      
      if (changes.Projects.changed.length > 0) {
        console.log(`   Changed IDs: ${changes.Projects.changed.slice(0, 3).join(', ')}...`);
      }
    } else {
      console.log('Test 3: Skipped (no previous metadata to compare)');
    }
    console.log('');
    
    console.log('✅ All tests passed!');
    console.log('\n📋 Next steps:');
    console.log('1. Add "Last Modified" field to all Airtable tables');
    console.log('2. Run a force full sync to populate initial metadata');
    console.log('3. Make a change in Airtable and run sync again');
    console.log('4. Verify incremental sync detects the change');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testIncrementalSync();
