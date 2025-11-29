#!/usr/bin/env node
// Quick fix: Replace Airtable URLs with Cloudinary URLs in portfolio-data.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const PORTFOLIO_DATA = path.join(PUBLIC_DIR, 'portfolio-data.json');
const CLOUDINARY_MAPPING = path.join(PUBLIC_DIR, 'cloudinary-mapping.json');

console.log('[fix-urls] 🔄 Updating portfolio data with Cloudinary URLs...');

// Load files
const portfolioData = JSON.parse(fs.readFileSync(PORTFOLIO_DATA, 'utf8'));
const cloudinaryMapping = JSON.parse(fs.readFileSync(CLOUDINARY_MAPPING, 'utf8'));

// Build lookup map
const cloudinaryMap = {};
cloudinaryMapping.projects.forEach(project => {
  cloudinaryMap[project.recordId] = project.images || [];
});

// Update projects
let updatedCount = 0;
portfolioData.projects.forEach(project => {
  const cloudinaryImages = cloudinaryMap[project.id] || [];
  
  if (cloudinaryImages.length > 0) {
    // Replace gallery with Cloudinary URLs
    const newGallery = cloudinaryImages.map(img => img.cloudinaryUrl);
    
    // Only update if different
    if (JSON.stringify(project.gallery) !== JSON.stringify(newGallery)) {
      project.gallery = newGallery;
      project.heroImage = newGallery[0] || project.heroImage;
      updatedCount++;
      console.log(`[fix-urls] ✅ Updated: ${project.title} (${project.id})`);
    }
  }
});

// Save updated data
fs.writeFileSync(PORTFOLIO_DATA, JSON.stringify(portfolioData, null, 2), 'utf8');
console.log(`[fix-urls] ✅ Updated ${updatedCount} projects with Cloudinary URLs`);
