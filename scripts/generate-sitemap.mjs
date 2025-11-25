#!/usr/bin/env node

/**
 * Script to generate sitemap.xml from Airtable CMS
 * Run this during build time: `npm run generate:sitemap`
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSitemap } from './utils/sitemapGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    console.log('🔄 Generating sitemap.xml from Airtable CMS...');
    
    const sitemap = await generateSitemap();
    const outputPath = path.join(__dirname, 'public', 'sitemap.xml');
    
    fs.writeFileSync(outputPath, sitemap, 'utf-8');
    
    console.log(`✅ Sitemap generated successfully at ${outputPath}`);
  } catch (error) {
    console.error('❌ Failed to generate sitemap:', error);
    process.exit(1);
  }
}

main();
