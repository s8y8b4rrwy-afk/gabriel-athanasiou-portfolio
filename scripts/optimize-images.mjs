/**
 * Image Optimization Script
 * 
 * Fetches images from Airtable (Featured Projects + Public/Scheduled Journal entries)
 * and optimizes them to WebP format for Netlify CDN delivery.
 * 
 * Only processes NEW or CHANGED images (incremental optimization using metadata).
 */

import dotenv from 'dotenv';
import Airtable from 'airtable';
import sharp from 'sharp';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CONFIGURATION
// ==========================================

const AIRTABLE_TOKEN = process.env.VITE_AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;

const OUTPUT_DIR = path.resolve(__dirname, '../public/images/portfolio');
const METADATA_FILE = path.resolve(__dirname, '../public/images/portfolio/.image-metadata.json');
const IMAGE_WIDTH = 1600; // Max width for optimal quality on retina displays
const IMAGE_QUALITY = 90; // WebP quality (90 = excellent quality, minimal artifacts)

// ==========================================
// UTILITIES
// ==========================================

/**
 * Generate a stable hash from Airtable attachment metadata
 * Used to detect changes in images without relying on URLs which change with each fetch
 */
const generateAttachmentHash = (attachment) => {
  if (!attachment) return null;
  const stableData = {
    id: attachment.id || '',
    filename: attachment.filename || '',
    size: attachment.size || 0,
    type: attachment.type || ''
  };
  return createHash('md5').update(JSON.stringify(stableData)).digest('hex');
};

/**
 * Load metadata cache for change detection
 */
const loadMetadataCache = () => {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const content = fs.readFileSync(METADATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('⚠️  Could not load metadata cache:', error.message);
  }
  return {};
};

/**
 * Save metadata cache
 */
const saveMetadataCache = (cache) => {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.warn('⚠️  Could not save metadata cache:', error.message);
  }
};

