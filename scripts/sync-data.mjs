#!/usr/bin/env node
// Build-time data generator - creates static portfolio-data.json
// Uses shared sync-core for consistency with Netlify functions

import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { syncAllData } from './lib/sync-core.mjs';
import { 
  fetchAirtableTable, 
  buildLookupMaps, 
  makeSlug, 
  parseCreditsText,
  parseExternalLinks,
  normalizeProjectType,
  resolveAwards,
  resolveProductionCompany
} from './lib/airtable-helpers.mjs';
import { normalizeTitle, calculateReadingTime } from '../utils/textHelpers.mjs';
import { getVideoThumbnail } from '../utils/videoHelpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.local first, then .env
config({ path: path.resolve(__dirname, '../.env.local') });
config({ path: path.resolve(__dirname, '../.env') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.VITE_AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID || '';

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
  console.error('[sync-data] ❌ Missing Airtable credentials');
  process.exit(1);
}

const OUTPUT_DIR = path.resolve('public');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'portfolio-data.json');
const SHARE_META_FILE = path.join(OUTPUT_DIR, 'share-meta.json');
const CLOUDINARY_MAPPING_FILE = path.join(OUTPUT_DIR, 'cloudinary-mapping.json');

console.log('[sync-data] 🔄 Starting data sync...');

// Run the sync using shared core logic
(async () => {
  try {
    const results = await syncAllData({
      airtableToken: AIRTABLE_TOKEN,
      airtableBaseId: AIRTABLE_BASE_ID,
      outputDir: OUTPUT_DIR,
      verbose: true
    });

    console.log('[sync-data] ✅ Sync complete!');
    console.log(`[sync-data]    - ${results.projects.length} projects`);
    console.log(`[sync-data]    - ${results.journal.length} journal posts`);
    console.log(`[sync-data]    - Generated at: ${results.timestamp}`);
    process.exit(0);
  } catch (error) {
    console.error('[sync-data] ❌ Sync failed:', error);
    process.exit(1);
  }
})();

// Load Cloudinary mapping for image URLs
function loadCloudinaryMapping() {
  try {
    if (fs.existsSync(CLOUDINARY_MAPPING_FILE)) {
      const content = fs.readFileSync(CLOUDINARY_MAPPING_FILE, 'utf-8');
      const data = JSON.parse(content);
      console.log('[sync-data] ✅ Loaded Cloudinary mapping');
      return data;
    }
  } catch (error) {
    console.warn('[sync-data] ⚠️ Could not load Cloudinary mapping:', error.message);
  }
  return null;
}

// Load existing cached data as fallback
async function loadCachedData() {
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      const content = fs.readFileSync(OUTPUT_FILE, 'utf-8');
      const data = JSON.parse(content);
      console.log('[sync-data] ✅ Loaded existing cached data as fallback');
      return data;
    }
  } catch (error) {
    console.warn('[sync-data] ⚠️ Could not load cached data:', error.message);
  }
  return null;
}

// Build projects
async function buildProjects(festivalsMap, clientsMap, cloudinaryMapping) {
  console.log('[sync-data] 📦 Building projects...');
  const records = await fetchAirtableTable('Projects', 'Release Date', AIRTABLE_TOKEN, AIRTABLE_BASE_ID);
  const projects = [];
  
  // Build a lookup map for Cloudinary URLs by recordId
  const cloudinaryMap = {};
  if (cloudinaryMapping?.projects) {
    cloudinaryMapping.projects.forEach(project => {
      cloudinaryMap[project.recordId] = project.images || [];
    });
  }

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
    
    // Gallery images - Use Cloudinary URLs if available, fallback to Airtable URLs
    const cloudinaryImages = cloudinaryMap[r.id] || [];
    let gallery = [];
    
    if (cloudinaryImages.length > 0) {
      // Use Cloudinary URLs
      gallery = cloudinaryImages.map(img => img.cloudinaryUrl);
    } else {
      // Fallback to Airtable URLs
      gallery = (f['Gallery'] || []).map(img => img.url).filter(Boolean);
    }
    
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
    const credits = parseCreditsText(f['Credits Text'] || f['Credits'] || '');
    
    // Process awards (festivals)
    const awards = resolveAwards(f['Festivals'], festivalsMap);
    
    // Resolve production company from linked records
    const productionCompany = resolveProductionCompany(f['Production Company'], clientsMap);
    
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
  const records = await fetchAirtableTable('Journal', 'Date', AIRTABLE_TOKEN, AIRTABLE_BASE_ID);
  const now = new Date();
  const posts = [];

  for (const r of records) {
    const f = r.fields || {};
    
    // Check status - only include Public or Scheduled posts
    const status = f['Status'] || 'Draft';
    const postDate = new Date(f['Date'] || now);
    
    // Only sync Public or Scheduled posts (not Draft)
    if (status !== 'Public' && status !== 'Scheduled') {
      continue; // Skip Draft posts entirely
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
      status, // Cache status field for frontend filtering
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
  const records = await fetchAirtableTable('Settings', null, AIRTABLE_TOKEN, AIRTABLE_BASE_ID);
  
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

// Generate share-meta.json for social media previews
function generateShareMeta(projects, posts, config) {
  console.log('[sync-data] 🔗 Generating share-meta.json...');
  
  // Only include Public posts (or Scheduled posts that are past their date)
  const publicPosts = posts.filter(post => {
    if (post.status === 'Public') return true;
    if (post.status === 'Scheduled') {
      const postDate = new Date(post.date);
      const now = new Date();
      return postDate <= now;
    }
    return false;
  });
  
  const manifest = {
    generatedAt: new Date().toISOString(),
    projects: projects.map(p => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: (p.description || '').slice(0, 220),
      image: p.heroImage || '',
      type: p.type,
      year: p.year
    })),
    posts: publicPosts.map(p => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: (p.content || '').replace(/\s+/g, ' ').trim().slice(0, 220),
      image: p.imageUrl || '',
      type: 'article',
      date: p.date
    })),
    config: {
      defaultOgImage: config.defaultOgImage || ''
    }
  };
  
  console.log(`[sync-data] ✅ Generated share-meta with ${manifest.projects.length} projects, ${manifest.posts.length} posts`);
  return manifest;
}

