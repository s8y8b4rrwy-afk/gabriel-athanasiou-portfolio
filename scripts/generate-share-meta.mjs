#!/usr/bin/env node
// Build-time manifest generator for share metadata.
// Minimal fields only: slug, title, description, heroImage (or socialImage), type, year.
// Requires env vars: AIRTABLE_TOKEN, AIRTABLE_BASE_ID.

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getVideoId, getVideoThumbnail } from '../utils/videoHelpers.mjs';
import { normalizeTitle } from '../utils/textHelpers.mjs';

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.VITE_AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID || '';

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
  console.error('[share-meta] Missing Airtable credentials. Skipping manifest generation.');
  process.exit(0); // Non-fatal: leave existing file.
}

const OUTPUT_DIR = path.resolve('public');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'share-meta.json');
const OUTPUT_HASH = path.join(OUTPUT_DIR, 'share-meta.hash');

// Fetch a full Airtable table (similar to cmsService) but minimal & resilient.
async function fetchAirtableTable(tableName, sortField) {
  const sortParam = sortField ? `&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(sortField)}&sort%5B0%5D%5Bdirection%5D=desc` : '';
  let allRecords = [];
  let offset = null;
  do {
    const offsetParam = offset ? `&offset=${offset}` : '';
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?${sortParam}${offsetParam}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
    if (!res.ok) {
      console.warn(`[share-meta] Table fetch failed: ${tableName} ${res.status}`);
      break; // Return what we have so far.
    }
    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset;
  } while (offset);
  return allRecords;
}

function makeSlug(base) {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

async function buildProjects() {
  const records = await fetchAirtableTable('Projects', 'Release Date');
  const items = [];
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
    const gallery = (f['Gallery'] || []).map(img => img.url).filter(Boolean);
    const heroImage = gallery[0] || '';
    
    // Try video thumbnail if no gallery image
    let videoThumbnail = '';
    if (!heroImage && f['Video URL']) {
      const rawVideoUrls = f['Video URL'].split(/[,|\n]+/).map(s => s.trim()).filter(Boolean);
      if (rawVideoUrls.length > 0) {
        videoThumbnail = await getVideoThumbnail(rawVideoUrls[0]);
      }
    }
    
    // Priority: Social Image > Gallery > Video Thumbnail > Empty
    const socialImage = (f['Social Image'] && f['Social Image'][0] && f['Social Image'][0].url) || heroImage || videoThumbnail || '';
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
  const records = await fetchAirtableTable('Journal', 'Date');
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
    const records = await fetchAirtableTable('Settings');
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
    const [projects, posts, config] = await Promise.all([buildProjects(), buildPosts(), buildConfig()]);
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
    console.error('[share-meta] Generation failed:', e);
    process.exit(1);
  }
}

main();