/**
 * Ensure output directory exists
 */
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✓ Created directory: ${dirPath}`);
  }
};

/**
 * Download image from URL
 */
const downloadImage = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
};

/**
 * Optimize image to WebP
 */
const optimizeImage = async (buffer, outputPath) => {
  try {
    await sharp(buffer)
      .resize(IMAGE_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: IMAGE_QUALITY })
      .toFile(outputPath);
    
    return true;
  } catch (error) {
    console.error(`✗ Failed to optimize image: ${error.message}`);
    return false;
  }
};

/**
 * Get existing optimized images
 */
const getExistingImages = () => {
  ensureDir(OUTPUT_DIR);
  const files = fs.readdirSync(OUTPUT_DIR);
  return new Set(files.filter(f => f.endsWith('.webp')).map(f => f.replace('.webp', '')));
};

/**
 * Extract image attachments from Airtable record (with full metadata)
 */
const extractImageAttachments = (record, type) => {
  const attachments = [];
  
  if (type === 'project') {
    // Gallery images
    const gallery = record.get('Gallery');
    if (gallery && Array.isArray(gallery)) {
      gallery.forEach(img => attachments.push(img));
    }
  } else if (type === 'journal') {
    // Cover image
    const coverImage = record.get('Cover Image');
    if (coverImage && coverImage[0]) {
      attachments.push(coverImage[0]);
    }
  }
  
  return attachments;
};

// ==========================================
// MAIN LOGIC
// ==========================================

const main = async () => {
  console.log('🖼️  Starting image optimization...\n');
  
  // Check for Airtable credentials
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    console.error('✗ Missing Airtable credentials. Set VITE_AIRTABLE_TOKEN and VITE_AIRTABLE_BASE_ID.');
    process.exit(1);
  }
  
  const base = new Airtable({ apiKey: AIRTABLE_TOKEN }).base(AIRTABLE_BASE_ID);
  
  try {
    // Get existing optimized images and load metadata cache
    const existingImages = getExistingImages();
    const metadataCache = loadMetadataCache();
    console.log(`📂 Found ${existingImages.size} existing optimized images\n`);
    console.log(`📋 Using metadata-based change detection`);
    
    const imagesToProcess = new Map(); // recordId -> { type, attachments }
    
    // ==========================================
    // 1. Fetch Featured Projects
    // ==========================================
    console.log('📦 Fetching featured projects...');
    const projectRecords = await base('Projects')
      .select({
        filterByFormula: '{Feature} = TRUE()'
      })
      .all();
    
    console.log(`✓ Found ${projectRecords.length} featured projects`);
    
    projectRecords.forEach(record => {
      const attachments = extractImageAttachments(record, 'project');
      if (attachments.length > 0) {
        imagesToProcess.set(record.id, { type: 'project', attachments });
      }
    });
    
    // ==========================================
    // 2. Fetch Public/Scheduled Journal Entries
    // ==========================================
    console.log('📝 Fetching journal entries...');
    
    try {
      const journalRecords = await base('Journal')
        .select({
          filterByFormula: 'OR({Status} = "Public", {Status} = "Scheduled")'
        })
        .all();
      
      console.log(`✓ Found ${journalRecords.length} public/scheduled journal entries`);
      
      journalRecords.forEach(record => {
        const attachments = extractImageAttachments(record, 'journal');
        if (attachments.length > 0) {
          imagesToProcess.set(record.id, { type: 'journal', attachments });
        }
      });
    } catch (error) {
      console.warn('⚠️  Journal table not found or accessible, skipping...');
    }
    
    // ==========================================
    // 3. Build Set of Valid Image IDs from Airtable
    // ==========================================
    const validImageIds = new Set();
    for (const [recordId, { type, attachments }] of imagesToProcess) {
      for (let i = 0; i < attachments.length; i++) {
        const imageId = `${type}-${recordId}${attachments.length > 1 ? `-${i}` : ''}`;
        validImageIds.add(imageId);
      }
    }
    
    // ==========================================
    // 4. Clean Up Orphaned Images
    // ==========================================
    console.log(`🧹 Checking for orphaned images...\n`);
    
    let deletedCount = 0;
    for (const existingImageId of existingImages) {
      if (!validImageIds.has(existingImageId)) {
        const filePath = path.join(OUTPUT_DIR, `${existingImageId}.webp`);
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`  🗑️  Deleted orphaned: ${existingImageId}.webp`);
        } catch (error) {
          console.warn(`  ⚠️  Failed to delete: ${existingImageId}.webp`);
        }
      }
    }
    
    if (deletedCount > 0) {
      console.log(`\n✓ Cleaned up ${deletedCount} orphaned image${deletedCount > 1 ? 's' : ''}\n`);
    } else {
      console.log(`✓ No orphaned images found\n`);
    }
    
    // ==========================================
    // 5. Process New/Changed Images (using metadata-based detection)
    // ==========================================
    console.log(`🔄 Processing images...\n`);
    
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const newMetadataCache = {};
    
    for (const [recordId, { type, attachments }] of imagesToProcess) {
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        const url = attachment.url;
        const imageId = `${type}-${recordId}${attachments.length > 1 ? `-${i}` : ''}`;
        const outputPath = path.join(OUTPUT_DIR, `${imageId}.webp`);
        
        // Generate hash from attachment metadata for change detection
        const currentHash = generateAttachmentHash(attachment);
        const cachedHash = metadataCache[imageId];
        
        // Skip if file exists AND metadata hash matches (unchanged)
        // Ensure currentHash is valid before comparing to avoid false positives
        if (existingImages.has(imageId) && currentHash && cachedHash === currentHash) {
          skippedCount++;
          newMetadataCache[imageId] = currentHash; // Preserve in new cache
          continue;
        }
        
        // Log why we're processing this image
        if (existingImages.has(imageId)) {
          console.log(`  🔄 Re-processing (changed): ${imageId}`);
        } else {
          console.log(`  📥 Processing (new): ${imageId}`);
        }
        
        try {
          console.log(`  Downloading: ${imageId}...`);
          const buffer = await downloadImage(url);
          
          console.log(`  Optimizing: ${imageId}...`);
          const success = await optimizeImage(buffer, outputPath);
          
          if (success) {
            processedCount++;
            newMetadataCache[imageId] = currentHash; // Store new hash
            console.log(`  ✓ Saved: ${imageId}.webp\n`);
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`  ✗ Failed: ${imageId} - ${error.message}\n`);
        }
      }
    }
    
    // Save updated metadata cache
    saveMetadataCache(newMetadataCache);
    
    // ==========================================
    // 6. Summary
    // ==========================================
    console.log('\n📊 Summary:');
    console.log(`  ✓ Processed: ${processedCount} new/changed images`);
    console.log(`  ⊘ Skipped: ${skippedCount} unchanged images`);
    if (deletedCount > 0) {
      console.log(`  🗑️  Deleted: ${deletedCount} orphaned images`);
    }
    if (errorCount > 0) {
      console.log(`  ✗ Errors: ${errorCount}`);
    }
    console.log(`  📁 Total optimized images: ${existingImages.size + processedCount - deletedCount}\n`);
    
    console.log('✅ Image optimization complete!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error during image optimization:');
    console.error(error);
    process.exit(1);
  }
};

// Run the script
main();
