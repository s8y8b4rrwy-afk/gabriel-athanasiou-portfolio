#!/usr/bin/env node

/**
 * Script to generate sitemap.xml from Airtable CMS
 * Run this during build time: `npm run build:sitemap`
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAirtableTable, makeSlug } from './lib/airtable-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.VITE_AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID || '';

async function generateSitemap() {
  try {
    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
      console.warn('[sitemap] Missing Airtable credentials, generating minimal sitemap');
      return generateMinimalSitemap();
    }

    const projectRecords = await fetchAirtableTable('Projects', 'Release Date', AIRTABLE_TOKEN, AIRTABLE_BASE_ID);
    const journalRecords = await fetchAirtableTable('Journal', 'Date', AIRTABLE_TOKEN, AIRTABLE_BASE_ID);
    
    const baseUrl = 'https://directedbygabriel.com';
    const currentDate = new Date().toISOString().split('T')[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Home page
    xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    // Main pages
    xml += `  <url>\n    <loc>${baseUrl}/work</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
    xml += `  <url>\n    <loc>${baseUrl}/journal</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    xml += `  <url>\n    <loc>${baseUrl}/about</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;

    // Projects
    projectRecords
      .filter(r => r.fields?.['Feature'])
      .forEach(record => {
        const f = record.fields;
        const title = f['Name'] || 'Untitled';
        const year = (f['Release Date'] || f['Work Date'] || '').substring(0, 4);
        const slug = makeSlug(title + (year ? '-' + year : ''));
        const lastmod = year ? `${year}-01-01` : currentDate;
        
        let type = f['Project Type'] || f['Kind'] || 'Uncategorized';
        const tl = type.toLowerCase();
        if (/(short|feature|narrative)/.test(tl)) type = 'Narrative';
        
        const isNarrative = type === 'Narrative';
        const isFeatured = !!f['Front Page'];
        const priority = isNarrative ? '0.9' : (isFeatured ? '0.8' : '0.7');
        
        xml += `  <url>\n    <loc>${baseUrl}/work/${slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
      });

    // Journal posts
    const now = new Date();
    journalRecords
      .filter(r => {
        const status = r.fields?.['Status'] || 'Draft';
        if (status === 'Public') return true;
        if (status === 'Scheduled' && r.fields?.['Date']) {
          return new Date(r.fields['Date']) <= now;
        }
        return false;
      })
      .forEach(record => {
        const f = record.fields;
        const title = f['Title'] || 'Untitled';
        const date = f['Date'] || '';
        const slug = makeSlug(title + (date ? '-' + date.substring(0, 10) : ''));
        const lastmod = date || currentDate;
        
        xml += `  <url>\n    <loc>${baseUrl}/journal/${slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      });

    xml += '</urlset>';
    return xml;
  } catch (error) {
    console.error('[sitemap] Generation failed:', error);
    return generateMinimalSitemap();
  }
}

function generateMinimalSitemap() {
  const baseUrl = 'https://directedbygabriel.com';
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/work</loc>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/journal</loc>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/about</loc>
    <priority>0.7</priority>
  </url>
</urlset>`;
}

async function main() {
  try {
    console.log('🔄 Generating sitemap.xml from Airtable CMS...');
    
    const sitemap = await generateSitemap();
    const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
    
    // Ensure public directory exists
    const publicDir = path.dirname(outputPath);
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, sitemap, 'utf-8');
    
    console.log(`✅ Sitemap generated successfully at ${outputPath}`);
  } catch (error) {
    console.error('❌ Failed to generate sitemap:', error);
    process.exit(1);
  }
}

main();