// Main execution
async function main() {
  try {
    // Load Cloudinary mapping for permanent image URLs
    const cloudinaryMapping = loadCloudinaryMapping();
    
    // Build lookup maps
    console.log('[sync-data] 🗂️  Fetching lookup tables...');
    const { festivalsMap, clientsMap } = await buildLookupMaps(AIRTABLE_TOKEN, AIRTABLE_BASE_ID);
    console.log(`[sync-data] ✅ Loaded ${Object.keys(festivalsMap).length} festivals, ${Object.keys(clientsMap).length} clients`);
    
    // Then fetch all other data with resolved references
    const [projects, posts, config] = await Promise.all([
      buildProjects(festivalsMap, clientsMap, cloudinaryMapping),
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

    // Write portfolio-data.json
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log('[sync-data] ✅ Successfully generated portfolio-data.json');
    
    // Generate and write share-meta.json
    const shareMeta = generateShareMeta(projects, posts, config);
    fs.writeFileSync(SHARE_META_FILE, JSON.stringify(shareMeta, null, 2), 'utf-8');
    console.log('[sync-data] ✅ Successfully generated share-meta.json');
    
    console.log(`[sync-data] 📊 Stats: ${projects.length} projects, ${posts.length} posts`);
    console.log(`[sync-data] 📍 Outputs: ${OUTPUT_FILE}, ${SHARE_META_FILE}`);
    process.exit(0);

  } catch (error) {
    // Check if error is due to rate limiting
    if (error.isRateLimit || error.message?.includes('Rate limit') || error.message?.includes('429')) {
      console.error('[sync-data] ⚠️ Airtable API rate limit exceeded');
      console.log('[sync-data] 🔄 Attempting to use cached data as fallback...');
      
      const cachedData = await loadCachedData();
      
      if (cachedData && cachedData.projects && cachedData.posts) {
        console.log('[sync-data] ✅ Using cached data (last updated: ' + cachedData.lastUpdated + ')');
        console.log('[sync-data] 📊 Cached data: ' + cachedData.projects.length + ' projects, ' + cachedData.posts.length + ' posts');
        
        // Update share-meta from cached data
        const shareMeta = generateShareMeta(cachedData.projects, cachedData.posts, cachedData.config);
        
        if (!fs.existsSync(OUTPUT_DIR)) {
          fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }
        
        fs.writeFileSync(SHARE_META_FILE, JSON.stringify(shareMeta, null, 2), 'utf-8');
        console.log('[sync-data] ✅ Regenerated share-meta.json from cached data');
        console.log('[sync-data] 📍 Using stale data until rate limit resets');
        console.log('[sync-data] ⏰ Rate limit typically resets at start of next month (Dec 1st)');
        process.exit(0);
      } else {
        console.error('[sync-data] ❌ No cached data available and rate limit exceeded');
        console.error('[sync-data] 💡 Site will use empty fallback until rate limit resets');
        process.exit(1);
      }
    }
    
    console.error('[sync-data] ❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
