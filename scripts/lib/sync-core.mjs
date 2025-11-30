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

    // Sync config/settings data FIRST - we need it for owner credits
    results.config = await buildConfig(
      airtableToken,
      airtableBaseId,
      verbose
    );
    if (verbose) console.log('[sync-core] ✅ Synced config/settings data');

    // Sync projects (pass owner info for credits)
    results.projects = await buildProjects(
      festivalsMap,
      clientsMap,
      cloudinaryMapping,
      airtableToken,
      airtableBaseId,
      results.config,
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

    // Save portfolio data
    const portfolioData = {
      projects: results.projects,
      posts: results.journal, // Use 'posts' for consistency with frontend
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
async function buildProjects(festivalsMap, clientsMap, cloudinaryMapping, token, baseId, config, verbose) {
  if (verbose) console.log('[sync-core] 📦 Building projects...');
  const records = await fetchAirtableTable('Projects', 'Release Date', token, baseId);
  const projects = [];
  
  // Extract owner info from config
  const ownerName = config?.portfolioOwnerName || '';
  const allowedRoles = config?.allowedRoles || [];
  
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
    const roleField = f['Role'] || null;  // Keep raw role field (might be string or array)
    const category = normalizeProjectType(f['Project Type'] || '');
    
    // Parse credits from Credits field
    const rawCredits = f['Credits (new)'] || f['Credits'] || '';
    const extraCredits = parseCreditsText(rawCredits);
    
    // Prepend owner's credits based on Role field and allowed roles
    const ownerCredits = [];
    if (ownerName && allowedRoles.length > 0 && roleField) {
      // Role field might be a string or array (depends on Airtable field type)
      const projectRoles = Array.isArray(roleField) ? roleField : [roleField];
      
      // Filter to only allowed roles
      const matchingRoles = projectRoles.filter(r => allowedRoles.includes(r));
      
      // Create credit entry for each matching role
      matchingRoles.forEach(r => {
        ownerCredits.push({
          role: r,
          name: ownerName
        });
      });
      
      if (verbose && matchingRoles.length > 0) {
        console.log(`[sync-core] ✨ Added ${matchingRoles.length} owner credit(s) to "${title}"`);
      }
    }
    
    // Combine owner credits first, then additional credits
    const credits = [...ownerCredits, ...extraCredits];
    
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
      role: roleField,
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
 * Build config/settings data from Airtable
 */
async function buildConfig(token, baseId, verbose) {
  if (verbose) console.log('[sync-core] ⚙️  Building config/settings...');
  try {
    const records = await fetchAirtableTable('Settings', null, token, baseId);
    
    if (records.length === 0) {
      return getDefaultSettings();
    }

    const f = records[0].fields || {};
    
    // Extract showreel fields
    const showreelEnabled = f['Showreel Enabled'] || false;
    const showreelUrl = f['Showreel URL'] || '';
    const showreelPlaceholderAttachments = f['Showreel Placeholder'] || [];
    const showreelPlaceholderImage = showreelPlaceholderAttachments[0] ? showreelPlaceholderAttachments[0].url : '';
    
    // Extract contact fields
    const contactEmail = f['Contact Email'] || '';
    const contactPhone = f['Contact Phone'] || '';
    const repUK = f['Rep UK'] || '';
    const repUSA = f['Rep USA'] || '';
    const instagramUrl = f['Instagram URL'] || '';
    const vimeoUrl = f['Vimeo URL'] || '';
    const linkedinUrl = f['Linkedin URL'] || ''; 
    
    // Extract about fields
    const bio = f['Bio'] || '';
    const aboutImageAttachments = f['About Image'] || [];
    const aboutProfileImage = aboutImageAttachments[0] ? aboutImageAttachments[0].url : '';
    
    // Extract other settings
    const name = f['Name'] || '';
    const allowedRolesRaw = f['Allowed Roles'] || '';
    const allowedRoles = allowedRolesRaw ? allowedRolesRaw.split(',').map(r => r.trim()).filter(r => r) : [];
    
    const defaultOgImageAttachments = f['Default OG Image'] || [];
    const defaultOgImage = defaultOgImageAttachments[0] ? defaultOgImageAttachments[0].url : '';
    
    const lastModified = f['Last Modified'] || '';

    // Return in the nested structure expected by HomeConfig interface
    return {
      showreel: {
        enabled: showreelEnabled,
        videoUrl: showreelUrl,
        placeholderImage: showreelPlaceholderImage
      },
      contact: {
        email: contactEmail,
        phone: contactPhone,
        repUK: repUK,
        repUSA: repUSA,
        instagram: instagramUrl,
        vimeo: vimeoUrl,
        linkedin: linkedinUrl
      },
      about: {
        bio: bio,
        profileImage: aboutProfileImage
      },
      allowedRoles: allowedRoles,
      defaultOgImage: defaultOgImage,
      portfolioOwnerName: name,
      lastModified: lastModified
    };
  } catch (error) {
    console.warn('[sync-core] ⚠️ Could not fetch Settings table:', error.message);
    return getDefaultSettings();
  }
}

/**
 * Get default settings structure when Settings table is unavailable
 */
function getDefaultSettings() {
  return {
    showreel: {
      enabled: false,
      videoUrl: '',
      placeholderImage: ''
    },
    contact: {
      email: '',
      phone: '',
      repUK: '',
      repUSA: '',
      instagram: '',
      vimeo: '',
      linkedin: ''
    },
    about: {
      bio: '',
      profileImage: ''
    },
    allowedRoles: [],
    defaultOgImage: '',
    portfolioOwnerName: '',
    lastModified: ''
  };
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
