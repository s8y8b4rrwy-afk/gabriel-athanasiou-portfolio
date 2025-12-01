#!/usr/bin/env node
/**
 * Upload Settings/Config images to Cloudinary
 * 
 * This script uploads profile images and OG images from the Settings table
 * to Cloudinary and updates the cloudinary-mapping.json file.
 * 
 * Environment variables required:
 * - AIRTABLE_TOKEN (or VITE_AIRTABLE_TOKEN)
 * - AIRTABLE_BASE_ID (or VITE_AIRTABLE_BASE_ID)
 * - CLOUDINARY_CLOUD_NAME (or VITE_CLOUDINARY_CLOUD_NAME)
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 */

import { v2 as cloudinary } from 'cloudinary';
import { readFile, writeFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';
import Airtable from 'airtable';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenvConfig({ path: path.resolve(__dirname, '../.env.local') });
dotenvConfig({ path: path.resolve(__dirname, '../.env') });

// Airtable configuration
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.VITE_AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID || '';

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

// Validate environment variables
if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
  console.error('❌ Missing Airtable credentials (AIRTABLE_TOKEN, AIRTABLE_BASE_ID)');
  process.exit(1);
}

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('❌ Missing Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)');
  process.exit(1);
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true
});

const PUBLIC_DIR = path.resolve(__dirname, '../public');
const CLOUDINARY_MAPPING_PATH = path.join(PUBLIC_DIR, 'cloudinary-mapping.json');

/**
 * Load existing Cloudinary mapping
 */
