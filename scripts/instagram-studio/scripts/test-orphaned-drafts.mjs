#!/usr/bin/env node
/**
 * Test script to check for orphaned drafts (drafts referencing deleted projects)
 */

async function test() {
  console.log('📥 Fetching data...\n');
  
  // Fetch schedule data
  const scheduleRes = await fetch('https://res.cloudinary.com/date24ay6/raw/upload/instagram-studio/schedule-data.json?t=' + Date.now());
  const schedule = await scheduleRes.json();
  
  // Fetch portfolio data
  const portfolioRes = await fetch('https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/portfolio-data-postproduction.json?t=' + Date.now());
  const portfolio = await portfolioRes.json();
  
  // Build project ID set
  const projectIds = new Set(portfolio.projects.map(p => p.id));
  
  // Check drafts
  const orphanedDrafts = schedule.drafts.filter(d => !projectIds.has(d.projectId));
  
  console.log('📊 Edge Case Test Results:');
  console.log(`   Portfolio projects: ${projectIds.size}`);
  console.log(`   Schedule drafts: ${schedule.drafts.length}`);
  console.log(`   Orphaned drafts (project deleted): ${orphanedDrafts.length}`);
  
  if (orphanedDrafts.length > 0) {
    console.log('\n⚠️ Orphaned draft project IDs:');
    orphanedDrafts.forEach(d => console.log(`   - ${d.projectId}`));
  } else {
    console.log('\n✅ All drafts have valid project references');
  }
}

test().catch(console.error);
