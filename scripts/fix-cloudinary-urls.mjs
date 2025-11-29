#!/usr/bin/env node
// Quick fix: Replace Airtable URLs with Cloudinary URLs in both portfolio-data.json and share-meta.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const PORTFOLIO_DATA = path.join(PUBLIC_DIR, 'portfolio-data.json');
const SHARE_META = path.join(PUBLIC_DIR, 'share-meta.json');
const CLOUDINARY_MAPPING = path.join(PUBLIC_DIR, 'cloudinary-mapping.json');

console.log('[fix-urls] 🔄 Updating all data files with Cloudinary URLs...');

// Load files
const portfolioData = JSON.parse(fs.readFileSync(PORTFOLIO_DATA, 'utf8'));
const shareMetaData = JSON.parse(fs.readFileSync(SHARE_META, 'utf8'));
const cloudinaryMapping = JSON.parse(fs.readFileSync(CLOUDINARY_MAPPING, 'utf8'));

// Build lookup maps
const cloudinaryMap = {};
cloudinaryMapping.projects.forEach(project => {
  cloudinaryMap[project.recordId] = project.images || [];
});

const journalMap = {};
if (cloudinaryMapping.journal) {
  cloudinaryMapping.journal.forEach(post => {
    journalMap[post.recordId] = post.images || [];
  });
}

// Update portfolio-data.json projects
let portfolioProjectCount = 0;
portfolioData.projects.forEach(project => {
  const cloudinaryImages = cloudinaryMap[project.id] || [];
  
  if (cloudinaryImages.length > 0) {
    const newGallery = cloudinaryImages.map(img => img.cloudinaryUrl);
    
    if (JSON.stringify(project.gallery) !== JSON.stringify(newGallery)) {
      project.gallery = newGallery;
      project.heroImage = newGallery[0] || project.heroImage;
      portfolioProjectCount++;
      console.log(`[fix-urls] ✅ Portfolio: ${project.title} (${project.id})`);
    }
  }
});

// Update share-meta.json projects
let shareMetaProjectCount = 0;
shareMetaData.projects.forEach(project => {
  const cloudinaryImages = cloudinaryMap[project.id] || [];
  
  if (cloudinaryImages.length > 0 && cloudinaryImages[0]?.cloudinaryUrl) {
    const newImage = cloudinaryImages[0].cloudinaryUrl;
    
    if (project.image !== newImage) {
      project.image = newImage;
      shareMetaProjectCount++;
      console.log(`[fix-urls] ✅ Share Meta: ${project.title} (${project.id})`);
    }
  }
});

// Update share-meta.json journal posts
let shareMetaPostCount = 0;
if (shareMetaData.posts) {
  shareMetaData.posts.forEach(post => {
    const cloudinaryImages = journalMap[post.id] || [];
    
    if (cloudinaryImages.length > 0 && cloudinaryImages[0]?.cloudinaryUrl) {
      const newImage = cloudinaryImages[0].cloudinaryUrl;
      
      if (post.image && post.image.includes('airtableusercontent.com')) {
        post.image = newImage;
        shareMetaPostCount++;
        console.log(`[fix-urls] ✅ Share Meta Post: ${post.title} (${post.id})`);
      }
    }
  });
}

// Update portfolio-data.json posts
let portfolioPostCount = 0;
if (portfolioData.posts) {
  portfolioData.posts.forEach(post => {
    const cloudinaryImages = journalMap[post.id] || [];
    
    if (cloudinaryImages.length > 0 && cloudinaryImages[0]?.cloudinaryUrl) {
      const newImage = cloudinaryImages[0].cloudinaryUrl;
      
      if (post.coverImage && post.coverImage.includes('airtableusercontent.com')) {
        post.coverImage = newImage;
        portfolioPostCount++;
        console.log(`[fix-urls] ✅ Portfolio Post coverImage: ${post.title} (${post.id})`);
      }
      
      if (post.imageUrl && post.imageUrl.includes('airtableusercontent.com')) {
        post.imageUrl = newImage;
        portfolioPostCount++;
        console.log(`[fix-urls] ✅ Portfolio Post imageUrl: ${post.title} (${post.id})`);
      }
    }
  });
}

// Update config images
let configCount = 0;
if (portfolioData.config) {
  // Replace profileImage if it's an Airtable URL
  if (portfolioData.config.about?.profileImage?.includes('airtableusercontent.com')) {
    // Use first available project image as fallback
    const firstProjectWithImage = portfolioData.projects.find(p => p.heroImage && !p.heroImage.includes('airtableusercontent.com'));
    if (firstProjectWithImage) {
      portfolioData.config.about.profileImage = firstProjectWithImage.heroImage;
      configCount++;
      console.log('[fix-urls] ✅ Updated profile image');
    }
  }
  
  // Replace defaultOgImage if it's an Airtable URL
  if (portfolioData.config.defaultOgImage?.includes('airtableusercontent.com')) {
    const firstProjectWithImage = portfolioData.projects.find(p => p.heroImage && !p.heroImage.includes('airtableusercontent.com'));
    if (firstProjectWithImage) {
      portfolioData.config.defaultOgImage = firstProjectWithImage.heroImage;
      configCount++;
      console.log('[fix-urls] ✅ Updated default OG image in portfolio config');
    }
  }
}

// Update default OG image in share-meta config
if (shareMetaData.config?.defaultOgImage?.includes('airtableusercontent.com')) {
  // Use a default Cloudinary image or first available project image
  const firstProjectWithImage = shareMetaData.projects.find(p => p.image && !p.image.includes('airtableusercontent.com'));
  if (firstProjectWithImage) {
    shareMetaData.config.defaultOgImage = firstProjectWithImage.image;
    console.log('[fix-urls] ✅ Updated default OG image');
  }
}

// Save updated data
fs.writeFileSync(PORTFOLIO_DATA, JSON.stringify(portfolioData, null, 2), 'utf8');
fs.writeFileSync(SHARE_META, JSON.stringify(shareMetaData, null, 2), 'utf8');

console.log('\n[fix-urls] ✅ Summary:');
console.log(`  - Portfolio projects: ${portfolioProjectCount} updated`);
console.log(`  - Portfolio posts: ${portfolioPostCount} updated`);
console.log(`  - Portfolio config: ${configCount} updated`);
console.log(`  - Share meta projects: ${shareMetaProjectCount} updated`);
console.log(`  - Share meta posts: ${shareMetaPostCount} updated`);
