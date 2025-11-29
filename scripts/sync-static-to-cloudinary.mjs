#!/usr/bin/env node

/**
 * Script to upload static files (sitemap.xml, JSON data, robots.txt) to Cloudinary
 * These files are uploaded as "raw" resources to Cloudinary for hosting
 * 
 * Usage: 
 *   npm run sync:static
 *   
 * Environment Variables Required:
 *   CLOUDINARY_CLOUD_NAME - Cloudinary cloud name
 *   CLOUDINARY_API_KEY - Cloudinary API key  
 *   CLOUDINARY_API_SECRET - Cloudinary API secret
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
config({ path: path.resolve(__dirname, '../.env.local') });
config({ path: path.resolve(__dirname, '../.env') });

// Cloudinary credentials
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Static files to sync
const STATIC_FILES = [
  {
    localPath: 'public/sitemap.xml',
    cloudinaryId: 'portfolio-static/sitemap.xml',
    description: 'XML Sitemap'
  },
  {
    localPath: 'public/portfolio-data.json',
    cloudinaryId: 'portfolio-static/portfolio-data.json',
    description: 'Portfolio Data JSON'
  },
  {
    localPath: 'public/share-meta.json',
    cloudinaryId: 'portfolio-static/share-meta.json',
    description: 'Share Meta JSON'
  },
  {
    localPath: 'public/robots.txt',
    cloudinaryId: 'portfolio-static/robots.txt',
    description: 'Robots.txt'
  }
];

// Hash file for change detection
const HASH_FILE = path.resolve(__dirname, '../public/static-files.hash');

/**
 * Calculate MD5 hash of file content
 */
function calculateFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (error) {
    return null;
  }
}

/**
 * Load previous hashes from hash file
 */
function loadPreviousHashes() {
  try {
    if (fs.existsSync(HASH_FILE)) {
      return JSON.parse(fs.readFileSync(HASH_FILE, 'utf-8'));
    }
  } catch (error) {
    console.warn('[static-sync] Could not load previous hashes:', error.message);
  }
  return {};
}

/**
 * Save current hashes to hash file
 */
function saveHashes(hashes) {
  try {
    fs.writeFileSync(HASH_FILE, JSON.stringify(hashes, null, 2), 'utf-8');
    console.log('[static-sync] ✅ Saved file hashes for future change detection');
  } catch (error) {
    console.error('[static-sync] ⚠️ Could not save hashes:', error.message);
  }
}

/**
 * Generate Cloudinary signature for upload
 */
function generateSignature(params) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  return crypto
    .createHash('sha1')
    .update(sortedParams + API_SECRET)
    .digest('hex');
}

/**
 * Upload a file to Cloudinary as raw resource
 */
