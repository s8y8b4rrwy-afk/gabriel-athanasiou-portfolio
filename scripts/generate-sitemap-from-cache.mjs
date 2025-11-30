#!/usr/bin/env node

/**
 * Generate sitemap.xml from cached share-meta.json
 * This avoids Airtable rate limits by using already-synced data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl = 'https://directedbygabriel.com';
const currentDate = new Date().toISOString().split('T')[0];

function generateSitemap() {
  const shareMetaPath = path.join(__dirname, '../public/share-meta.json');
  
  if (!fs.existsSync(shareMetaPath)) {
    console.error('❌ share-meta.json not found. Run npm run build:content first.');
    process.exit(1);
  }

  const shareMeta = JSON.parse(fs.readFileSync(shareMetaPath, 'utf-8'));
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Home page
  xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

  // Main pages
  xml += `  <url>\n    <loc>${baseUrl}/work</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
  xml += `  <url>\n    <loc>${baseUrl}/journal</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
  xml += `  <url>\n    <loc>${baseUrl}/about</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;

  // Projects from share-meta.json
  if (shareMeta.projects && Array.isArray(shareMeta.projects)) {
    shareMeta.projects.forEach(project => {
      const slug = project.slug;
      const year = project.year || '';
      const lastmod = year ? `${year}-01-01` : currentDate;
      const isNarrative = project.type === 'Narrative';
      const priority = isNarrative ? '0.9' : '0.7';
      
      xml += `  <url>\n    <loc>${baseUrl}/work/${slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
    });
  }

  // Journal posts from share-meta.json
  if (shareMeta.journal && Array.isArray(shareMeta.journal)) {
    shareMeta.journal.forEach(post => {
      const slug = post.slug;
      const date = post.date || currentDate;
      
      xml += `  <url>\n    <loc>${baseUrl}/journal/${slug}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    });
  }

  xml += '</urlset>';
  return xml;
}

function main() {
  try {
    console.log('🔄 Generating sitemap.xml from cached share-meta.json...');
    
    const sitemap = generateSitemap();
    const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
    
    fs.writeFileSync(outputPath, sitemap, 'utf-8');
    
    console.log(`✅ Sitemap generated with all projects and journal posts`);
    console.log(`📍 Saved to: ${outputPath}`);
  } catch (error) {
    console.error('❌ Failed to generate sitemap:', error);
    process.exit(1);
  }
}

main();
