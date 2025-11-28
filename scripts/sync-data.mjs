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

// Build lookup maps
async function buildLookupMaps() {
  console.log('[sync-data] 🗂️  Fetching lookup tables...');
  const [festivalsRecords, clientsRecords] = await Promise.all([
    fetchAirtableTable('Festivals', null),
    fetchAirtableTable('Client Book', null)
  ]);

  const festivalsMap = {};
  festivalsRecords.forEach(r => {
    festivalsMap[r.id] = r.fields['Display Name'] || r.fields['Name'] || r.fields['Award'] || 'Unknown Award';
  });

  const clientsMap = {};
  clientsRecords.forEach(r => {
    clientsMap[r.id] = r.fields['Company'] || r.fields['Company Name'] || r.fields['Client'] || 'Unknown';
  });

  console.log(`[sync-data] ✅ Loaded ${Object.keys(festivalsMap).length} festivals, ${Object.keys(clientsMap).length} clients`);
  return { festivalsMap, clientsMap };
}

// Parse external links and extract videos
function parseExternalLinks(rawText) {
  const links = [];
  const videos = [];
  
  if (!rawText) return { links, videos };
  
  const items = rawText.split(/[,|\n]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  for (const item of items) {
    if (!item.startsWith('http')) continue;
    
    const videoInfo = getVideoId(item);
    const isVideo = videoInfo.type !== null;
    
    if (isVideo) {
      videos.push(item);
    } else {
      let label = "Link";
      try {
        const hostname = new URL(item).hostname;
        const core = hostname.replace('www.', '').split('.')[0];
        if (core === 'imdb') label = 'IMDb';
        else if (core === 'youtube') label = 'YouTube';
        else if (core === 'linkedin') label = 'LinkedIn';
        else if (core === 'instagram') label = 'Instagram';
        else if (core === 'vimeo') label = 'Vimeo';
        else if (core === 'facebook') label = 'Facebook';
        else label = core.charAt(0).toUpperCase() + core.slice(1);
      } catch (e) {}
      
      links.push({ label, url: item });
    }
  }
  
  return { links, videos };
}

// Build projects
async function buildProjects(festivalsMap, clientsMap) {
  console.log('[sync-data] 📊 Fetching projects...');
  const records = await fetchAirtableTable('Projects', 'Release Date');
  const projects = [];

  for (const r of records) {
    const f = r.fields || {};
    
    // Check Display Status field (single select)
    const displayStatus = f['Display Status'] || '';
    
    // Skip hidden projects entirely (don't sync to cache)
    if (displayStatus === 'Hidden' || !displayStatus) continue;

    const rawTitle = f['Name'] || 'Untitled';
    const title = normalizeTitle(rawTitle);
    
    // Extract date fields (Work Date is the actual production/work date, Release Date is public release)
    const releaseDate = f['Release Date'] || '';
    const workDate = f['Work Date'] || '';
    const year = (releaseDate || workDate || '').substring(0, 4);
    
    // Get raw kind and project type
    const rawKind = f['Kind'];
    const rawType = f['Project Type'];
    const kinds = rawKind ? (Array.isArray(rawKind) ? rawKind : [rawKind]) : [];
    const type = normalizeProjectType(rawType || rawKind);
    
    // Gallery images
    const gallery = (f['Gallery'] || []).map(img => img.url).filter(Boolean);
    
    // Main video URL
    const videoUrl = f['Video URL'] || '';
    
    // Get hero image with video thumbnail fallback
    let heroImage = gallery[0] || '';
    if (!heroImage && videoUrl) {
      const videoThumbnail = await getVideoThumbnail(videoUrl);
      if (videoThumbnail) heroImage = videoThumbnail;
    }
    
    const description = (f['About'] || '').toString().replace(/\s+/g, ' ').trim();
    const baseSlug = makeSlug(title + (year ? '-' + year : ''));
    
    // Parse external links and extract additional videos
    const linkData = parseExternalLinks(f['External Links']);
    
    // Parse credits
    const creditsText = (f['Credits Text'] || f['Credits'] || '').toString();
    const credits = creditsText
      .split('\n')
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
    
    // Process awards (festivals)
    let awards = [];
    if (f['Festivals']) {
      if (Array.isArray(f['Festivals'])) {
        awards = f['Festivals'].map(id => festivalsMap[id] || id);
      } else if (typeof f['Festivals'] === 'string') {
        awards = f['Festivals'].split('\n').filter(s => s.trim().length > 0);
      }
    }
    
    // Resolve production company from linked records
    let productionCompany = '';
    const productionCompanyField = f['Production Company'];
    if (Array.isArray(productionCompanyField)) {
      productionCompany = productionCompanyField.map(id => clientsMap[id] || id).join(', ');
    } else if (productionCompanyField) {
      productionCompany = clientsMap[productionCompanyField] || productionCompanyField;
    }
    
    projects.push({
      id: r.id,
      slug: baseSlug,
      title,
      type,
      kinds,
      genre: f['Genre'] || [],
      productionCompany,
      client: f['Client'] || '',
      year,
      releaseDate,
      workDate,
      description,
      isFeatured: displayStatus === 'Featured' || displayStatus === 'Hero',
      isHero: displayStatus === 'Hero',
      heroImage,
      gallery,
      videoUrl,
      additionalVideos: linkData.videos,
      awards,
      credits,
      externalLinks: linkData.links,
      relatedArticleId: f['Related Article']?.[0] || f['Journal']?.[0] || null
    });
  }

  // Sort projects by release date (or work date as fallback), newest first
  projects.sort((a, b) => {
    const dateA = a.releaseDate || a.workDate || '';
    const dateB = b.releaseDate || b.workDate || '';
    return dateB.localeCompare(dateA); // Descending order (newest first)
  });

  console.log(`[sync-data] ✅ Fetched ${projects.length} projects (sorted by date)`);
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
    
    // Check status - only include Public or Scheduled (if date has passed)
    const status = f['Status'] || 'Draft';
    const postDate = new Date(f['Date'] || now);
    
    if (status === 'Public') {
      // Always include public posts
    } else if (status === 'Scheduled' && postDate <= now) {
      // Include scheduled posts if date has passed
    } else {
      // Skip draft or future scheduled posts
      continue;
    }

    const title = normalizeTitle(f['Title'] || 'Untitled');
    const content = (f['Content'] || '').toString();
    const readingTime = calculateReadingTime(content);
    const imageUrl = f['Cover Image']?.[0]?.url || '';
    const slug = makeSlug(title + '-' + postDate.toISOString().split('T')[0]);
    
    // Parse related links
    const rawLinks = f['Links'] || f['External Links'];
    const relatedLinks = rawLinks 
      ? rawLinks.split(',').map(s => s.trim()).filter(s => s.length > 0) 
      : [];

    posts.push({
      id: r.id,
      slug,
      title,
      date: f['Date'] || now.toISOString().split('T')[0],
      readingTime,
      content,
      imageUrl,
      tags: f['Tags'] || [],
      relatedProjectId: f['Related Project']?.[0] || f['Projects']?.[0] || null,
      source: 'local',
      externalUrl: '',
      relatedLinks
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
      contact: { email: '', phone: '', repUK: '', repUSA: '', instagram: '', vimeo: '', linkedin: '' },
      about: { bio: '', profileImage: '' },
      allowedRoles: [],
      defaultOgImage: ''
    };
  }

  const f = records[0].fields || {};
  const allowedRoles = f['Allowed Roles'] 
    ? (Array.isArray(f['Allowed Roles']) ? f['Allowed Roles'] : [f['Allowed Roles']])
    : [];
  
  return {
    showreel: {
      enabled: !!f['Showreel Enabled'],
      videoUrl: f['Showreel URL'] || '',
      placeholderImage: f['Showreel Placeholder']?.[0]?.url || ''
    },
    contact: {
      email: f['Contact Email'] || '',
      phone: f['Contact Phone'] || '',
      repUK: f['Rep UK'] || '',
      repUSA: f['Rep USA'] || '',
      instagram: f['Instagram URL'] || '',
      vimeo: f['Vimeo URL'] || '',
      linkedin: f['LinkedIn URL'] || ''
    },
    about: {
      bio: f['Bio'] || f['Bio Text'] || '',
      profileImage: f['About Image']?.[0]?.url || ''
    },
    allowedRoles: allowedRoles,
    defaultOgImage: f['Default OG Image']?.[0]?.url || ''
  };
}

// Main execution
async function main() {
  try {
    // First build lookup maps
    const { festivalsMap, clientsMap } = await buildLookupMaps();
    
    // Then fetch all other data with resolved references
    const [projects, posts, config] = await Promise.all([
      buildProjects(festivalsMap, clientsMap),
      buildPosts(),
      buildConfig()
    ]);

    const data = {
      projects,
      posts,
      config,
      lastUpdated: new Date().toISOString(),
      version: '1.0',
      source: 'build-time-sync'
    };

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
    
    console.log('[sync-data] ✅ Successfully generated portfolio-data.json');
    console.log(`[sync-data] 📊 Stats: ${projects.length} projects, ${posts.length} posts`);
    console.log(`[sync-data] 📍 Output: ${OUTPUT_FILE}`);
    process.exit(0);

  } catch (error) {
    console.error('[sync-data] ❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
