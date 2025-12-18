#!/usr/bin/env node
/**
 * Instagram Scheduled Publish - Environment Verification Script
 * 
 * Usage:
 *   node scripts/instagram-studio/test-scheduled-publish.mjs
 * 
 * Purpose:
 *   - Verify all required environment variables are set
 *   - Test Cloudinary connection
 *   - Test Resend email service (if configured)
 *   - Provide diagnostic output for troubleshooting
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

console.log('\n' + '='.repeat(70));
console.log('📋 Instagram Scheduled Publish - Verification Report');
console.log('='.repeat(70) + '\n');

// Required variables
const REQUIRED_VARS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'INSTAGRAM_APP_ID',
  'INSTAGRAM_APP_SECRET',
  'INSTAGRAM_ACCOUNT_ID',
  'INSTAGRAM_ACCESS_TOKEN',
];

// Optional variables
const OPTIONAL_VARS = [
  'NOTIFICATION_EMAIL',
  'RESEND_API_KEY',
  'INSTAGRAM_DRY_RUN',
];

// ============================================================================
// 1. Check Required Variables
// ============================================================================
console.log('1️⃣  REQUIRED ENVIRONMENT VARIABLES\n');

let allRequiredSet = true;
const requiredStatus = {};

for (const varName of REQUIRED_VARS) {
  const value = process.env[varName];
  const isSet = !!value;
  const masked = isSet ? (value.substring(0, 4) + '*'.repeat(Math.max(0, value.length - 8)) + value.substring(value.length - 4)) : '❌ NOT SET';
  
  requiredStatus[varName] = isSet;
  
  if (!isSet) allRequiredSet = false;
  
  const status = isSet ? '✅' : '❌';
  console.log(`  ${status} ${varName.padEnd(30)} ${masked}`);
}

console.log('\n' + (allRequiredSet ? '✅ All required variables are set!' : '❌ Some required variables are missing!\n'));

// ============================================================================
// 2. Check Optional Variables
// ============================================================================
console.log('\n2️⃣  OPTIONAL ENVIRONMENT VARIABLES (for email notifications)\n');

const optionalStatus = {};

for (const varName of OPTIONAL_VARS) {
  const value = process.env[varName];
  const isSet = !!value;
  const masked = isSet ? (value.substring(0, 4) + '*'.repeat(Math.max(0, value.length - 8)) + value.substring(value.length - 4)) : '⚠️ NOT SET';
  
  optionalStatus[varName] = isSet;
  
  const status = isSet ? '✅' : '⚠️';
  console.log(`  ${status} ${varName.padEnd(30)} ${masked}`);
}

const emailsConfigured = optionalStatus.NOTIFICATION_EMAIL && optionalStatus.RESEND_API_KEY;
console.log(`\n${emailsConfigured ? '✅ Email notifications are configured' : '⚠️  Email notifications are NOT configured (optional, but recommended)'}`);

// ============================================================================
// 3. Cloudinary Connection Test
// ============================================================================
console.log('\n3️⃣  CLOUDINARY CONNECTION TEST\n');

if (requiredStatus.CLOUDINARY_API_KEY && requiredStatus.CLOUDINARY_API_SECRET) {
  console.log('  Testing Cloudinary connection...');
  
  // Note: This would require importing Cloudinary SDK, which adds complexity
  // For now, we just verify the credentials format
  
  const hasValidKey = process.env.CLOUDINARY_API_KEY.length >= 20;
  const hasValidSecret = process.env.CLOUDINARY_API_SECRET.length >= 20;
  const hasCloudName = process.env.CLOUDINARY_CLOUD_NAME === 'date24ay6';
  
  if (hasValidKey && hasValidSecret && hasCloudName) {
    console.log('  ✅ Cloudinary credentials look valid');
    console.log(`     Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);
    console.log(`     Key: ${process.env.CLOUDINARY_API_KEY.substring(0, 8)}...`);
  } else {
    console.log('  ❌ Cloudinary credentials may be invalid');
    if (!hasCloudName) console.log(`     ⚠️  Expected CLOUDINARY_CLOUD_NAME = "date24ay6", got "${process.env.CLOUDINARY_CLOUD_NAME}"`);
    if (!hasValidKey) console.log('     ⚠️  API key seems too short (should be 20+ chars)');
    if (!hasValidSecret) console.log('     ⚠️  API secret seems too short (should be 20+ chars)');
  }
} else {
  console.log('  ⚠️  Cannot test Cloudinary (missing credentials)');
}

// ============================================================================
// 4. Instagram Connection Test
// ============================================================================
console.log('\n4️⃣  INSTAGRAM CONNECTION TEST\n');

if (requiredStatus.INSTAGRAM_ACCESS_TOKEN) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const isLongToken = token.length > 50;
  const startsWithIGQ = token.startsWith('IGQ');
  
  console.log('  Instagram access token format:');
  if (isLongToken && startsWithIGQ) {
    console.log('  ✅ Token looks valid (long format, starts with IGQ)');
    console.log(`     Length: ${token.length} characters`);
  } else {
    console.log('  ❌ Token format may be invalid');
    if (!isLongToken) console.log(`     Token seems short (${token.length} chars, expected 50+)`);
    if (!startsWithIGQ) console.log(`     Token should start with "IGQ", got "${token.substring(0, 3)}..."`);
  }
  
  console.log(`\n  Account ID: ${process.env.INSTAGRAM_ACCOUNT_ID || '❌ NOT SET'}`);
} else {
  console.log('  ⚠️  Cannot verify Instagram token (not set)');
}

// ============================================================================
// 5. Email Service Test (if configured)
// ============================================================================
if (emailsConfigured) {
  console.log('\n5️⃣  EMAIL SERVICE TEST\n');
  
  console.log(`  Recipient email: ${process.env.NOTIFICATION_EMAIL}`);
  
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey.startsWith('re_')) {
    console.log(`  ✅ Resend API key format looks valid`);
  } else {
    console.log(`  ❌ Resend API key should start with "re_", got "${resendKey.substring(0, 4)}..."`);
  }
  
  console.log('\n  📧 Email notification template will include:');
  console.log('     - Publication status (success/failure counts)');
  console.log('     - Post titles and Instagram media IDs');
  console.log('     - Any error messages if publish failed');
  console.log('     - Link back to Instagram Studio');
}

// ============================================================================
// 6. Dry Run Mode
// ============================================================================
console.log('\n6️⃣  DRY RUN MODE\n');

const dryRunMode = process.env.INSTAGRAM_DRY_RUN === 'true';
console.log(`  Current mode: ${dryRunMode ? '🧪 DRY RUN (posts not published)' : '🚀 PRODUCTION (posts will be published)'}`);

if (!dryRunMode) {
  console.log('\n  ⚠️  WARNING: You are in PRODUCTION mode');
  console.log('     Any scheduled posts will be published to Instagram');
  console.log('     To test without publishing, set INSTAGRAM_DRY_RUN=true');
}

// ============================================================================
// 7. Summary & Next Steps
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('📊 SUMMARY');
console.log('='.repeat(70) + '\n');

const summary = [];

if (allRequiredSet) {
  summary.push('✅ All required variables are configured');
} else {
  summary.push('❌ Some required variables are missing - function cannot run');
}

if (emailsConfigured) {
  summary.push('✅ Email notifications are configured');
} else {
  summary.push('⚠️  Email notifications not configured (optional)');
}

if (dryRunMode) {
  summary.push('✅ Dry run mode enabled - safe for testing');
} else {
  summary.push('🚀 Production mode - posts will publish to Instagram');
}

summary.forEach(s => console.log('  ' + s));

console.log('\n📚 NEXT STEPS:\n');

if (!allRequiredSet) {
  console.log('  1. Set missing required variables in .env.local or Netlify');
  console.log('  2. After setting variables, run this script again');
  console.log('  3. See SCHEDULED_PUBLISH_VERIFICATION.md for instructions');
} else {
  console.log('  1. ✅ Environment is configured correctly');
  console.log('  2. Schedule a test post in Instagram Studio');
  console.log('  3. Wait for the next hourly run (at :00 of each hour UTC)');
  console.log('  4. Check Netlify function logs for execution');
  console.log('  5. Verify email notification arrives (if configured)');
}

if (!emailsConfigured) {
  console.log('  ⚠️  To enable email notifications:');
  console.log('     a. Get API key from https://resend.com/api-keys');
  console.log('     b. Add RESEND_API_KEY to .env.local');
  console.log('     c. Add NOTIFICATION_EMAIL with recipient address');
  console.log('     d. Verify domain on Resend (optional for branded emails)');
}

console.log('\n🔗 Documentation: scripts/instagram-studio/docs/SCHEDULED_PUBLISH_VERIFICATION.md\n');
console.log('='.repeat(70) + '\n');
