#!/usr/bin/env node
/**
 * Script to fix Airtable URLs in Instagram Studio data by replacing them with Cloudinary URLs
 * from the cloudinary-mapping.json file.
 * 
 * The Instagram Studio data is stored in Cloudinary at:
 * https://res.cloudinary.com/date24ay6/raw/upload/instagram-studio/schedule-data
 * 
 * After fixing, the script uploads the corrected data back to Cloudinary.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'date24ay6',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Load the Cloudinary mapping
const mappingPath = path.join(PUBLIC_DIR, 'cloudinary-mapping.json');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

// Build a lookup by record ID -> array of cloudinary URLs (indexed)
const recordToCloudinaryUrls = {};
for (const project of mapping.projects) {
  recordToCloudinaryUrls[project.recordId] = {
    title: project.title,
    images: project.images.map(img => img.cloudinaryUrl)
  };
}

console.log(`📦 Loaded ${mapping.projects.length} projects from Cloudinary mapping`);

/**
 * Check if a URL is an Airtable URL
 */
function isAirtableUrl(url) {
  return url && typeof url === 'string' && url.includes('airtableusercontent.com');
}

/**
 * Find the Cloudinary URL for an Airtable URL based on the project ID and gallery index
 */
function findCloudinaryUrl(airtableUrl, projectId, galleryIndex = 0) {
  const cloudinaryData = recordToCloudinaryUrls[projectId];
  if (!cloudinaryData || !cloudinaryData.images) return null;
  
  // Try to find by index
  if (galleryIndex < cloudinaryData.images.length) {
    return cloudinaryData.images[galleryIndex];
  }
  
  return null;
}

/**
 * Fix URLs in a project object
 */
function fixProjectUrls(project) {
  if (!project || !project.id) return { fixed: 0, remaining: 0 };
  
  let fixed = 0;
  let remaining = 0;
  const projectId = project.id;
  const cloudinaryData = recordToCloudinaryUrls[projectId];
  
  // Fix heroImage
  if (isAirtableUrl(project.heroImage)) {
    if (cloudinaryData && cloudinaryData.images.length > 0) {
      console.log(`  🔧 Fixing heroImage for "${project.title}"`);
      project.heroImage = cloudinaryData.images[0];
      fixed++;
    } else {
      console.log(`  ⚠️ No mapping for heroImage: "${project.title}" (${projectId})`);
      remaining++;
    }
  }
  
  // Fix gallery
  if (project.gallery && Array.isArray(project.gallery)) {
    for (let i = 0; i < project.gallery.length; i++) {
      if (isAirtableUrl(project.gallery[i])) {
        const newUrl = findCloudinaryUrl(project.gallery[i], projectId, i);
        if (newUrl) {
          console.log(`  🔧 Fixing gallery[${i}] for "${project.title}"`);
          project.gallery[i] = newUrl;
          fixed++;
        } else {
          console.log(`  ⚠️ No mapping for gallery[${i}]: "${project.title}" (${projectId})`);
          remaining++;
        }
      }
    }
  }
  
  return { fixed, remaining };
}

/**
 * Fix URLs in selectedImages array (can contain Airtable URLs that need to be mapped)
 */
function fixSelectedImages(selectedImages, projectId, project) {
  if (!selectedImages || !Array.isArray(selectedImages)) return { fixed: 0, remaining: 0 };
  
  let fixed = 0;
  let remaining = 0;
  const cloudinaryData = recordToCloudinaryUrls[projectId];
  
  for (let i = 0; i < selectedImages.length; i++) {
    if (isAirtableUrl(selectedImages[i])) {
      // Try to find the corresponding Cloudinary URL
      // First, try to match by finding the index in the original gallery
      if (project && project.gallery) {
        // The old gallery might have had Airtable URLs, so we use position
        const newUrl = cloudinaryData?.images?.[i];
        if (newUrl) {
          console.log(`  🔧 Fixing selectedImages[${i}] for project "${project?.title}"`);
          selectedImages[i] = newUrl;
          fixed++;
        } else if (cloudinaryData?.images?.length > 0) {
          // If we can't match by index, use the first image
          console.log(`  🔧 Fixing selectedImages[${i}] with fallback for project "${project?.title}"`);
          selectedImages[i] = cloudinaryData.images[0];
          fixed++;
        } else {
          console.log(`  ⚠️ No mapping for selectedImages[${i}]: "${project?.title}" (${projectId})`);
          remaining++;
        }
      } else {
        remaining++;
      }
    }
  }
  
  return { fixed, remaining };
}

