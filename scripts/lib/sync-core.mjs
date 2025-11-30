/**
 * Core Sync Logic - Shared between GitHub Actions and Netlify Functions
 * 
 * This module contains the main orchestration logic for syncing data from Airtable,
 * generating static files, and uploading to Cloudinary. Used by:
 * - GitHub Actions workflow (sync-data.yml)
 * - Netlify Functions (sync-now.mjs)
 * - Local development (npm run build:data)
 */

import fs from 'fs';
import path from 'path';
import { getVideoThumbnail } from '../../utils/videoHelpers.mjs';
import { normalizeTitle, calculateReadingTime, parseCreditsText } from '../../utils/textHelpers.mjs';
import {
  fetchAirtableTable,
  buildLookupMaps,
  parseExternalLinks,
  makeSlug,
  normalizeProjectType,
  resolveProductionCompany,
  resolveAwards
} from './airtable-helpers.mjs';

/**
 * Main sync orchestration function
 * @param {Object} config - Configuration object
 * @param {string} config.airtableToken - Airtable API token
 * @param {string} config.airtableBaseId - Airtable base ID
 * @param {string} config.outputDir - Directory for output files (default: 'public')
 * @param {boolean} config.verbose - Enable verbose logging
 * @returns {Promise<Object>} Sync results with success status and generated data
 */
export async function syncAllData(config) {
  const {
    airtableToken,
    airtableBaseId,
    outputDir = 'public',
    verbose = false
  } = config;

  if (!airtableToken || !airtableBaseId) {
    throw new Error('Missing required Airtable credentials');
  }

  const results = {
    success: false,
    projects: [],
    journal: [],
    about: null,
    config: null,
    errors: [],
    timestamp: new Date().toISOString()
  };

  try {
    if (verbose) console.log('[sync-core] 🔄 Starting data sync...');

    // Build lookup maps for festivals and clients
    const { festivalsMap, clientsMap } = await buildLookupMaps(airtableToken, airtableBaseId);
    if (verbose) console.log('[sync-core] ✅ Built lookup maps');

    // Load Cloudinary mapping if exists
    const cloudinaryMapping = loadCloudinaryMapping(outputDir);

    // Sync projects
    results.projects = await buildProjects(
      festivalsMap,
      clientsMap,
      cloudinaryMapping,
      airtableToken,
      airtableBaseId,
      verbose
    );
    if (verbose) console.log(`[sync-core] ✅ Synced ${results.projects.length} projects`);

    // Sync journal posts
    results.journal = await buildJournal(
      airtableToken,
      airtableBaseId,
      verbose
    );
    if (verbose) console.log(`[sync-core] ✅ Synced ${results.journal.length} journal posts`);

    // Sync about page data
    results.about = await buildAbout(
      airtableToken,
      airtableBaseId,
      verbose
    );
    if (verbose) console.log('[sync-core] ✅ Synced about page data');

    // Sync config/settings data
    results.config = await buildConfig(
      airtableToken,
      airtableBaseId,
      verbose
    );
    if (verbose) console.log('[sync-core] ✅ Synced config/settings data');

    // Save portfolio data
    const portfolioData = {
      projects: results.projects,
      posts: results.journal, // Use 'posts' for consistency with frontend
      about: results.about,
      config: results.config,
      generatedAt: results.timestamp
    };

    const outputFile = path.join(outputDir, 'portfolio-data.json');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(portfolioData, null, 2));
    
    if (verbose) console.log(`[sync-core] ✅ Wrote ${outputFile}`);

    results.success = true;
    return results;

  } catch (error) {
    results.errors.push(error.message);
    console.error('[sync-core] ❌ Sync failed:', error.message);
    
    // Mark rate limit errors for special handling
    if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
      error.isRateLimit = true;
    }
    
    throw error;
  }
}

/**
 * Build projects from Airtable
 */
