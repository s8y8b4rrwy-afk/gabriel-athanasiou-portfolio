#!/usr/bin/env node
// Build-time manifest generator for share metadata.
// Minimal fields only: slug, title, description, heroImage (or socialImage), type, year.
// Requires env vars: AIRTABLE_TOKEN, AIRTABLE_BASE_ID.

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';
import { getVideoThumbnail } from '../utils/videoHelpers.mjs';
import { normalizeTitle } from '../utils/textHelpers.mjs';
import { fetchAirtableTable, makeSlug, normalizeProjectType } from './lib/airtable-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenvConfig({ path: path.resolve(__dirname, '../.env.local') });
dotenvConfig({ path: path.resolve(__dirname, '../.env') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.VITE_AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID || '';

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
  console.warn('[share-meta] ⚠️  Missing Airtable credentials. Preserving existing file.');
  console.log('[share-meta] ℹ️  To regenerate, ensure AIRTABLE_TOKEN and AIRTABLE_BASE_ID are set.');
  process.exit(0); // Non-fatal: leave existing file intact
}

const OUTPUT_DIR = path.resolve('public');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'share-meta.json');
const OUTPUT_HASH = path.join(OUTPUT_DIR, 'share-meta.hash');
const CLOUDINARY_MAPPING = path.join(OUTPUT_DIR, 'cloudinary-mapping.json');

// Load Cloudinary mapping for permanent image URLs
function loadCloudinaryMapping() {
  try {
    if (fs.existsSync(CLOUDINARY_MAPPING)) {
      const content = fs.readFileSync(CLOUDINARY_MAPPING, 'utf8');
      const data = JSON.parse(content);
      console.log(`[share-meta] ✅ Loaded Cloudinary mapping with ${data.projects?.length || 0} projects`);
      return data;
    }
  } catch (e) {
    console.warn('[share-meta] ⚠️ Could not load Cloudinary mapping:', e.message);
  }
  return null;
}

async function buildProjects(cloudinaryMapping, defaultOgImage) {
  const records = await fetchAirtableTable('Projects', 'Release Date', AIRTABLE_TOKEN, AIRTABLE_BASE_ID);
  const items = [];
  
  // Build lookup map for Cloudinary URLs
  const cloudinaryMap = {};
  if (cloudinaryMapping?.projects) {
    cloudinaryMapping.projects.forEach(project => {
      cloudinaryMap[project.recordId] = project.images || [];
    });
  }
  
  for (const r of records) {
    const f = r.fields || {};
    if (!f['Feature']) continue; // Respect visibility rule.
    const rawTitle = f['Name'] || 'Untitled';
    const title = normalizeTitle(rawTitle);
    const year = (f['Release Date'] || f['Work Date'] || '').substring(0, 4);
    let type = f['Project Type'] || f['Kind'] || 'Uncategorized';
    const tl = type.toLowerCase();
    if (/(short|feature|narrative)/.test(tl)) type = 'Narrative';
    else if (/(commercial|tvc|brand)/.test(tl)) type = 'Commercial';
    else if (/music/.test(tl)) type = 'Music Video';
    else if (/documentary/.test(tl)) type = 'Documentary';
    else type = 'Uncategorized';
    
    // Use Cloudinary URLs if available, fallback to Airtable URLs
    const cloudinaryImages = cloudinaryMap[r.id] || [];
    let gallery = [];
    
    if (cloudinaryImages.length > 0) {
      gallery = cloudinaryImages.map(img => img.cloudinaryUrl);
    } else {
      gallery = (f['Gallery'] || []).map(img => img.url).filter(Boolean);
    }
    
    const heroImage = gallery[0] || '';
    
    // Check if project has video content
    const hasVideo = !!(f['Video URL'] && f['Video URL'].trim());
    
    // Try video thumbnail if no gallery image
    let videoThumbnail = '';
    if (!heroImage && hasVideo) {
      const rawVideoUrls = f['Video URL'].split(/[,|\n]+/).map(s => s.trim()).filter(Boolean);
      if (rawVideoUrls.length > 0) {
        videoThumbnail = await getVideoThumbnail(rawVideoUrls[0]);
      }
    }
    
    // Priority: Social Image > Gallery > Video Thumbnail > Default OG Image (if no video AND no gallery)
    let socialImage = (f['Social Image'] && f['Social Image'][0] && f['Social Image'][0].url) || heroImage || videoThumbnail;
    
    // If project has neither video nor gallery images, use default OG image
    if (!socialImage && !hasVideo && gallery.length === 0) {
      socialImage = defaultOgImage || '';
    }
    
    const description = (f['About'] || '').toString().replace(/\s+/g, ' ').trim();
    const baseSlug = makeSlug(title + (year ? '-' + year : ''));
    items.push({
      id: r.id,
      slug: baseSlug,
      title,
      description: description.slice(0, 220),
      image: socialImage,
      type,
      year
    });
  }
  return items;
}

