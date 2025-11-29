#!/usr/bin/env node

/**
 * One-time migration script: Upload existing images from Airtable to Cloudinary
 * Run this once during initial Cloudinary setup
 * Usage: npm run migrate:cloudinary
 */

import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env.local (development) or .env (production)
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env if .env.local doesn't exist

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const AIRTABLE_TOKEN = process.env.VITE_AIRTABLE_TOKEN || process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Validate environment variables
if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
  console.error('❌ Missing Airtable credentials (AIRTABLE_TOKEN, AIRTABLE_BASE_ID)');
  process.exit(1);
}

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('❌ Missing Cloudinary credentials');
  console.error('   Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  process.exit(1);
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});

// Fetch Airtable table with pagination
async function fetchAirtableTable(tableName, sortField) {
  const sortParam = sortField
    ? `&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(sortField)}&sort%5B0%5D%5Bdirection%5D=desc`
    : '';

  let allRecords = [];
  let offset = null;

  do {
    const offsetParam = offset ? `&offset=${offset}` : '';
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?${sortParam}${offsetParam}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    if (!res.ok) {
      console.warn(`⚠️  Table fetch failed: ${tableName} (${res.status})`);
      return [];
    }

    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

// Upload single image to Cloudinary
async function uploadToCloudinary(imageUrl, publicId, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await cloudinary.uploader.upload(imageUrl, {
        public_id: publicId,
        folder: '', // Use empty folder since public_id contains full path
        overwrite: true,
        resource_type: 'image',
        format: 'webp', // Convert to WebP during upload
        quality: 75, // Fine preset quality
        transformation: [
          { width: 1600, crop: 'limit' } // Max width 1600px
        ]
      });

      return {
        success: true,
        publicId: result.public_id,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes
      };
    } catch (error) {
      if (attempt === retries) {
        return {
          success: false,
          error: error.message
        };
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Main migration function
async function migrate() {
  console.log('🚀 Starting Cloudinary Migration...\n');

  const stats = {
    totalImages: 0,
    uploaded: 0,
    failed: 0,
    skipped: 0
  };

  const mapping = {
    generatedAt: new Date().toISOString(),
    projects: [],
    journal: []
  };

  // Fetch Projects
  console.log('📦 Fetching featured projects from Airtable...');
  const projectRecords = await fetchAirtableTable('Projects', 'Release Date');
  const featuredProjects = projectRecords.filter(r => r.fields?.['Feature']);
  console.log(`✓ Found ${featuredProjects.length} featured projects\n`);

  // Process project images
  console.log('⬆️  Uploading project images...');
  for (const record of featuredProjects) {
    const fields = record.fields;
    const gallery = fields['Gallery'] || [];
    const projectMapping = {
      recordId: record.id,
      title: fields['Name'] || 'Untitled',
      images: []
    };

    for (let i = 0; i < gallery.length; i++) {
      const imageUrl = gallery[i].url;
      const publicId = `portfolio-projects-${record.id}-${i}`;

      process.stdout.write(`  Uploading: ${publicId}...`);
      stats.totalImages++;

      const result = await uploadToCloudinary(imageUrl, publicId);

      if (result.success) {
        stats.uploaded++;
        process.stdout.write(` ✓ (${(result.bytes / 1024).toFixed(1)} KB)\n`);

        projectMapping.images.push({
          index: i,
          publicId: result.publicId,
          cloudinaryUrl: result.secureUrl,
          originalUrl: imageUrl,
          format: result.format,
          size: result.bytes
        });
      } else {
        stats.failed++;
        process.stdout.write(` ✗ (${result.error})\n`);
      }

      // Rate limiting: pause briefly between uploads
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (projectMapping.images.length > 0) {
      mapping.projects.push(projectMapping);
    }
  }

  console.log();

  // Fetch Journal
  console.log('📝 Fetching journal entries from Airtable...');
  const journalRecords = await fetchAirtableTable('Journal', 'Date');
  const now = new Date();
  const publicJournal = journalRecords.filter(r => {
    const status = r.fields?.['Status'] || 'Draft';
    if (status === 'Public') return true;
    if (status === 'Scheduled' && r.fields?.['Date']) {
      return new Date(r.fields['Date']) <= now;
    }
    return false;
  });
  console.log(`✓ Found ${publicJournal.length} public/scheduled journal entries\n`);

  // Process journal images
  console.log('⬆️  Uploading journal images...');
  for (const record of publicJournal) {
    const fields = record.fields;
    const coverImage = fields['Cover Image']?.[0];

    if (!coverImage) continue;

    const imageUrl = coverImage.url;
    const publicId = `portfolio-journal-${record.id}`;

    process.stdout.write(`  Uploading: ${publicId}...`);
    stats.totalImages++;

    const result = await uploadToCloudinary(imageUrl, publicId);

    if (result.success) {
      stats.uploaded++;
      process.stdout.write(` ✓ (${(result.bytes / 1024).toFixed(1)} KB)\n`);

      mapping.journal.push({
        recordId: record.id,
        title: fields['Title'] || 'Untitled',
        publicId: result.publicId,
        cloudinaryUrl: result.secureUrl,
        originalUrl: imageUrl,
        format: result.format,
        size: result.bytes
      });
    } else {
      stats.failed++;
      process.stdout.write(` ✗ (${result.error})\n`);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log();

  // Save mapping to file
  const mappingPath = path.join(__dirname, '..', 'public', 'cloudinary-mapping.json');
  fs.mkdirSync(path.dirname(mappingPath), { recursive: true });
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2), 'utf-8');

  // Print summary
  console.log('✅ Migration complete!\n');
  console.log('📊 Summary:');
  console.log(`  Total images: ${stats.totalImages}`);
  console.log(`  Uploaded: ${stats.uploaded} ✓`);
  console.log(`  Failed: ${stats.failed} ✗`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`\n📁 Mapping saved to: ${mappingPath}`);

  if (stats.failed > 0) {
    console.log('\n⚠️  Some images failed to upload. Check the errors above.');
    console.log('   You can re-run this script to retry failed uploads.');
  }

  console.log('\n🎯 Next Steps:');
  console.log('  1. Review cloudinary-mapping.json');
  console.log('  2. Check Cloudinary Dashboard for uploaded images');
  console.log('  3. Deploy with USE_CLOUDINARY=false to test infrastructure');
  console.log('  4. Enable USE_CLOUDINARY=true when ready');
}

// Run migration
migrate().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
