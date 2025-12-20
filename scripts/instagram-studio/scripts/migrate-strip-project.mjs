#!/usr/bin/env node
/**
 * Verification script to check schedule-data.json structure
 * (Migration was done manually - this script verifies the result)
 * 
 * Usage: node scripts/migrate-strip-project.mjs
 */

const CLOUDINARY_URL = 'https://res.cloudinary.com/date24ay6/raw/upload/instagram-studio/schedule-data.json';

async function main() {
  console.log('📥 Fetching current schedule-data.json from Cloudinary...\n');
  
  // Fetch current data
  const response = await fetch(CLOUDINARY_URL + `?t=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }
  
  const data = await response.json();
  const jsonSize = JSON.stringify(data).length;
  
  console.log(`📊 Current stats:`);
  console.log(`   - File size: ${Math.round(jsonSize / 1024)} KB`);
  console.log(`   - Drafts: ${data.drafts?.length || 0}`);
  console.log(`   - Schedule slots: ${data.scheduleSlots?.length || 0}`);
  console.log(`   - Templates: ${data.templates?.length || 0}`);
  
  // Count drafts with project field
  const draftsWithProject = data.drafts?.filter(d => 'project' in d) || [];
  console.log(`   - Drafts with embedded project: ${draftsWithProject.length}`);
  
  if (draftsWithProject.length === 0) {
    console.log('\n✅ Verification passed - no embedded project data found!');
  } else {
    console.log(`\n⚠️ Warning: ${draftsWithProject.length} drafts still have embedded project field`);
    draftsWithProject.forEach(d => {
      console.log(`   - Draft ${d.id}: ${d.project?.title || 'unknown'}`);
    });
  }
  
  // Check all drafts have projectId
  const draftsWithoutProjectId = data.drafts?.filter(d => !d.projectId) || [];
  if (draftsWithoutProjectId.length > 0) {
    console.log(`\n⚠️ Warning: ${draftsWithoutProjectId.length} drafts missing projectId`);
    draftsWithoutProjectId.forEach(d => {
      console.log(`   - Draft ${d.id}`);
    });
  } else {
    console.log('✅ All drafts have projectId');
  }
  
  // Sample draft structure
  if (data.drafts?.length > 0) {
    console.log('\n📋 Sample draft structure (first draft):');
    const sample = data.drafts[0];
    console.log(`   Keys: ${Object.keys(sample).join(', ')}`);
    console.log(`   - projectId: ${sample.projectId}`);
    console.log(`   - caption: ${sample.caption?.substring(0, 50)}...`);
    console.log(`   - selectedImages: ${sample.selectedImages?.length || 0} images`);
    console.log(`   - hashtags: ${sample.hashtags?.length || 0} tags`);
  }
  
  console.log('\n🎉 Verification complete!');
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
