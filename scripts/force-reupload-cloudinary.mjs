#!/usr/bin/env node
/**
 * Force Re-upload All Images to Cloudinary
 * 
 * This script deletes the cloudinary-mapping.json file and re-uploads ALL images
 * at original quality (no transformations). Use this when you need to:
 * - Fix upload quality issues (e.g., switching from WebP Q75 to originals)
 * - Reset Cloudinary cache completely
 * - Re-upload all images after changing upload settings
 * 
 * ⚠️ WARNING: This will re-upload ALL images (~200-300 images), which may take 5-10 minutes
 * and will count against your Cloudinary transformation quota.
 * 
 * Usage:
 *   node scripts/force-reupload-cloudinary.mjs
 */

import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAPPING_FILE = path.resolve(__dirname, '../public/cloudinary-mapping.json');

console.log('🚨 FORCE RE-UPLOAD ALL CLOUDINARY IMAGES\n');
console.log('This will:');
console.log('1. Delete cloudinary-mapping.json');
console.log('2. Force sync-data.mjs to re-upload ALL images');
console.log('3. Upload images at ORIGINAL quality (no WebP/quality transformations)');
console.log('4. May take 5-10 minutes for ~200-300 images\n');

// Check if mapping file exists
if (!existsSync(MAPPING_FILE)) {
  console.log('ℹ️  No cloudinary-mapping.json found - images will upload fresh');
} else {
  console.log('🗑️  Deleting cloudinary-mapping.json...');
  try {
    await unlink(MAPPING_FILE);
    console.log('✅ Deleted cloudinary-mapping.json\n');
  } catch (error) {
    console.error('❌ Failed to delete mapping file:', error.message);
    process.exit(1);
  }
}

console.log('📤 Starting full image sync...\n');
console.log('─'.repeat(60));

try {
  // Run sync-data.mjs which will detect all images as "new" and upload them
  execSync('node scripts/sync-data.mjs', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  });
  
  console.log('\n' + '─'.repeat(60));
  console.log('\n✅ Force re-upload complete!');
  console.log('\nNext steps:');
  console.log('1. Deploy to Netlify to use the new uploads');
  console.log('2. Clear browser cache to see updated images');
  console.log('3. Check a few projects to verify quality improvements\n');
} catch (error) {
  console.error('\n❌ Sync failed:', error.message);
  process.exit(1);
}
