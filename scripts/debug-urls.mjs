#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const data = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'portfolio-data-postproduction.json'), 'utf-8'));
const mapping = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'cloudinary-mapping.json'), 'utf-8'));

// Get IDs from data file
const dataIds = data.projects.map(p => p.id);
console.log('Projects in data file:', dataIds.length);

// Get IDs from mapping
const mappingIds = mapping.projects.map(p => p.recordId);
console.log('Projects in mapping:', mappingIds.length);

// Find projects with airtable URLs
const airtableProjects = data.projects.filter(p => 
  (p.heroImage && p.heroImage.includes('airtableusercontent')) ||
  (p.gallery && p.gallery.some(u => u.includes('airtableusercontent')))
);
console.log('Projects with Airtable URLs:', airtableProjects.length);

// Check which ones are NOT in mapping
const mappingSet = new Set(mappingIds);
const missingFromMapping = airtableProjects.filter(p => !mappingSet.has(p.id));
console.log('Projects with Airtable URLs NOT in mapping:', missingFromMapping.length);

// Check which ones ARE in mapping but still have airtable URLs
const inMappingButStillAirtable = airtableProjects.filter(p => mappingSet.has(p.id));
console.log('Projects with Airtable URLs that ARE in mapping:', inMappingButStillAirtable.length);

if (inMappingButStillAirtable.length > 0) {
  console.log('\nFirst 5 examples of projects IN mapping but still have Airtable URLs:');
  inMappingButStillAirtable.slice(0, 5).forEach(p => {
    const mappingEntry = mapping.projects.find(m => m.recordId === p.id);
    console.log('  -', p.id, p.title);
    console.log('    heroImage:', p.heroImage?.substring(0, 50) + '...');
    console.log('    mapping has', mappingEntry?.images?.length || 0, 'images');
    if (mappingEntry?.images?.[0]) {
      console.log('    mapping[0]:', mappingEntry.images[0].cloudinaryUrl?.substring(0, 50) + '...');
    }
  });
}