async function uploadToCloudinary(localPath, publicId) {
  const absolutePath = path.resolve(__dirname, '..', localPath);
  
  if (!fs.existsSync(absolutePath)) {
    console.warn(`[static-sync] ⚠️ File not found: ${localPath}`);
    return { success: false, error: 'File not found' };
  }

  const fileContent = fs.readFileSync(absolutePath);
  const timestamp = Math.floor(Date.now() / 1000);

  // Prepare upload parameters
  const params = {
    public_id: publicId,
    timestamp: timestamp,
    overwrite: 'true',
    invalidate: 'true',
    resource_type: 'raw'
  };

  const signature = generateSignature(params);

  // Create FormData for upload
  const formData = new FormData();
  formData.append('file', new Blob([fileContent]), path.basename(localPath));
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp.toString());
  formData.append('overwrite', 'true');
  formData.append('invalidate', 'true');
  formData.append('signature', signature);
  formData.append('api_key', API_KEY);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error(`[static-sync] ❌ Upload failed for ${localPath}:`, result.error?.message || 'Unknown error');
      return { success: false, error: result.error?.message };
    }

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      version: result.version
    };
  } catch (error) {
    console.error(`[static-sync] ❌ Upload error for ${localPath}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get the Cloudinary URL for a static file
 */
function getCloudinaryUrl(publicId) {
  return `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${publicId}`;
}

/**
 * Main sync function
 */
async function syncStaticFiles(options = {}) {
  const { forceUpload = false, dryRun = false } = options;

  console.log('[static-sync] 🔄 Starting static files sync to Cloudinary...');

  // Validate credentials
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    console.error('[static-sync] ❌ Missing Cloudinary credentials');
    console.error('[static-sync] Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
    process.exit(1);
  }

  console.log(`[static-sync] ☁️  Cloud: ${CLOUD_NAME}`);
  console.log(`[static-sync] 📁 Files to sync: ${STATIC_FILES.length}`);

  // Load previous hashes for change detection
  const previousHashes = loadPreviousHashes();
  const currentHashes = {};
  const results = {
    uploaded: [],
    skipped: [],
    failed: []
  };

  for (const file of STATIC_FILES) {
    const absolutePath = path.resolve(__dirname, '..', file.localPath);
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      console.log(`[static-sync] ⏭️  Skipping ${file.description}: File not found`);
      results.skipped.push({ ...file, reason: 'File not found' });
      continue;
    }

    // Calculate current hash
    const currentHash = calculateFileHash(absolutePath);
    currentHashes[file.localPath] = currentHash;

    // Check if file has changed
    const previousHash = previousHashes[file.localPath];
    const hasChanged = forceUpload || currentHash !== previousHash;

    if (!hasChanged) {
      console.log(`[static-sync] ⏭️  Skipping ${file.description}: No changes`);
      results.skipped.push({ ...file, reason: 'No changes' });
      continue;
    }

    if (dryRun) {
      console.log(`[static-sync] 🔍 Would upload: ${file.description}`);
      results.uploaded.push({ ...file, url: getCloudinaryUrl(file.cloudinaryId) });
      continue;
    }

    // Upload to Cloudinary
    console.log(`[static-sync] 📤 Uploading ${file.description}...`);
    const uploadResult = await uploadToCloudinary(file.localPath, file.cloudinaryId);

    if (uploadResult.success) {
      console.log(`[static-sync] ✅ Uploaded: ${uploadResult.url}`);
      results.uploaded.push({ ...file, url: uploadResult.url });
    } else {
      console.error(`[static-sync] ❌ Failed: ${uploadResult.error}`);
      results.failed.push({ ...file, error: uploadResult.error });
    }
  }

  // Save current hashes if not a dry run
  if (!dryRun) {
    saveHashes(currentHashes);
  }

  // Print summary
  console.log('\n[static-sync] 📊 Summary:');
  console.log(`   Uploaded: ${results.uploaded.length}`);
  console.log(`   Skipped:  ${results.skipped.length}`);
  console.log(`   Failed:   ${results.failed.length}`);

  if (results.uploaded.length > 0) {
    console.log('\n[static-sync] 🔗 Cloudinary URLs:');
    results.uploaded.forEach(file => {
      console.log(`   ${file.description}: ${file.url}`);
    });
  }

  return results;
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const forceUpload = args.includes('--force') || args.includes('-f');
  const dryRun = args.includes('--dry-run') || args.includes('-d');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Static Files to Cloudinary Sync

Usage: node sync-static-to-cloudinary.mjs [options]

Options:
  --force, -f     Force upload all files, ignoring change detection
  --dry-run, -d   Show what would be uploaded without actually uploading
  --help, -h      Show this help message

Environment Variables:
  CLOUDINARY_CLOUD_NAME   Your Cloudinary cloud name
  CLOUDINARY_API_KEY      Your Cloudinary API key
  CLOUDINARY_API_SECRET   Your Cloudinary API secret

Files Synced:
  - sitemap.xml         -> portfolio-static/sitemap.xml
  - portfolio-data.json -> portfolio-static/portfolio-data.json
  - share-meta.json     -> portfolio-static/share-meta.json
  - robots.txt          -> portfolio-static/robots.txt
`);
    process.exit(0);
  }

  try {
    const results = await syncStaticFiles({ forceUpload, dryRun });
    
    if (results.failed.length > 0) {
      process.exit(1);
    }
    
    console.log('\n[static-sync] ✅ Sync complete!');
    process.exit(0);
  } catch (error) {
    console.error('[static-sync] ❌ Sync failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
main();

// Export for use as module
export { syncStaticFiles, getCloudinaryUrl, STATIC_FILES };
