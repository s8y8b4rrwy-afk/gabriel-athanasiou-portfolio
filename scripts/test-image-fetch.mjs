/**
 * Test Script - Preview what images would be optimized
 * This doesn't download anything, just shows what would be processed
 */

import dotenv from 'dotenv';
import Airtable from 'airtable';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AIRTABLE_TOKEN = process.env.VITE_AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;
const OUTPUT_DIR = path.resolve(__dirname, '../public/images/portfolio');

console.log('🔍 Testing Image Optimization System...\n');

// Check credentials
if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
  console.error('❌ Missing Airtable credentials');
  console.log('   Set VITE_AIRTABLE_TOKEN and VITE_AIRTABLE_BASE_ID in .env.local\n');
  process.exit(1);
}

console.log('✓ Airtable credentials found');
console.log(`✓ Output directory: ${OUTPUT_DIR}\n`);

const base = new Airtable({ apiKey: AIRTABLE_TOKEN }).base(AIRTABLE_BASE_ID);

// Get existing optimized images
const getExistingImages = () => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    return new Set();
  }
  const files = fs.readdirSync(OUTPUT_DIR);
  return new Set(files.filter(f => f.endsWith('.webp')).map(f => f.replace('.webp', '')));
};

const extractImageUrls = (record, type) => {
  const urls = [];
  
  if (type === 'project') {
    const gallery = record.get('Gallery');
    if (gallery && Array.isArray(gallery)) {
      gallery.forEach(img => urls.push(img.url));
    }
  } else if (type === 'journal') {
    const coverImage = record.get('Cover Image');
    if (coverImage && coverImage[0]) {
      urls.push(coverImage[0].url);
    }
  }
  
  return urls;
};

try {
  const existingImages = getExistingImages();
  console.log(`📂 Found ${existingImages.size} existing optimized images\n`);
  
  // Fetch Featured Projects
  console.log('📦 Fetching featured projects...');
  const projectRecords = await base('Projects')
    .select({
      filterByFormula: '{Feature} = TRUE()'
    })
    .all();
  
  console.log(`✓ Found ${projectRecords.length} featured projects\n`);
  
  let projectImageCount = 0;
  let newProjectImages = 0;
  
  console.log('Projects:');
  projectRecords.forEach(record => {
    const title = record.get('Name') || 'Untitled';
    const urls = extractImageUrls(record, 'project');
    projectImageCount += urls.length;
    
    const newImages = urls.filter((_, i) => {
      const imageId = `project-${record.id}${urls.length > 1 ? `-${i}` : ''}`;
      return !existingImages.has(imageId);
    });
    
    newProjectImages += newImages.length;
    
    const status = newImages.length > 0 
      ? `🆕 ${newImages.length} new` 
      : `✓ ${urls.length} already optimized`;
    
    console.log(`  - ${title}: ${urls.length} images (${status})`);
  });
  
  // Fetch Journal Entries
  console.log('\n📝 Fetching journal entries...');
  
  try {
    const journalRecords = await base('Journal')
      .select({
        filterByFormula: 'OR({Status} = "Public", {Status} = "Scheduled")'
      })
      .all();
    
    console.log(`✓ Found ${journalRecords.length} public/scheduled journal entries\n`);
    
    let journalImageCount = 0;
    let newJournalImages = 0;
    
    console.log('Journal Entries:');
    journalRecords.forEach(record => {
      const title = record.get('Title') || 'Untitled';
      const urls = extractImageUrls(record, 'journal');
      journalImageCount += urls.length;
      
      const imageId = `journal-${record.id}`;
      const isNew = !existingImages.has(imageId);
      
      if (isNew && urls.length > 0) newJournalImages++;
      
      const status = urls.length === 0 
        ? '⊘ no image'
        : isNew 
          ? '🆕 new' 
          : '✓ already optimized';
      
      console.log(`  - ${title}: ${urls.length} image (${status})`);
    });
    
    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));
    console.log(`\n📦 Projects:`);
    console.log(`   Total: ${projectRecords.length} featured projects`);
    console.log(`   Images: ${projectImageCount} total`);
    console.log(`   New: ${newProjectImages} to optimize`);
    
    console.log(`\n📝 Journal:`);
    console.log(`   Total: ${journalRecords.length} public/scheduled entries`);
    console.log(`   Images: ${journalImageCount} total`);
    console.log(`   New: ${newJournalImages} to optimize`);
    
    console.log(`\n💾 Storage:`);
    console.log(`   Existing: ${existingImages.size} optimized images`);
    console.log(`   Will add: ${newProjectImages + newJournalImages} new images`);
    console.log(`   After optimization: ${existingImages.size + newProjectImages + newJournalImages} total`);
    
    const totalNew = newProjectImages + newJournalImages;
    
    if (totalNew === 0) {
      console.log('\n✅ All images are already optimized!');
      console.log('   No new images to process.\n');
    } else {
      console.log(`\n🔄 Ready to optimize ${totalNew} new images`);
      console.log('   Run: npm run optimize:images\n');
    }
    
  } catch (error) {
    console.warn('\n⚠️  Journal table not found or inaccessible');
    console.log('   Only projects will be optimized\n');
  }
  
} catch (error) {
  console.error('\n❌ Error connecting to Airtable:');
  console.error('   ' + error.message);
  console.log('\nPlease check:');
  console.log('  - VITE_AIRTABLE_TOKEN is correct');
  console.log('  - VITE_AIRTABLE_BASE_ID is correct');
  console.log('  - You have access to the base\n');
  process.exit(1);
}
