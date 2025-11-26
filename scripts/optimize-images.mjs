/**
 * Image Optimization Script
 * 
 * Fetches images from Airtable (Featured Projects + Public/Scheduled Journal entries)
 * and optimizes them to WebP format for Netlify CDN delivery.
 * 
 * Only processes NEW images (incremental optimization).
 */

import dotenv from 'dotenv';
import Airtable from 'airtable';
import sharp from 'sharp';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
const IMAGE_WIDTH = 1600; // Max width for optimized images (good for retina)
const IMAGE_QUALITY = 92; // WebP quality (90-95 is visually lossless)

// ==========================================
// UTILITIES
// ==========================================

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
 * Extract image URLs from Airtable record
 */
const extractImageUrls = (record, type) => {
  const urls = [];
  
  if (type === 'project') {
    // Gallery images
    const gallery = record.get('Gallery');
    if (gallery && Array.isArray(gallery)) {
      gallery.forEach(img => urls.push(img.url));
    }
  } else if (type === 'journal') {
    // Cover image
    const coverImage = record.get('Cover Image');
    if (coverImage && coverImage[0]) {
      urls.push(coverImage[0].url);
    }
  }
  
  return urls;
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
    // Get existing optimized images
    const existingImages = getExistingImages();
    console.log(`📂 Found ${existingImages.size} existing optimized images\n`);
    
    const imagesToProcess = new Map(); // recordId -> { type, urls }
    
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
      const urls = extractImageUrls(record, 'project');
      if (urls.length > 0) {
        imagesToProcess.set(record.id, { type: 'project', urls });
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
        const urls = extractImageUrls(record, 'journal');
        if (urls.length > 0) {
          imagesToProcess.set(record.id, { type: 'journal', urls });
        }
      });
    } catch (error) {
      console.warn('⚠️  Journal table not found or accessible, skipping...');
    }
    
    // ==========================================
    // 3. Process New Images
    // ==========================================
    console.log(`\n🔄 Processing images...\n`);
    
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const [recordId, { type, urls }] of imagesToProcess) {
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const imageId = `${type}-${recordId}${urls.length > 1 ? `-${i}` : ''}`;
        const outputPath = path.join(OUTPUT_DIR, `${imageId}.webp`);
        
        // Skip if already optimized
        if (existingImages.has(imageId)) {
          skippedCount++;
          continue;
        }
        
        try {
          console.log(`  Downloading: ${imageId}...`);
          const buffer = await downloadImage(url);
          
          console.log(`  Optimizing: ${imageId}...`);
          const success = await optimizeImage(buffer, outputPath);
          
          if (success) {
            processedCount++;
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
    
    // ==========================================
    // 4. Summary
    // ==========================================
    console.log('\n📊 Summary:');
    console.log(`  ✓ Processed: ${processedCount} new images`);
    console.log(`  ⊘ Skipped: ${skippedCount} existing images`);
    if (errorCount > 0) {
      console.log(`  ✗ Errors: ${errorCount}`);
    }
    console.log(`  📁 Total optimized images: ${existingImages.size + processedCount}\n`);
    
    console.log('✅ Image optimization complete!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error during image optimization:');
    console.error(error);
    process.exit(1);
  }
};

// Run the script
main();
