#!/usr/bin/env node
import fetch from 'node-fetch';
import https from 'https';

// For Instagram diagnostic, we need to access Cloudinary
const CLOUDINARY_CLOUD = 'date24ay6';

async function fetchScheduleData() {
  try {
    const url = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/raw/upload/instagram-studio/schedule-data?t=${Date.now()}`;
    console.log(`📡 Fetching from: ${url}`);
    
    const response = await fetch(url, { timeout: 5000 });
    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Error fetching schedule data:', error.message);
    return null;
  }
}

async function runDiagnostic() {
  console.log('\n🔍 Instagram Studio Scheduling Diagnostic\n');
  console.log('=' .repeat(60));
  
  try {
    const scheduleData = await fetchScheduleData();
    
    if (!scheduleData) {
      console.log('❌ Could not fetch schedule data from Cloudinary');
      console.log('   This is the first thing preventing scheduling from working!');
      console.log('\n💡 What this means:');
      console.log('   - Instagram Studio data might not be synced to Cloudinary');
      console.log('   - File might not exist at: instagram-studio-data.json');
      console.log('   - Or it was never uploaded\n');
      return;
    }

    console.log('\n✅ Schedule data found in Cloudinary\n');
    
    // Check Instagram connection
    console.log('📊 INSTAGRAM CONNECTION:');
    console.log(`  ├─ Connected: ${scheduleData.instagram?.connected ? '✅ YES' : '❌ NO'}`);
    console.log(`  ├─ Has Access Token: ${scheduleData.instagram?.accessToken ? '✅ YES' : '❌ NO'}`);
    console.log(`  ├─ Account ID: ${scheduleData.instagram?.accountId || '❌ NOT SET'}`);
    console.log('');
    
    if (!scheduleData.instagram?.connected || !scheduleData.instagram?.accessToken) {
      console.log('🔴 ISSUE FOUND: Instagram is not properly connected!');
      console.log('   The scheduled publish function will not run without this.\n');
    }
    
    // Check schedule slots
    console.log('📅 SCHEDULE SLOTS:');
    const slots = scheduleData.scheduleSlots || [];
    console.log(`  ├─ Total slots: ${slots.length}`);
    
    const byStatus = {};
    slots.forEach(slot => {
      byStatus[slot.status] = (byStatus[slot.status] || 0) + 1;
    });
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`  ├─ ${status}: ${count}`);
    });
    console.log('');
    
    // Find pending posts
    const pendingSlots = slots.filter(s => s.status === 'pending');
    console.log(`📌 PENDING POSTS: ${pendingSlots.length}`);
    if (pendingSlots.length > 0) {
      pendingSlots.slice(0, 5).forEach(slot => {
        console.log(`  ├─ ${slot.scheduledDate} ${slot.scheduledTime} (ID: ${slot.id})`);
      });
      if (pendingSlots.length > 5) {
        console.log(`  ├─ ... and ${pendingSlots.length - 5} more`);
      }
    }
    console.log('');
    
    // Check for due posts
    const now = new Date();
    const dueSlots = pendingSlots.filter(slot => {
      const scheduledTime = new Date(`${slot.scheduledDate}T${slot.scheduledTime}:00`);
      return scheduledTime <= now;
    });
    
    console.log(`⏰ DUE FOR PUBLISHING NOW: ${dueSlots.length}`);
    if (dueSlots.length > 0) {
      dueSlots.forEach(slot => {
        const scheduledTime = new Date(`${slot.scheduledDate}T${slot.scheduledTime}:00`);
        const timePassed = Math.floor((now - scheduledTime) / 1000 / 60);
        console.log(`  ├─ ${slot.scheduledDate} ${slot.scheduledTime} (${timePassed} min ago) - ID: ${slot.id}`);
      });
      console.log('');
      console.log('🟢 THESE SHOULD BE PUBLISHING!');
      if (!scheduleData.instagram?.connected) {
        console.log('   ❌ But Instagram is not connected, so they won\'t publish.');
      }
    } else {
      console.log('  └─ No posts due yet');
    }
    console.log('');
    
    // Summary
    console.log('=' .repeat(60));
    console.log('\n📋 DIAGNOSTIC SUMMARY:\n');
    
    const issues = [];
    if (!scheduleData.instagram?.connected) issues.push('❌ Instagram not connected');
    if (!scheduleData.instagram?.accessToken) issues.push('❌ No access token');
    if (pendingSlots.length === 0) issues.push('⚠️  No pending posts to publish');
    if (dueSlots.length === 0 && pendingSlots.length > 0) issues.push('⚠️  Pending posts but none are due yet');
    
    if (issues.length === 0) {
      console.log('🟢 Everything looks good!');
      console.log('  ✅ Instagram connected');
      console.log('  ✅ Posts pending');
      console.log('  ✅ Posts due for publishing');
      console.log('\n  → The scheduled function should publish these automatically.');
      console.log('  → Try the manual trigger: npm run instagram:publish-now\n');
    } else {
      console.log('Issues found:\n');
      issues.forEach(issue => console.log(`  ${issue}`));
      console.log('\n💡 Next steps:');
      
      if (issues.some(i => i.includes('Instagram not connected'))) {
        console.log('  1. Go to Instagram Studio app');
        console.log('  2. Click "Connect Instagram"');
        console.log('  3. Authorize the app');
        console.log('  4. Re-run this diagnostic\n');
      }
      
      if (issues.some(i => i.includes('No pending posts'))) {
        console.log('  1. Go to Instagram Studio app');
        console.log('  2. Create or select a draft post');
        console.log('  3. Schedule it (set time to now or past)');
        console.log('  4. Click "Sync Now"');
        console.log('  5. Re-run this diagnostic\n');
      }
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
  }
}

runDiagnostic();
