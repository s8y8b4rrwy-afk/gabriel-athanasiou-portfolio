#!/usr/bin/env node

/**
 * Test Sync Statistics
 * Demonstrates incremental sync performance improvements
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { syncAllData } from './lib/sync-core.mjs';

async function testSyncStats() {
  console.log('📊 Testing Sync Statistics\n');
  
  const airtableToken = process.env.VITE_AIRTABLE_TOKEN || process.env.AIRTABLE_TOKEN;
  const airtableBaseId = process.env.VITE_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;
  
  if (!airtableToken || !airtableBaseId) {
    throw new Error('Missing Airtable credentials');
  }
  
  // Test 1: Incremental sync (no changes expected)
  console.log('Test 1: Incremental Sync (no changes)...');
  const start1 = Date.now();
  const results1 = await syncAllData({
    airtableToken,
    airtableBaseId,
    outputDir: 'public',
    verbose: false,
    forceFullSync: false
  });
  const duration1 = Date.now() - start1;
  
  console.log('✅ Incremental Sync Complete');
  console.log(`   Mode: ${results1.syncStats.mode}`);
  console.log(`   Duration: ${duration1}ms`);
  console.log(`   API Calls: ${results1.syncStats.apiCalls}`);
  console.log(`   API Calls Saved: ${results1.syncStats.apiCallsSaved}`);
  console.log(`   New Records: ${results1.syncStats.newRecords}`);
  console.log(`   Changed Records: ${results1.syncStats.changedRecords}`);
  console.log(`   Deleted Records: ${results1.syncStats.deletedRecords}`);
  console.log(`   Unchanged Records: ${results1.syncStats.unchangedRecords}`);
  
  // Test 2: Force full sync
  console.log('\nTest 2: Force Full Sync...');
  const start2 = Date.now();
  const results2 = await syncAllData({
    airtableToken,
    airtableBaseId,
    outputDir: 'public',
    verbose: false,
    forceFullSync: true
  });
  const duration2 = Date.now() - start2;
  
  console.log('✅ Full Sync Complete');
  console.log(`   Mode: ${results2.syncStats.mode}`);
  console.log(`   Duration: ${duration2}ms`);
  console.log(`   API Calls: ${results2.syncStats.apiCalls}`);
  
  // Performance comparison
  console.log('\n📈 Performance Comparison:');
  console.log(`   Time saved: ${duration2 - duration1}ms (${Math.round((1 - duration1/duration2) * 100)}% faster)`);
  console.log(`   API calls saved: ${results2.syncStats.apiCalls - results1.syncStats.apiCalls} calls (${Math.round((1 - results1.syncStats.apiCalls/results2.syncStats.apiCalls) * 100)}% reduction)`);
}

testSyncStats().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