/**
 * Fix a draft or scheduled post
 */
function fixPost(post) {
  let totalFixed = 0;
  let totalRemaining = 0;
  
  // Fix embedded project
  if (post.project) {
    const result = fixProjectUrls(post.project);
    totalFixed += result.fixed;
    totalRemaining += result.remaining;
  }
  
  // Fix selectedImages
  if (post.selectedImages) {
    const result = fixSelectedImages(post.selectedImages, post.projectId, post.project);
    totalFixed += result.fixed;
    totalRemaining += result.remaining;
  }
  
  return { fixed: totalFixed, remaining: totalRemaining };
}

async function main() {
  console.log('\n🔄 Fetching Instagram Studio data from Cloudinary...');
  
  // Fetch the current data from Cloudinary
  const response = await fetch('https://res.cloudinary.com/date24ay6/raw/upload/instagram-studio/schedule-data');
  if (!response.ok) {
    throw new Error(`Failed to fetch Instagram Studio data: ${response.status}`);
  }
  
  const data = await response.json();
  console.log(`✅ Fetched data (version: ${data.version})`);
  
  let totalFixed = 0;
  let totalRemaining = 0;
  
  // Fix drafts
  if (data.drafts && Array.isArray(data.drafts)) {
    console.log(`\n📝 Processing ${data.drafts.length} drafts...`);
    for (const draft of data.drafts) {
      const result = fixPost(draft);
      totalFixed += result.fixed;
      totalRemaining += result.remaining;
    }
  }
  
  // Fix scheduled posts
  if (data.scheduledPosts && Array.isArray(data.scheduledPosts)) {
    console.log(`\n📅 Processing ${data.scheduledPosts.length} scheduled posts...`);
    for (const post of data.scheduledPosts) {
      const result = fixPost(post);
      totalFixed += result.fixed;
      totalRemaining += result.remaining;
    }
  }
  
  // Fix published posts
  if (data.publishedPosts && Array.isArray(data.publishedPosts)) {
    console.log(`\n✅ Processing ${data.publishedPosts.length} published posts...`);
    for (const post of data.publishedPosts) {
      const result = fixPost(post);
      totalFixed += result.fixed;
      totalRemaining += result.remaining;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Fixed: ${totalFixed} URLs`);
  console.log(`   ⚠️ Remaining Airtable URLs: ${totalRemaining}`);
  
  if (totalFixed === 0 && totalRemaining === 0) {
    console.log('\n✨ No Airtable URLs found - data is already clean!');
    return;
  }
  
  if (totalFixed > 0) {
    // Update the timestamp
    data.exportedAt = new Date().toISOString();
    data.lastFixedAt = new Date().toISOString();
    
    // Save locally first for backup
    const backupPath = path.join(PUBLIC_DIR, 'instagram-studio-data-backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
    console.log(`\n💾 Saved backup to: ${backupPath}`);
    
    // Upload back to Cloudinary
    console.log('\n☁️ Uploading fixed data to Cloudinary...');
    
    // Create a temp file for upload
    const tempPath = path.join(PUBLIC_DIR, 'instagram-studio-data-fixed.json');
    fs.writeFileSync(tempPath, JSON.stringify(data));
    
    const result = await cloudinary.uploader.upload(tempPath, {
      public_id: 'instagram-studio/schedule-data',
      resource_type: 'raw',
      overwrite: true,
      invalidate: true,
    });
    
    // Clean up temp file
    fs.unlinkSync(tempPath);
    
    console.log(`✅ Uploaded to Cloudinary: ${result.secure_url}`);
    console.log(`   Version: ${result.version}`);
  }
  
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
