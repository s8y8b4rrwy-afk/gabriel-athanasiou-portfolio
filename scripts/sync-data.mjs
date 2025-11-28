#!/usr/bin/env node
// Build-time data generator - creates static portfolio-data.json
// This runs during build to fetch and cache all Airtable data

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { getVideoId, getVideoThumbnail } from '../utils/videoHelpers.mjs';
import { normalizeTitle, calculateReadingTime } from '../utils/textHelpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.local first, then .env
config({ path: path.resolve(__dirname, '../.env.local') });
config({ path: path.resolve(__dirname, '../.env') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.VITE_AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID || '';

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
  console.error('[sync-data] ❌ Missing Airtable credentials (AIRTABLE_TOKEN or AIRTABLE_BASE_ID)');
  process.exit(1);
}

const OUTPUT_DIR = path.resolve('public');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'portfolio-data.json');

console.log('[sync-data] 🔄 Starting data sync...');

// Fetch from Airtable with pagination
async function fetchAirtableTable(tableName, sortField) {
  const sortParam = sortField 
    ? `&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(sortField)}&sort%5B0%5D%5Bdirection%5D=desc` 
    : '';
  let allRecords = [];
  let offset = null;

  do {
    const offsetParam = offset ? `&offset=${offset}` : '';
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?${sortParam}${offsetParam}`;
    
    const res = await fetch(url, { 
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } 
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${tableName}: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

// Generate slug
function makeSlug(base) {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

// Normalize project type
function normalizeProjectType(rawType) {
  if (!rawType) return 'Uncategorized';
  const tl = rawType.toLowerCase();
  if (/(short|feature|narrative)/.test(tl)) return 'Narrative';
  if (/(commercial|tvc|brand)/.test(tl)) return 'Commercial';
  if (/music/.test(tl)) return 'Music Video';
  if (/documentary/.test(tl)) return 'Documentary';
  return 'Uncategorized';
}

// Build projects
async function buildProjects() {
  console.log('[sync-data] 📊 Fetching projects...');
  const records = await fetchAirtableTable('Projects', 'Release Date');
  const projects = [];

  for (const r of records) {
    const f = r.fields || {};
    
    // Skip non-featured projects
    if (!f['Feature']) continue;

    const rawTitle = f['Name'] || 'Untitled';
    const title = normalizeTitle(rawTitle);
    const year = (f['Release Date'] || f['Work Date'] || '').substring(0, 4);
    const type = normalizeProjectType(f['Project Type'] || f['Kind']);
    
    // Gallery images
    const gallery = (f['Gallery'] || []).map(img => img.url).filter(Boolean);
    const heroImage = gallery[0] || '';
    
    // Video thumbnail fallback
    let videoThumbnail = '';
    if (!heroImage && f['Video URL']) {
      const rawVideoUrls = f['Video URL'].split(/[,|\n]+/).map(s => s.trim()).filter(Boolean);
      if (rawVideoUrls.length > 0) {
        videoThumbnail = await getVideoThumbnail(rawVideoUrls[0]);
      }
    }
    
    // Social image priority
    const socialImage = (f['Social Image']?.[0]?.url) || heroImage || videoThumbnail || '';
    
    const description = (f['About'] || '').toString().replace(/\\s+/g, ' ').trim();
    const baseSlug = makeSlug(title + (year ? '-' + year : ''));
    
    // Parse video URLs
    const videoUrls = (f['Video URL'] || '')
      .split(/[,|\\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
    
    // Parse credits
    const creditsText = (f['Credits Text'] || '').toString();
    const credits = creditsText
      .split('\\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          return {
            role: line.substring(0, colonIndex).trim(),
            name: line.substring(colonIndex + 1).trim()
          };
        }
        return null;
      })
      .filter(Boolean);
    
    projects.push({
      id: r.id,
      slug: baseSlug,
      title,
      year,
      type,
      description: description.slice(0, 500),
      heroImage: socialImage,
      gallery,
      videoUrls,
      credits,
      client: f['Client'] || '',
      productionCompany: f['Production Company'] || '',
      awards: (f['Awards'] || []).map(awardId => awardId), // Keep as IDs for now
      featured: !!f['Featured'],
      isFeatured: !!f['Featured']
    });
  }

  console.log(`[sync-data] ✅ Fetched ${projects.length} projects`);
  return projects;
}

// Build posts
async function buildPosts() {
  console.log('[sync-data] 📰 Fetching journal posts...');
  const records = await fetchAirtableTable('Journal', 'Date');
  const now = new Date();
  const posts = [];

  for (const r of records) {
    const f = r.fields || {};
    
    // Skip future posts
    const postDate = new Date(f['Date'] || now);
    if (postDate > now) continue;

    const title = normalizeTitle(f['Title'] || 'Untitled');
    const content = (f['Content'] || '').toString();
    const excerpt = (f['Excerpt'] || content.slice(0, 200)).toString();
    const readingTime = calculateReadingTime(content);
    const coverImage = f['Cover Image']?.[0]?.url || '';
    const slug = makeSlug(title + '-' + postDate.toISOString().split('T')[0]);

    posts.push({
      id: r.id,
      slug,
      title,
      content,
      excerpt,
      coverImage,
      date: f['Date'] || now.toISOString().split('T')[0],
      readingTime,
      featured: !!f['Featured']
    });
  }

  console.log(`[sync-data] ✅ Fetched ${posts.length} posts`);
  return posts;
}

// Build config
async function buildConfig() {
  console.log('[sync-data] ⚙️  Fetching settings...');
  const records = await fetchAirtableTable('Settings', null);
  
  if (records.length === 0) {
    console.warn('[sync-data] ⚠️  No settings found, using defaults');
    return {
      showreel: { enabled: false, videoUrl: '', placeholderImage: '' },
      contact: { email: '', phone: '', repUK: '', repUSA: '', instagram: '', vimeo: '', linkedin: '' }
    };
  }

  const f = records[0].fields || {};
  
  return {
    showreel: {
      enabled: !!f['Showreel Enabled'],
      videoUrl: f['Showreel URL'] || '',
      placeholderImage: f['Showreel Placeholder']?.[0]?.url || ''
    },
    contact: {
      email: f['Email'] || '',
      phone: f['Phone'] || '',
      repUK: f['Rep UK'] || '',
      repUSA: f['Rep USA'] || '',
      instagram: f['Instagram'] || '',
      vimeo: f['Vimeo'] || '',
      linkedin: f['LinkedIn'] || ''
    }
  };
}

// Main execution
async function main() {
  try {
    const [projects, posts, config] = await Promise.all([
      buildProjects(),
      buildPosts(),
      buildConfig()
    ]);

    const data = {
      generatedAt: new Date().toISOString(),
      projects,
      posts,
      config
    };

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
    
    console.log('[sync-data] ✅ Successfully generated portfolio-data.json');
    console.log(`[sync-data] 📊 Stats: ${projects.length} projects, ${posts.length} posts`);
    process.exit(0);

  } catch (error) {
    console.error('[sync-data] ❌ Error:', error.message);
    process.exit(1);
  }
}

main();