async function loadCloudinaryMapping() {
  try {
    if (fs.existsSync(CLOUDINARY_MAPPING_PATH)) {
      const content = await readFile(CLOUDINARY_MAPPING_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('⚠️  Could not load existing Cloudinary mapping:', error.message);
  }
  
  return {
    generatedAt: new Date().toISOString(),
    projects: [],
    journal: []
  };
}

/**
 * Save updated Cloudinary mapping
 */
async function saveCloudinaryMapping(mapping) {
  mapping.generatedAt = new Date().toISOString();
  await writeFile(
    CLOUDINARY_MAPPING_PATH,
    JSON.stringify(mapping, null, 2),
    'utf-8'
  );
  console.log(`✅ Updated cloudinary-mapping.json`);
}

/**
 * Upload image to Cloudinary
 */
async function uploadToCloudinary(imageUrl, publicId, description) {
  try {
    console.log(`📤 Uploading ${description}...`);
    console.log(`   Source: ${imageUrl.substring(0, 80)}...`);
    
    const result = await cloudinary.uploader.upload(imageUrl, {
      public_id: publicId,
      resource_type: 'image',
      overwrite: true,
      invalidate: true, // Clear CDN cache
      type: 'upload'
    });
    
    console.log(`✅ ${description} uploaded successfully`);
    console.log(`   URL: ${result.secure_url}`);
    console.log(`   Size: ${(result.bytes / 1024).toFixed(2)} KB`);
    console.log(`   Format: ${result.format}`);
    
    return {
      success: true,
      publicId: result.public_id,
      cloudinaryUrl: result.secure_url,
      originalUrl: imageUrl,
      format: result.format,
      size: result.bytes
    };
  } catch (error) {
    console.error(`❌ Failed to upload ${description}:`, error.message);
    return {
      success: false,
      error: error.message,
      originalUrl: imageUrl
    };
  }
}

/**
 * Fetch Settings table from Airtable
 */
async function fetchSettings() {
  console.log('📥 Fetching Settings from Airtable...');
  
  const base = new Airtable({ apiKey: AIRTABLE_TOKEN }).base(AIRTABLE_BASE_ID);
  const records = await base('Settings').select().all();
  
  console.log(`✅ Fetched ${records.length} settings records`);
  return records;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting config image upload to Cloudinary...\n');
  
  // Fetch settings from Airtable
  const settingsRecords = await fetchSettings();
  
  if (settingsRecords.length === 0) {
    console.warn('⚠️  No settings records found in Airtable');
    process.exit(0);
  }
  
  // Get first settings record (should only be one)
  const settings = settingsRecords[0];
  const fields = settings.fields || {};
  
  // Load existing mapping
  const mapping = await loadCloudinaryMapping();
  
  // Initialize config section if it doesn't exist
  if (!mapping.config) {
    mapping.config = {
      recordId: settings.id,
      images: []
    };
  }
  
  const imagesToUpload = [];
  
  // Profile/About Image
  if (fields['About Image'] && Array.isArray(fields['About Image']) && fields['About Image'].length > 0) {
    const attachment = fields['About Image'][0];
    imagesToUpload.push({
      type: 'profile',
      publicId: 'portfolio-config-aboutImage',
      description: 'Profile/About Image',
      url: attachment.url,
      airtableId: attachment.id
    });
  }
  
  // Default OG Image
  if (fields['Default OG Image'] && Array.isArray(fields['Default OG Image']) && fields['Default OG Image'].length > 0) {
    const attachment = fields['Default OG Image'][0];
    imagesToUpload.push({
      type: 'defaultOg',
      publicId: 'portfolio-config-defaultOgImage',
      description: 'Default OG Image',
      url: attachment.url,
      airtableId: attachment.id
    });
  }
  
  // Showreel Placeholder
  if (fields['Showreel Placeholder'] && Array.isArray(fields['Showreel Placeholder']) && fields['Showreel Placeholder'].length > 0) {
    const attachment = fields['Showreel Placeholder'][0];
    imagesToUpload.push({
      type: 'showreel',
      publicId: 'portfolio-config-showreelPlaceholder',
      description: 'Showreel Placeholder',
      url: attachment.url,
      airtableId: attachment.id
    });
  }
  
  if (imagesToUpload.length === 0) {
    console.warn('⚠️  No config images found to upload');
    process.exit(0);
  }
  
  console.log(`\n📊 Found ${imagesToUpload.length} config images to upload\n`);
  
  // Upload images
  const results = [];
  for (const imageInfo of imagesToUpload) {
    const result = await uploadToCloudinary(
      imageInfo.url,
      imageInfo.publicId,
      imageInfo.description
    );
    
    if (result.success) {
      // Add to mapping
      const existingIndex = mapping.config.images.findIndex(img => img.type === imageInfo.type);
      const imageEntry = {
        type: imageInfo.type,
        publicId: result.publicId,
        cloudinaryUrl: result.cloudinaryUrl,
        originalUrl: result.originalUrl,
        airtableId: imageInfo.airtableId,
        format: result.format,
        size: result.size
      };
      
      if (existingIndex >= 0) {
        mapping.config.images[existingIndex] = imageEntry;
      } else {
        mapping.config.images.push(imageEntry);
      }
    }
    
    results.push({
      description: imageInfo.description,
      ...result
    });
    
    console.log(''); // Empty line between uploads
  }
  
  // Save updated mapping
  await saveCloudinaryMapping(mapping);
  
  // Summary
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log('\n' + '━'.repeat(60));
  console.log(`📊 Upload Summary: ${successCount} succeeded, ${failCount} failed\n`);
  
  if (successCount > 0) {
    console.log('✅ Successfully uploaded config images:');
    results.filter(r => r.success).forEach(r => {
      console.log(`   - ${r.description}`);
      console.log(`     ${r.cloudinaryUrl}`);
    });
  }
  
  if (failCount > 0) {
    console.log('\n❌ Failed uploads:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.description}: ${r.error}`);
    });
  }
  
  console.log('\n💡 Next steps:');
  console.log('   1. Run: npm run build:data');
  console.log('   2. The sync will now use permanent Cloudinary URLs for config images');
  console.log('   3. Deploy to production\n');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