async function buildProjects(festivalsMap, clientsMap, cloudinaryMapping, token, baseId, verbose) {
  if (verbose) console.log('[sync-core] 📦 Building projects...');
  const records = await fetchAirtableTable('Projects', 'Release Date', token, baseId);
  const projects = [];
  
  // Build cloudinary lookup map
  const cloudinaryMap = {};
  if (cloudinaryMapping?.projects) {
    cloudinaryMapping.projects.forEach(project => {
      cloudinaryMap[project.recordId] = project.images || [];
    });
  }

  for (const r of records) {
    const f = r.fields || {};
    
    // Check Display Status field
    const displayStatus = f['Display Status'] || '';
    if (displayStatus === 'Hidden' || !displayStatus) continue;

    const rawTitle = f['Name'] || 'Untitled';
    const title = normalizeTitle(rawTitle);
    const releaseDate = f['Release Date'] || '';
    const workDate = f['Work Date'] || releaseDate;
    const description = f['Description'] || '';
    const role = f['Role'] || '';
    const category = normalizeProjectType(f['Project Type'] || '');
    
    // Parse credits
    const rawCredits = f['Credits (new)'] || f['Credits'] || '';
    const credits = parseCreditsText(rawCredits);
    
    // Parse external links
    const rawLinks = f['External Links'] || '';
    const { links, videos } = parseExternalLinks(rawLinks);
    
    // Get video thumbnail if available
    let videoThumbnail = null;
    if (videos.length > 0) {
      videoThumbnail = await getVideoThumbnail(videos[0]);
    }
    
    // Build image URLs (prefer Cloudinary if available)
    const galleryAttachments = f['Gallery (Image)'] || [];
    const images = galleryAttachments.map((att, idx) => {
      const cloudinaryImg = cloudinaryMap[r.id]?.[idx];
      return {
        url: cloudinaryImg?.cloudinaryUrl || att.url,
        thumbnails: att.thumbnails,
        width: att.width,
        height: att.height,
        type: att.type
      };
    });
    
    // Resolve awards
    const festivalIds = f['Awards'] || [];
    const awards = resolveAwards(festivalIds, festivalsMap);
    
    // Resolve production company
    const productionCompanyId = f['Production Company']?.[0];
    const productionCompany = resolveProductionCompany(productionCompanyId, clientsMap);
    
    projects.push({
      id: r.id,
      slug: makeSlug(title),
      title,
      releaseDate,
      workDate,
      description,
      role,
      category,
      credits,
      images,
      videos,
      videoThumbnail,
      externalLinks: links,
      awards,
      productionCompany,
      displayStatus
    });
  }

  return projects;
}

/**
 * Build journal posts from Airtable
 */
async function buildJournal(token, baseId, verbose) {
  if (verbose) console.log('[sync-core] 📝 Building journal posts...');
  const records = await fetchAirtableTable('Journal', 'Publish Date', token, baseId);
  const posts = [];

  for (const r of records) {
    const f = r.fields || {};
    
    const status = f['Status'] || '';
    if (status !== 'Published') continue;

    const title = normalizeTitle(f['Title'] || 'Untitled');
    const publishDate = f['Publish Date'] || '';
    const content = f['Content'] || '';
    const excerpt = f['Excerpt'] || '';
    const readingTime = calculateReadingTime(content);
    
    // Handle images
    const coverAttachments = f['Cover Image'] || [];
    const coverImage = coverAttachments[0] ? {
      url: coverAttachments[0].url,
      thumbnails: coverAttachments[0].thumbnails,
      width: coverAttachments[0].width,
      height: coverAttachments[0].height
    } : null;

    posts.push({
      id: r.id,
      slug: makeSlug(title),
      title,
      publishDate,
      content,
      excerpt,
      readingTime,
      coverImage,
      status
    });
  }

  return posts;
}

/**
 * Build about page data from Airtable
 */
async function buildAbout(token, baseId, verbose) {
  if (verbose) console.log('[sync-core] 👤 Building about page...');
  const records = await fetchAirtableTable('About', null, token, baseId);
  
  if (records.length === 0) {
    return { bio: '', picture: null };
  }

  const f = records[0].fields || {};
  const bio = f['Bio'] || '';
  const pictureAttachments = f['Picture'] || [];
  const picture = pictureAttachments[0] ? {
    url: pictureAttachments[0].url,
    thumbnails: pictureAttachments[0].thumbnails,
    width: pictureAttachments[0].width,
    height: pictureAttachments[0].height
  } : null;

  return { bio, picture };
}

/**
 * Build config/settings data from Airtable
 */
async function buildConfig(token, baseId, verbose) {
  if (verbose) console.log('[sync-core] ⚙️  Building config/settings...');
  try {
    const records = await fetchAirtableTable('Settings', null, token, baseId);
    
    if (records.length === 0) {
      return { defaultOgImage: '' };
    }

    const f = records[0].fields || {};
    const defaultOgImageAttachments = f['Default OG Image'] || [];
    const defaultOgImage = defaultOgImageAttachments[0] ? defaultOgImageAttachments[0].url : '';

    return { defaultOgImage };
  } catch (error) {
    console.warn('[sync-core] ⚠️ Could not fetch Settings table:', error.message);
    return { defaultOgImage: '' };
  }
}

/**
 * Load existing Cloudinary mapping
 */
function loadCloudinaryMapping(outputDir) {
  try {
    const mappingFile = path.join(outputDir, 'cloudinary-mapping.json');
    if (fs.existsSync(mappingFile)) {
      const content = fs.readFileSync(mappingFile, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('[sync-core] ⚠️ Could not load Cloudinary mapping:', error.message);
  }
  return null;
}