async function buildPosts() {
  const records = await fetchAirtableTable('Journal', 'Date', AIRTABLE_TOKEN, AIRTABLE_BASE_ID);
  const now = new Date();
  const items = [];
  
  for (const r of records) {
    const f = r.fields || {};
    const status = f['Status'] || 'Draft'; // Default to Draft if no status
    
    // Only include Public posts, or Scheduled posts that have reached their date
    if (status === 'Public' || (status === 'Scheduled' && f['Date'] && new Date(f['Date']) <= now)) {
      const title = f['Title'] || 'Untitled';
      const date = f['Date'] || '';
      const description = (f['Content'] || '').toString().replace(/\s+/g, ' ').trim();
      const image = (f['Cover Image'] && f['Cover Image'][0] && f['Cover Image'][0].url) || '';
      const baseSlug = makeSlug(title + (date ? '-' + date.substring(0, 10) : ''));
      items.push({
        id: r.id,
        slug: baseSlug,
        title: title,
        description: description.slice(0, 220),
        image,
        type: 'article',
        date
      });
    }
  }
  return items;
}

async function buildConfig() {
  try {
    const records = await fetchAirtableTable('Settings', null, AIRTABLE_TOKEN, AIRTABLE_BASE_ID);
    if (records.length === 0) return {};
    const f = records[0].fields || {};
    return {
      defaultOgImage: (f['Default OG Image'] && f['Default OG Image'][0] && f['Default OG Image'][0].url) || ''
    };
  } catch (e) {
    console.warn('[share-meta] Settings fetch failed, skipping config');
    return {};
  }
}

async function main() {
  try {
    const cloudinaryMapping = loadCloudinaryMapping();
    const config = await buildConfig();
    const defaultOgImage = config.defaultOgImage || '';
    const [projects, posts] = await Promise.all([buildProjects(cloudinaryMapping, defaultOgImage), buildPosts()]);
    const manifest = { generatedAt: new Date().toISOString(), projects, posts, config };
    const json = JSON.stringify(manifest, null, 2);
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_JSON, json, 'utf8');
    // Hash featured projects + public/scheduled posts for deployment trigger
    const hash = createHash('sha256').update(JSON.stringify(manifest.projects) + JSON.stringify(manifest.posts)).digest('hex');
    fs.writeFileSync(OUTPUT_HASH, hash, 'utf8');
    console.log(`[share-meta] Wrote manifest with ${projects.length} featured projects and ${posts.length} public posts.`);
    console.log(`[share-meta] Hash: ${hash} (featured projects + public journal entries)`);
  } catch (e) {
    console.error('[share-meta] ❌ Generation failed:', e.message);
    if (e.isRateLimit) {
      console.warn('[share-meta] ⚠️  Airtable rate limit hit. Preserving existing file.');
      process.exit(0); // Don't fail the build, keep existing data
    }
    if (fs.existsSync(OUTPUT_JSON)) {
      console.warn('[share-meta] ⚠️  Keeping existing share-meta.json intact.');
      process.exit(0); // Keep existing file
    }
    process.exit(1);
  }
}

main();
