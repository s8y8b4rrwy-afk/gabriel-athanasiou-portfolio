#!/usr/bin/env node

/**
 * Test script: Verify Cloudinary configuration and connectivity
 * Usage: npm run test:cloudinary
 */

import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Load .env.local (development) or .env (production)
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env if .env.local doesn't exist

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

console.log('🧪 Testing Cloudinary Setup...\n');

// Check environment variables
console.log('1. Checking environment variables...');
if (!CLOUDINARY_CLOUD_NAME) {
  console.error('   ❌ CLOUDINARY_CLOUD_NAME is missing');
  process.exit(1);
}
if (!CLOUDINARY_API_KEY) {
  console.error('   ❌ CLOUDINARY_API_KEY is missing');
  process.exit(1);
}
if (!CLOUDINARY_API_SECRET) {
  console.error('   ❌ CLOUDINARY_API_SECRET is missing');
  process.exit(1);
}
console.log(`   ✓ CLOUDINARY_CLOUD_NAME: ${CLOUDINARY_CLOUD_NAME}`);
console.log(`   ✓ CLOUDINARY_API_KEY: ${CLOUDINARY_API_KEY.substring(0, 4)}...`);
console.log(`   ✓ CLOUDINARY_API_SECRET: ${CLOUDINARY_API_SECRET.substring(0, 4)}...\n`);

// Configure Cloudinary
console.log('2. Configuring Cloudinary SDK...');
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});
console.log('   ✓ Configuration complete\n');

// Test API connectivity
console.log('3. Testing API connectivity...');
try {
  const result = await cloudinary.api.ping();
  console.log('   ✓ API connection successful');
  console.log(`   Response: ${result.status}\n`);
} catch (error) {
  console.error('   ❌ API connection failed:', error.message);
  console.error('   Error details:', error.error || error);
  if (error.http_code) {
    console.error(`   HTTP Code: ${error.http_code}`);
  }
  process.exit(1);
}

// Test upload with a sample image URL
console.log('4. Testing image upload...');
const testImageUrl = 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400';
const testPublicId = `test-upload-${Date.now()}`;

try {
  console.log(`   Uploading test image: ${testImageUrl}`);
  const uploadResult = await cloudinary.uploader.upload(testImageUrl, {
    public_id: testPublicId,
    folder: '', // Root folder
    overwrite: true,
    resource_type: 'image',
    transformation: [
      { width: 400, crop: 'limit' }
    ]
  });

  console.log('   ✓ Upload successful');
  console.log(`   Public ID: ${uploadResult.public_id}`);
  console.log(`   URL: ${uploadResult.secure_url}`);
  console.log(`   Format: ${uploadResult.format}`);
  console.log(`   Size: ${(uploadResult.bytes / 1024).toFixed(1)} KB\n`);

  // Clean up test image
  console.log('5. Cleaning up test image...');
  await cloudinary.uploader.destroy(testPublicId);
  console.log('   ✓ Test image deleted\n');

} catch (error) {
  console.error('   ❌ Upload failed:', error.message);
  if (error.http_code) {
    console.error(`   HTTP Code: ${error.http_code}`);
  }
  process.exit(1);
}

// Test URL generation
console.log('6. Testing URL generation...');
const samplePublicId = 'portfolio-projects-rec123-0';
const generatedUrl = cloudinary.url(samplePublicId, {
  transformation: [
    { format: 'auto', quality: 'auto:good', width: 1200, crop: 'limit' }
  ]
});
console.log(`   Sample URL: ${generatedUrl}`);
console.log('   ✓ URL generation working\n');

// Summary
console.log('✅ All tests passed!\n');
console.log('📋 Summary:');
console.log('   • Cloudinary credentials configured correctly');
console.log('   • API connectivity verified');
console.log('   • Image upload working');
console.log('   • URL generation working');
console.log('\n🚀 Ready to run migration: npm run migrate:cloudinary');
