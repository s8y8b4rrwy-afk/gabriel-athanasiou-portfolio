#!/usr/bin/env node
/**
 * Upload static JSON files to Cloudinary
 * 
 * Uploads portfolio-data.json, share-meta.json, and sitemap.xml to Cloudinary
 * as "raw" resources so they can be served from CDN.
 * 
 * This script should run after:
 * - npm run build:data (generates portfolio-data.json)
 * - npm run build:content (generates share-meta.json)
 * - npm run build:sitemap (generates sitemap.xml)
 * 
 * Environment variables required:
 * - CLOUDINARY_CLOUD_NAME (or VITE_CLOUDINARY_CLOUD_NAME)
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 */

import { v2 as cloudinary } from 'cloudinary';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenvConfig({ path: path.resolve(__dirname, '../.env.local') });
dotenvConfig({ path: path.resolve(__dirname, '../.env') });

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('❌ Missing Cloudinary credentials');
  console.error('Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  process.exit(1);
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true
});

console.log(`☁️  Cloudinary configured: ${CLOUDINARY_CLOUD_NAME}`);

const PUBLIC_DIR = path.resolve(__dirname, '../public');

// Get portfolio mode from environment
const PORTFOLIO_MODE = process.env.PORTFOLIO_MODE || 'directing';
console.log(`📂 Portfolio mode: ${PORTFOLIO_MODE}`);

// Files to upload as raw resources (portfolio-specific)
const FILES_TO_UPLOAD = [
  {
    localPath: path.join(PUBLIC_DIR, `portfolio-data-${PORTFOLIO_MODE}.json`),
    publicId: `portfolio-static/portfolio-data-${PORTFOLIO_MODE}`,
    description: `Portfolio data file (${PORTFOLIO_MODE})`
  },
  {
    localPath: path.join(PUBLIC_DIR, `share-meta-${PORTFOLIO_MODE}.json`),
    publicId: `portfolio-static/share-meta-${PORTFOLIO_MODE}`,
    description: `Social sharing metadata (${PORTFOLIO_MODE})`
  },
  {
    localPath: path.join(PUBLIC_DIR, `sitemap-${PORTFOLIO_MODE}.xml`),
    publicId: `portfolio-static/sitemap-${PORTFOLIO_MODE}`,
    description: `XML sitemap for SEO (${PORTFOLIO_MODE})`
  },
  {
    localPath: path.join(PUBLIC_DIR, `robots-${PORTFOLIO_MODE}.txt`),
    publicId: `portfolio-static/robots-${PORTFOLIO_MODE}`,
    description: `Robots.txt for search engines (${PORTFOLIO_MODE})`
  }
];

/**
 * Upload a single file to Cloudinary as raw resource
 */
async function uploadRawFile(filePath, publicId, description) {
  try {
    console.log(`📤 Uploading ${description}...`);
    
    // Check if file exists
    await readFile(filePath, 'utf-8');
    
    // Upload as raw resource (non-image file)
    const result = await cloudinary.uploader.upload(filePath, {
      public_id: publicId,
      resource_type: 'raw',
      overwrite: true,
      invalidate: true, // Clear CDN cache
      type: 'upload'
    });
    
    console.log(`✅ ${description} uploaded successfully`);
    console.log(`   URL: ${result.secure_url}`);
    console.log(`   Size: ${(result.bytes / 1024).toFixed(2)} KB`);
    
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      bytes: result.bytes
    };
    
  } catch (error) {
    console.error(`❌ Failed to upload ${description}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting static file upload to Cloudinary...\n');
  
  const results = [];
  let successCount = 0;
  let failCount = 0;
  
  for (const file of FILES_TO_UPLOAD) {
    const result = await uploadRawFile(
      file.localPath,
      file.publicId,
      file.description
    );
    
    results.push({
      file: path.basename(file.localPath),
      ...result
    });
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
    
    console.log(''); // Empty line between uploads
  }
  
  // Summary
  console.log('━'.repeat(60));
  console.log(`📊 Upload Summary: ${successCount} succeeded, ${failCount} failed\n`);
  
  if (successCount > 0) {
    console.log('✅ Successfully uploaded files:');
    results.filter(r => r.success).forEach(r => {
      console.log(`   • ${r.file} → ${r.url}`);
    });
  }
  
  if (failCount > 0) {
    console.log('\n❌ Failed uploads:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   • ${r.file}: ${r.error}`);
    });
    process.exit(1);
  }
  
  console.log('\n🎉 All static files uploaded successfully!');
  console.log(`\n📍 Files are now available at:`);
  console.log(`   https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/raw/upload/portfolio-static/`);
  
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
