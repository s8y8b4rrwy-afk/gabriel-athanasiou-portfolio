#!/usr/bin/env node
// Fix Cloudinary URLs to use "fine" preset instead of auto settings
// Rebuilds URLs with q_75,w_1600 transformations

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const PORTFOLIO_DATA = path.join(PUBLIC_DIR, 'portfolio-data.json');
const SHARE_META = path.join(PUBLIC_DIR, 'share-meta.json');
const CLOUDINARY_MAPPING = path.join(PUBLIC_DIR, 'cloudinary-mapping.json');

const CLOUDINARY_CLOUD_NAME = 'date24ay6'; // Your cloud name
const FINE_PRESET = 'q_75,w_1600,c_limit,f_auto,dpr_auto'; // Fine preset transformations

console.log('[fix-preset] 🔧 Rebuilding Cloudinary URLs with "fine" preset...\n');

// Convert Cloudinary URL from auto to fine preset
function rebuildUrl(url) {
  if (!url || !url.includes('cloudinary.com')) return url;
  
  // Extract public ID from URL
  // Format: https://res.cloudinary.com/{cloud}/image/upload/{transformations}/{publicId}
  const match = url.match(/\/image\/upload\/([^/]+)\/(.+)$/);
  if (!match) return url;
  
  const publicId = match[2];
  
  // Rebuild with fine preset
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${FINE_PRESET}/${publicId}`;
}

// Update Cloudinary mapping
console.log('[fix-preset] 📦 Updating cloudinary-mapping.json...');
const mapping = JSON.parse(fs.readFileSync(CLOUDINARY_MAPPING, 'utf8'));
let mappingCount = 0;

if (mapping.projects) {
  mapping.projects.forEach(project => {
    project.images.forEach(img => {
      const oldUrl = img.cloudinaryUrl;
      const newUrl = rebuildUrl(oldUrl);
      if (oldUrl !== newUrl) {
        img.cloudinaryUrl = newUrl;
        mappingCount++;
      }
    });
  });
}

if (mapping.journal) {
  mapping.journal.forEach(post => {
    post.images.forEach(img => {
      const oldUrl = img.cloudinaryUrl;
      const newUrl = rebuildUrl(oldUrl);
      if (oldUrl !== newUrl) {
        img.cloudinaryUrl = newUrl;
        mappingCount++;
      }
    });
  });
}

fs.writeFileSync(CLOUDINARY_MAPPING, JSON.stringify(mapping, null, 2), 'utf8');
console.log(`✅ Updated ${mappingCount} URLs in cloudinary-mapping.json\n`);

// Update portfolio-data.json
console.log('[fix-preset] 📁 Updating portfolio-data.json...');
const portfolioData = JSON.parse(fs.readFileSync(PORTFOLIO_DATA, 'utf8'));
let portfolioCount = 0;

portfolioData.projects.forEach(project => {
  if (project.gallery && Array.isArray(project.gallery)) {
    project.gallery = project.gallery.map(url => {
      const newUrl = rebuildUrl(url);
      if (url !== newUrl) portfolioCount++;
      return newUrl;
    });
  }
  if (project.heroImage) {
    const newUrl = rebuildUrl(project.heroImage);
    if (project.heroImage !== newUrl) {
      project.heroImage = newUrl;
      portfolioCount++;
    }
  }
});

if (portfolioData.posts) {
  portfolioData.posts.forEach(post => {
    if (post.coverImage) {
      const newUrl = rebuildUrl(post.coverImage);
      if (post.coverImage !== newUrl) {
        post.coverImage = newUrl;
        portfolioCount++;
      }
    }
    if (post.imageUrl) {
      const newUrl = rebuildUrl(post.imageUrl);
      if (post.imageUrl !== newUrl) {
        post.imageUrl = newUrl;
        portfolioCount++;
      }
    }
  });
}

if (portfolioData.config) {
  if (portfolioData.config.about?.profileImage) {
    const newUrl = rebuildUrl(portfolioData.config.about.profileImage);
    if (portfolioData.config.about.profileImage !== newUrl) {
      portfolioData.config.about.profileImage = newUrl;
      portfolioCount++;
    }
  }
  if (portfolioData.config.defaultOgImage) {
    const newUrl = rebuildUrl(portfolioData.config.defaultOgImage);
    if (portfolioData.config.defaultOgImage !== newUrl) {
      portfolioData.config.defaultOgImage = newUrl;
      portfolioCount++;
    }
  }
}

fs.writeFileSync(PORTFOLIO_DATA, JSON.stringify(portfolioData, null, 2), 'utf8');
console.log(`✅ Updated ${portfolioCount} URLs in portfolio-data.json\n`);

// Update share-meta.json
console.log('[fix-preset] 🔗 Updating share-meta.json...');
const shareMetaData = JSON.parse(fs.readFileSync(SHARE_META, 'utf8'));
let shareMetaCount = 0;

if (shareMetaData.projects) {
  shareMetaData.projects.forEach(project => {
    if (project.image) {
      const newUrl = rebuildUrl(project.image);
      if (project.image !== newUrl) {
        project.image = newUrl;
        shareMetaCount++;
      }
    }
  });
}

if (shareMetaData.posts) {
  shareMetaData.posts.forEach(post => {
    if (post.image) {
      const newUrl = rebuildUrl(post.image);
      if (post.image !== newUrl) {
        post.image = newUrl;
        shareMetaCount++;
      }
    }
  });
}

if (shareMetaData.config?.defaultOgImage) {
  const newUrl = rebuildUrl(shareMetaData.config.defaultOgImage);
  if (shareMetaData.config.defaultOgImage !== newUrl) {
    shareMetaData.config.defaultOgImage = newUrl;
    shareMetaCount++;
  }
}

fs.writeFileSync(SHARE_META, JSON.stringify(shareMetaData, null, 2), 'utf8');
console.log(`✅ Updated ${shareMetaCount} URLs in share-meta.json\n`);

console.log('[fix-preset] ✨ All Cloudinary URLs now use "fine" preset (q_75,w_1600)');
console.log(`[fix-preset] 📊 Total updates: ${mappingCount + portfolioCount + shareMetaCount} URLs`);
