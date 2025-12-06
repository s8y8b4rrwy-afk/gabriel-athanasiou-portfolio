#!/usr/bin/env node
/**
 * Script to fix Airtable URLs in portfolio data files by replacing them with Cloudinary URLs
 * from the cloudinary-mapping.json file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

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

// Function to fix a portfolio file
function fixPortfolioFile(filename) {
  const filePath = path.join(PUBLIC_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ File not found: ${filename}`);
    return { fixed: 0, remaining: 0 };
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let fixedCount = 0;
  let remainingAirtableUrls = 0;
  const unfixedProjects = [];
  
  for (const project of data.projects) {
    const cloudinaryData = recordToCloudinaryUrls[project.id];
    
    // Check heroImage
    if (project.heroImage && project.heroImage.includes('airtableusercontent.com')) {
      if (cloudinaryData && cloudinaryData.images.length > 0) {
        console.log(`  🔧 Fixing heroImage for "${project.title}": ${cloudinaryData.images[0].substring(0, 60)}...`);
        project.heroImage = cloudinaryData.images[0];
        fixedCount++;
      } else {
        remainingAirtableUrls++;
        unfixedProjects.push({ title: project.title, field: 'heroImage', id: project.id });
      }
    }
    
    // Check gallery
    if (project.gallery && Array.isArray(project.gallery)) {
      const newGallery = [];
      for (let i = 0; i < project.gallery.length; i++) {
        const url = project.gallery[i];
        if (url.includes('airtableusercontent.com')) {
          if (cloudinaryData && cloudinaryData.images.length > i) {
            console.log(`  🔧 Fixing gallery[${i}] for "${project.title}"`);
            newGallery.push(cloudinaryData.images[i]);
            fixedCount++;
          } else {
            remainingAirtableUrls++;
            unfixedProjects.push({ title: project.title, field: `gallery[${i}]`, id: project.id });
            newGallery.push(url); // Keep original
          }
        } else {
          newGallery.push(url);
        }
      }
      project.gallery = newGallery;
    }
  }
  
  // Save the fixed file
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  
  console.log(`\n📊 Summary for ${filename}:`);
  console.log(`   ✅ Fixed: ${fixedCount} URLs`);
  console.log(`   ⚠️ Remaining Airtable URLs: ${remainingAirtableUrls}`);
  
  if (unfixedProjects.length > 0) {
    console.log(`\n   ⚠️ Projects with unfixed Airtable URLs (no Cloudinary mapping):`);
    for (const p of unfixedProjects) {
      console.log(`      - ${p.title} (${p.field}) - ID: ${p.id}`);
    }
  }
  
  return { fixed: fixedCount, remaining: remainingAirtableUrls, unfixedProjects };
}

// Fix postproduction portfolio
console.log('\n🔄 Fixing portfolio-data-postproduction.json...');
const postprodResult = fixPortfolioFile('portfolio-data-postproduction.json');

// Also fix directing portfolio just in case
console.log('\n🔄 Fixing portfolio-data-directing.json...');
const directingResult = fixPortfolioFile('portfolio-data-directing.json');

// Also fix main portfolio-data.json if it exists
console.log('\n🔄 Fixing portfolio-data.json...');
const mainResult = fixPortfolioFile('portfolio-data.json');

console.log('\n✅ Done!');
console.log(`\nTotal fixed: ${postprodResult.fixed + directingResult.fixed + mainResult.fixed}`);
console.log(`Total remaining: ${postprodResult.remaining + directingResult.remaining + mainResult.remaining}`);
