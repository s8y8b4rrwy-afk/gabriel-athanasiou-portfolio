// schedule import removed - no automatic scheduling
import fetch from 'node-fetch';
import { writeFile, readFile, mkdir, existsSync } from 'fs/promises';
import { existsSync as existsSyncSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

// Import shared utilities
import { normalizeTitle, parseCreditsText, calculateReadingTime } from '../../utils/textHelpers.mjs';
import { getVideoId, resolveVideoUrl } from '../../utils/videoHelpers.mjs';
import { fetchWithTimeout, parseExternalLinksData } from '../../utils/networkHelpers.mjs';
import { loadCachedData, saveJsonFile, loadJsonFile, getDataBaseDir } from '../../utils/fileHelpers.mjs';
import { uploadToCloudinary as uploadToCloudinaryHelper, configureCloudinary, generateEagerTransformations } from '../../utils/cloudinaryHelpers.mjs';

// Helper to get __dirname safely (only when needed)
const getDirname = () => {
  if (typeof import.meta.url === 'undefined') {
    // Fallback for bundled/CommonJS context
    return process.cwd();
  }
  const __filename = fileURLToPath(import.meta.url);
  return path.dirname(__filename);
};

// ==========================================
// CONFIGURATION
// ==========================================
const AIRTABLE_TOKEN = process.env.VITE_AIRTABLE_TOKEN || process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;

// Fallback bio picture with Cloudinary transformation presets (ultra quality)
const FALLBACK_BIO_IMAGE = 'https://res.cloudinary.com/date24ay6/image/upload/f_webp,q_90,w_1600,c_limit/v1764382938/ZAF08121_nagmpv.jpg';

// Cloudinary configuration
const USE_CLOUDINARY = process.env.USE_CLOUDINARY === 'true';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Initialize Cloudinary if enabled and credentials available
if (USE_CLOUDINARY) {
  const configured = configureCloudinary(cloudinary, {
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    apiSecret: CLOUDINARY_API_SECRET
  });
  
  if (!configured) {
    console.warn('⚠️ USE_CLOUDINARY=true but credentials missing');
  }
}

// NOTE: Image optimization temporarily disabled due to Sharp compatibility issues
// Images will use Airtable URLs directly (already CDN-served)
// See IMPLEMENTATION_LOG.md for future optimization options

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Load existing Cloudinary mapping
const loadCloudinaryMapping = async () => {
  try {
    const mappingPath = path.join(process.cwd(), 'public', 'cloudinary-mapping.json');
    const content = await readFile(mappingPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.log('No existing Cloudinary mapping found, starting fresh');
    return { generatedAt: new Date().toISOString(), projects: [], journal: [] };
  }
};

// Save updated Cloudinary mapping
const saveCloudinaryMapping = async (mapping) => {
  try {
    const mappingPath = path.join(process.cwd(), 'public', 'cloudinary-mapping.json');
    await mkdir(path.dirname(mappingPath), { recursive: true });
    await writeFile(mappingPath, JSON.stringify(mapping, null, 2), 'utf-8');
    console.log(`✅ Updated cloudinary-mapping.json (${mapping.projects.length} projects, ${mapping.journal.length} journal posts)`);
  } catch (error) {
    console.error('Failed to save Cloudinary mapping:', error);
  }
};

// Upload image to Cloudinary using shared helper
// Images uploaded at original quality with no transformations
const uploadToCloudinary = async (imageUrl, publicId, title = '') => {
  return uploadToCloudinaryHelper(cloudinary, imageUrl, publicId, {
    title
  });
};

// Process Cloudinary uploads for changed/new images
const syncImagesToCloudinary = async (projects, posts, existingMapping) => {
  if (!USE_CLOUDINARY) {
    console.log('⏭️ Cloudinary disabled (USE_CLOUDINARY=false)');
    return existingMapping;
  }
  
  console.log('🔄 Checking for new/changed images to upload to Cloudinary...');
  
  // Build lookup of existing images
  const existingImages = new Set();
  existingMapping.projects.forEach(p => {
    p.images?.forEach(img => existingImages.add(img.publicId));
  });
  existingMapping.journal.forEach(p => {
    p.images?.forEach(img => existingImages.add(img.publicId));
  });
  
  const newMapping = {
    generatedAt: new Date().toISOString(),
    projects: [],
    journal: [],
    config: { images: [] }
  };
  
  let uploadCount = 0;
  let skipCount = 0;
  let failCount = 0;
  
  // Process projects
  for (const project of projects) {
    const projectData = {
      recordId: project.id,
      title: project.title,
      images: []
    };
    
    // Upload gallery images
    const galleryAttachments = project._galleryAttachments || [];
    for (let i = 0; i < galleryAttachments.length; i++) {
      const attachment = galleryAttachments[i];
      const imageUrl = attachment.url;
      const airtableId = attachment.id || '';
      const publicId = `portfolio-projects-${project.id}-${i}`;
      
      // Check if already uploaded using Airtable attachment ID (stable identifier)
      const existingProject = existingMapping.projects.find(p => p.recordId === project.id);
      const existingImage = existingProject?.images?.find(img => img.index === i);
      
      // Image unchanged if Airtable ID matches (IDs are stable, URLs change)
      if (existingImage && existingImage.airtableId && existingImage.airtableId === airtableId) {
        // Image unchanged, keep existing entry
        projectData.images.push(existingImage);
        skipCount++;
      } else {
        // New or changed image, upload at original quality
        const result = await uploadToCloudinary(imageUrl, publicId, project.title);
        
        if (result.success) {
          projectData.images.push({
            index: i,
            publicId: result.publicId,
            cloudinaryUrl: result.cloudinaryUrl,
            airtableId: airtableId, // Store Airtable ID for future comparisons
            airtableUrl: imageUrl, // Store current URL for reference
            filename: attachment.filename || '',
            size: attachment.size || result.size,
            format: result.format
          });
          uploadCount++;
        } else {
          // Upload failed, keep Airtable URL as fallback
          projectData.images.push({
            index: i,
            publicId: publicId,
            cloudinaryUrl: '',
            airtableId: airtableId,
            airtableUrl: imageUrl,
            filename: attachment.filename || '',
            error: result.error
          });
          failCount++;
        }
      }
    }
    
    newMapping.projects.push(projectData);
  }
  
  // Process journal posts
  for (const post of posts) {
    const coverImageAttachment = post._coverImageAttachment;
    if (!coverImageAttachment) continue;
    
    const postData = {
      recordId: post.id,
      title: post.title,
      images: []
    };
    
    const publicId = `portfolio-journal-${post.id}`;
    const airtableId = coverImageAttachment.id || '';
    const imageUrl = coverImageAttachment.url;
    
    // Check if already uploaded using Airtable attachment ID
    const existingPost = existingMapping.journal.find(p => p.recordId === post.id);
    const existingImage = existingPost?.images?.[0];
    
    // Image unchanged if Airtable ID matches
    if (existingImage && existingImage.airtableId && existingImage.airtableId === airtableId) {
      // Image unchanged
      postData.images.push(existingImage);
      skipCount++;
    } else {
      // New or changed image
      const result = await uploadToCloudinary(imageUrl, publicId, post.title);
      
      if (result.success) {
        postData.images.push({
          index: 0,
          publicId: result.publicId,
          cloudinaryUrl: result.cloudinaryUrl,
          airtableId: airtableId, // Store Airtable ID for future comparisons
          airtableUrl: imageUrl, // Store current URL for reference
          filename: coverImageAttachment.filename || '',
          size: coverImageAttachment.size || result.size,
          format: result.format
        });
        uploadCount++;
      } else {
        postData.images.push({
          index: 0,
          publicId: publicId,
          cloudinaryUrl: '',
          airtableId: airtableId,
          airtableUrl: imageUrl,
          filename: coverImageAttachment.filename || '',
          error: result.error
        });
        failCount++;
      }
    }
    
    newMapping.journal.push(postData);
  }
  
  // Process config images (profile image, showreel placeholder)
  const configImages = [];
  
  // Profile image
  if (config.about?.profileImage) {
    const publicId = 'portfolio-config-profile';
    const existingConfigImage = existingMapping.config?.images?.find(img => img.type === 'profile');
    
    if (existingConfigImage && existingConfigImage.originalUrl === config.about.profileImage) {
      configImages.push(existingConfigImage);
      skipCount++;
    } else {
      const result = await uploadToCloudinary(config.about.profileImage, publicId, 'Profile Image');
      
      if (result.success) {
        configImages.push({
          type: 'profile',
          publicId: result.publicId,
          cloudinaryUrl: result.cloudinaryUrl,
          originalUrl: config.about.profileImage,
          format: result.format,
          size: result.size
        });
        uploadCount++;
      } else {
        configImages.push({
          type: 'profile',
          publicId: publicId,
          cloudinaryUrl: '',
          originalUrl: config.about.profileImage,
          error: result.error
        });
        failCount++;
      }
    }
  }
  
  // Showreel placeholder
  if (config.showreel?.placeholderImage) {
    const publicId = 'portfolio-config-showreel';
    const existingConfigImage = existingMapping.config?.images?.find(img => img.type === 'showreel');
    
    if (existingConfigImage && existingConfigImage.originalUrl === config.showreel.placeholderImage) {
      configImages.push(existingConfigImage);
      skipCount++;
    } else {
      const result = await uploadToCloudinary(config.showreel.placeholderImage, publicId, 'Showreel Placeholder');
      
      if (result.success) {
        configImages.push({
          type: 'showreel',
          publicId: result.publicId,
          cloudinaryUrl: result.cloudinaryUrl,
          originalUrl: config.showreel.placeholderImage,
          format: result.format,
          size: result.size
        });
        uploadCount++;
      } else {
        configImages.push({
          type: 'showreel',
          publicId: publicId,
          cloudinaryUrl: '',
          originalUrl: config.showreel.placeholderImage,
          error: result.error
        });
        failCount++;
      }
    }
  }
  
  newMapping.config.images = configImages;
  
  console.log(`✅ Cloudinary sync complete: ${uploadCount} uploaded, ${skipCount} unchanged, ${failCount} failed`);
  
  // Save updated mapping
  await saveCloudinaryMapping(newMapping);
  
  return newMapping;
};

// Calculate hash of data to detect changes (duplicate removed above)
// const hashData = (data) => {
//   return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
// };

// Network and file system utilities now imported from shared helpers
// See utils/networkHelpers.mjs and utils/fileHelpers.mjs

// Fetch all records from an Airtable table with pagination
const fetchAirtableTable = async (tableName, sortField) => {
  const sortParam = sortField 
    ? `&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(sortField)}&sort%5B0%5D%5Bdirection%5D=desc` 
    : '';
  
  let allRecords = [];
  let offset = null;
  
  try {
    do {
      const offsetParam = offset ? `&offset=${offset}` : '';
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?${sortParam}${offsetParam}`;
      
      const res = await fetchWithTimeout(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
      });
      
      if (!res.ok) {
        // Check for rate limiting
        if (res.status === 429) {
          const error = new Error(`Rate limit exceeded for ${tableName}`);
          error.isRateLimit = true;
          error.statusCode = 429;
          throw error;
        }
        
        // Tolerant for optional tables
        if (['Awards', 'Festivals', 'Settings', 'Journal', 'Clients', 'Client Book'].includes(tableName)) {
          console.log(`Optional table ${tableName} not found or empty`);
          return [];
        }
        throw new Error(`Failed to fetch ${tableName}: ${res.statusText}`);
      }
      
      const data = await res.json();
      allRecords = [...allRecords, ...(data.records || [])];
      offset = data.offset;
    } while (offset);
    
    console.log(`Fetched ${allRecords.length} records from ${tableName}`);
    return allRecords;
  } catch (error) {
    if (tableName === 'Projects') throw error;
    console.warn(`Optional table ${tableName} failed to load:`, error.message);
    return [];
  }
};

// Fetch only record IDs and Last Modified timestamps (lightweight check)
// Returns array of {id, lastModified} objects
const fetchTimestamps = async (tableName) => {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?fields%5B%5D=Last%20Modified`;
  
  let allRecords = [];
  let offset = null;
  
  try {
    do {
      const offsetParam = offset ? `&offset=${offset}` : '';
      const fetchUrl = `${url}${offsetParam}`;
      
      const res = await fetchWithTimeout(fetchUrl, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
      });
      
      if (!res.ok) {
        if (res.status === 429) {
          const error = new Error(`Rate limit exceeded for ${tableName}`);
          error.isRateLimit = true;
          error.statusCode = 429;
          throw error;
        }
        
        // Tolerant for optional tables
        if (['Awards', 'Festivals', 'Settings', 'Journal', 'Clients', 'Client Book'].includes(tableName)) {
          console.log(`Optional table ${tableName} not found or empty`);
          return [];
        }
        throw new Error(`Failed to fetch timestamps from ${tableName}: ${res.statusText}`);
      }
      
      const data = await res.json();
      allRecords = [...allRecords, ...(data.records || [])];
      offset = data.offset;
    } while (offset);
    
    return allRecords.map(r => ({
      id: r.id,
      lastModified: r.fields['Last Modified'] || null
    }));
  } catch (error) {
    console.warn(`Failed to fetch timestamps from ${tableName}:`, error.message);
    return null; // Return null to indicate fetch failure (triggers full sync)
  }
};

// Fetch specific records by ID using filterByFormula
// recordIds: array of Airtable record IDs to fetch
const fetchChangedRecords = async (tableName, recordIds, sortField) => {
  if (!recordIds || recordIds.length === 0) {
    return [];
  }
  
  // Build OR formula: OR(RECORD_ID()='rec1', RECORD_ID()='rec2', ...)
  const conditions = recordIds.map(id => `RECORD_ID()='${id}'`).join(',');
  const formula = recordIds.length === 1 
    ? `RECORD_ID()='${recordIds[0]}'`
    : `OR(${conditions})`;
  
  const sortParam = sortField 
    ? `&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(sortField)}&sort%5B0%5D%5Bdirection%5D=desc` 
    : '';
  
  let allRecords = [];
  let offset = null;
  
  try {
    do {
      const offsetParam = offset ? `&offset=${offset}` : '';
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?filterByFormula=${encodeURIComponent(formula)}${sortParam}${offsetParam}`;
      
      const res = await fetchWithTimeout(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
      });
      
      if (!res.ok) {
        if (res.status === 429) {
          const error = new Error(`Rate limit exceeded for ${tableName}`);
          error.isRateLimit = true;
          error.statusCode = 429;
          throw error;
        }
        throw new Error(`Failed to fetch records from ${tableName}: ${res.statusText}`);
      }
      
      const data = await res.json();
      allRecords = [...allRecords, ...(data.records || [])];
      offset = data.offset;
    } while (offset);
    
    console.log(`✅ Fetched ${allRecords.length} changed records from ${tableName}`);
    return allRecords;
  } catch (error) {
    console.error(`Failed to fetch changed records from ${tableName}:`, error.message);
    throw error;
  }
};

// Check which records have changed since last sync
// Returns: { changed: {tableName: [recordIds]}, new: {tableName: [recordIds]}, deleted: {tableName: [recordIds]} }
const checkForChanges = async (previousSyncMetadata) => {
  console.log('🔍 Checking for changes...');
  
  const tables = [
    { name: 'Projects', sortField: 'Release Date' },
    { name: 'Journal', sortField: 'Date' },
    { name: 'Festivals', sortField: null },
    { name: 'Client Book', sortField: null },
    { name: 'Settings', sortField: null }
  ];
  
  const changes = {
    changed: {},
    new: {},
    deleted: {},
    apiCalls: 0
  };
  
  for (const table of tables) {
    const currentTimestamps = await fetchTimestamps(table.name);
    changes.apiCalls++;
    
    // If fetch failed, trigger full sync for this table
    if (currentTimestamps === null) {
      console.log(`⚠️ Failed to fetch timestamps for ${table.name}, will do full sync`);
      changes.changed[table.name] = 'full-sync';
      continue;
    }
    
    const previousTimestamps = previousSyncMetadata?.timestamps?.[table.name] || {};
    const currentIds = new Set(currentTimestamps.map(r => r.id));
    const previousIds = new Set(Object.keys(previousTimestamps));
    
    // Find new records
    const newRecords = currentTimestamps.filter(r => !previousIds.has(r.id));
    if (newRecords.length > 0) {
      changes.new[table.name] = newRecords.map(r => r.id);
      console.log(`  📝 ${table.name}: ${newRecords.length} new record(s)`);
    }
    
    // Find changed records (existing records with different timestamps)
    const changedRecords = currentTimestamps.filter(r => {
      if (!previousIds.has(r.id)) return false; // Skip new records
      const prevTimestamp = previousTimestamps[r.id];
      const currTimestamp = r.lastModified;
      return prevTimestamp !== currTimestamp;
    });
    if (changedRecords.length > 0) {
      changes.changed[table.name] = changedRecords.map(r => r.id);
      console.log(`  ✏️  ${table.name}: ${changedRecords.length} changed record(s)`);
    }
    
    // Find deleted records
    const deletedIds = [...previousIds].filter(id => !currentIds.has(id));
    if (deletedIds.length > 0) {
      changes.deleted[table.name] = deletedIds;
      console.log(`  🗑️  ${table.name}: ${deletedIds.length} deleted record(s)`);
    }
    
    // Store current timestamps for next sync
    const timestampMap = {};
    currentTimestamps.forEach(r => {
      timestampMap[r.id] = r.lastModified;
    });
    
    // Create timestamps object if it doesn't exist
    if (!changes.currentTimestamps) {
      changes.currentTimestamps = {};
    }
    changes.currentTimestamps[table.name] = timestampMap;
  }
  
  const totalChanged = Object.values(changes.changed).reduce((sum, ids) => sum + (Array.isArray(ids) ? ids.length : 0), 0);
  const totalNew = Object.values(changes.new).reduce((sum, ids) => sum + ids.length, 0);
  const totalDeleted = Object.values(changes.deleted).reduce((sum, ids) => sum + ids.length, 0);
  
  console.log(`✅ Change detection complete: ${totalNew} new, ${totalChanged} changed, ${totalDeleted} deleted (${changes.apiCalls} API calls)`);
  
  return changes;
};

// Image optimization functions removed - keeping Airtable URLs directly
// See IMPLEMENTATION_LOG.md for future optimization options

// Text processing and video utilities now imported from shared helpers
// See utils/textHelpers.mjs, utils/videoHelpers.mjs

const fetchVideoThumbnail = async (videoUrl) => {
  if (!videoUrl) return '';
  
  const { type, id, hash } = getVideoId(videoUrl);
  
  try {
    if (type === 'youtube') {
      return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
    } else if (type === 'vimeo') {
      // Use OEmbed for all Vimeo videos - handles vanity URLs, private videos, and regular videos
      try {
        const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`;
        const res = await fetchWithTimeout(oembedUrl, {}, 5000);
        if (res.ok) {
          const data = await res.json();
          return data.thumbnail_url || data.thumbnail_url_with_play_button || '';
        }
      } catch (oembedError) {
        console.warn(`Vimeo OEmbed failed for ${videoUrl}, trying v2 API`);
      }
      
      // Fallback to v2 API if ID is numeric and OEmbed failed
      const isNumericId = /^\d+$/.test(id);
      if (isNumericId) {
        const res = await fetchWithTimeout(`https://vimeo.com/api/v2/video/${id}.json`, {}, 5000);
        if (res.ok) {
          const data = await res.json();
          return data[0]?.thumbnail_large || '';
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch video thumbnail for ${videoUrl}:`, error.message);
  }
  
  return '';
};

// parseExternalLinksData now imported from shared helpers (utils/networkHelpers.mjs)

// ==========================================
// SITEMAP GENERATION
// ==========================================

const generateSitemap = (projects, posts) => {
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
  projects.forEach(project => {
    const lastmod = project.year ? `${project.year}-01-01` : currentDate;
    const isNarrative = project.type === 'Narrative';
    const priority = isNarrative ? '0.9' : (project.isFeatured ? '0.8' : '0.7');
    
    xml += `  <url>\n    <loc>${baseUrl}/work/${project.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
  });

  // Journal posts
  posts.forEach(post => {
    const lastmod = post.date || currentDate;
    xml += `  <url>\n    <loc>${baseUrl}/journal/${post.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
  });

  xml += '</urlset>';
  return xml;
};

// ==========================================
// SHARE META GENERATION
// ==========================================

const generateShareMeta = (projects, posts, config) => {
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
    posts: posts.map(p => ({
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
  
  return manifest;
};

// ==========================================
// MAIN SYNC LOGIC
// ==========================================

const syncAirtableData = async (options = {}) => {
  const { forceFullSync = false } = options;
  
  console.log('=== Starting Airtable Sync ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Mode: ${forceFullSync ? 'FULL SYNC (forced)' : 'INCREMENTAL (change detection enabled)'}`);
  
  // Check configuration
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    throw new Error('Airtable credentials not configured');
  }
  
  let syncStats = {
    mode: forceFullSync ? 'full' : 'incremental',
    apiCalls: 0,
    changedRecords: 0,
    newRecords: 0,
    deletedRecords: 0,
    unchangedRecords: 0,
    tablesUpdated: []
  };
  
  try {
    // Load previous sync metadata (for change detection)
    let previousData = null;
    if (!forceFullSync) {
      previousData = await loadCachedData();
    }
    
    let awardsRecords, clientsRecords, projectsRecords, journalRecords, settingsRecords;
    
    if (forceFullSync || !previousData || !previousData.syncMetadata) {
      // FULL SYNC: Fetch all records from all tables
      console.log('📥 Fetching all data from Airtable (full sync)...');
      [awardsRecords, clientsRecords, projectsRecords, journalRecords, settingsRecords] = await Promise.all([
        fetchAirtableTable('Festivals'),
        fetchAirtableTable('Client Book'),
        fetchAirtableTable('Projects', 'Release Date'),
        fetchAirtableTable('Journal', 'Date'),
        fetchAirtableTable('Settings')
      ]);
      
      syncStats.apiCalls += 5; // 5 table fetches
      syncStats.newRecords = projectsRecords.length + journalRecords.length + awardsRecords.length + clientsRecords.length + settingsRecords.length;
      
    } else {
      // INCREMENTAL SYNC: Check for changes first
      const changeDetection = await checkForChanges(previousData.syncMetadata);
      syncStats.apiCalls += changeDetection.apiCalls; // Timestamp checks (5 API calls)
      
      const hasAnyChanges = 
        Object.keys(changeDetection.changed).length > 0 ||
        Object.keys(changeDetection.new).length > 0 ||
        Object.keys(changeDetection.deleted).length > 0;
      
      if (!hasAnyChanges) {
        console.log('✅ No changes detected - using cached data');
        
        // Return cached data with updated sync info
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
            'X-Sync-Mode': 'cached'
          },
          body: JSON.stringify({
            ...previousData,
            lastUpdated: new Date().toISOString(),
            syncStats: {
              ...syncStats,
              message: 'No changes detected',
              apiCallsSaved: '~45 calls saved'
            }
          })
        };
      }
      
      console.log('📥 Fetching changed records only...');
      
      // Fetch only changed/new records for each table
      const tables = [
        { name: 'Festivals', sortField: null },
        { name: 'Client Book', sortField: null },
        { name: 'Projects', sortField: 'Release Date' },
        { name: 'Journal', sortField: 'Date' },
        { name: 'Settings', sortField: null }
      ];
      
      // Fetch changed records
      const fetchPromises = tables.map(async (table) => {
        const changedIds = changeDetection.changed[table.name] || [];
        const newIds = changeDetection.new[table.name] || [];
        const allChangedIds = [...changedIds, ...newIds];
        
        // Check if full sync is needed for this table
        if (changedIds === 'full-sync') {
          console.log(`⚠️ Full sync required for ${table.name}`);
          return { tableName: table.name, records: await fetchAirtableTable(table.name, table.sortField), fullSync: true };
        }
        
        if (allChangedIds.length === 0) {
          return { tableName: table.name, records: [], fullSync: false };
        }
        
        const records = await fetchChangedRecords(table.name, allChangedIds, table.sortField);
        syncStats.apiCalls++; // Count API call for fetching changed records
        return { tableName: table.name, records, fullSync: false };
      });
      
      const results = await Promise.all(fetchPromises);
      
      // Map results to table-specific variables
      awardsRecords = results.find(r => r.tableName === 'Festivals').records;
      clientsRecords = results.find(r => r.tableName === 'Client Book').records;
      projectsRecords = results.find(r => r.tableName === 'Projects').records;
      journalRecords = results.find(r => r.tableName === 'Journal').records;
      settingsRecords = results.find(r => r.tableName === 'Settings').records;
      
      // Merge with cached data
      console.log('🔄 Merging with cached data...');
      
      // Build maps of changed record IDs for quick lookup
      const changedProjectIds = new Set([...(changeDetection.changed.Projects || []), ...(changeDetection.new.Projects || [])]);
      const changedJournalIds = new Set([...(changeDetection.changed.Journal || []), ...(changeDetection.new.Journal || [])]);
      const changedFestivalIds = new Set([...(changeDetection.changed.Festivals || []), ...(changeDetection.new.Festivals || [])]);
      const changedClientIds = new Set([...(changeDetection.changed['Client Book'] || []), ...(changeDetection.new['Client Book'] || [])]);
      const changedSettingsIds = new Set([...(changeDetection.changed.Settings || []), ...(changeDetection.new.Settings || [])]);
      
      const deletedProjectIds = new Set(changeDetection.deleted.Projects || []);
      const deletedJournalIds = new Set(changeDetection.deleted.Journal || []);
      const deletedFestivalIds = new Set(changeDetection.deleted.Festivals || []);
      const deletedClientIds = new Set(changeDetection.deleted['Client Book'] || []);
      
      // Create maps of new/changed records
      const newProjectsMap = new Map(projectsRecords.map(r => [r.id, r]));
      const newJournalMap = new Map(journalRecords.map(r => [r.id, r]));
      const newFestivalsMap = new Map(awardsRecords.map(r => [r.id, r]));
      const newClientsMap = new Map(clientsRecords.map(r => [r.id, r]));
      
      // Get cached raw records (need to reconstruct from previous sync)
      // Note: We don't store raw Airtable records, so we need to fetch them if not changed
      // For unchanged records, we'll fetch them all at once
      const unchangedProjectIds = (previousData._rawRecords?.projects || [])
        .map(r => r.id)
        .filter(id => !changedProjectIds.has(id) && !deletedProjectIds.has(id));
      const unchangedJournalIds = (previousData._rawRecords?.journal || [])
        .map(r => r.id)
        .filter(id => !changedJournalIds.has(id) && !deletedJournalIds.has(id));
      const unchangedFestivalIds = (previousData._rawRecords?.festivals || [])
        .map(r => r.id)
        .filter(id => !changedFestivalIds.has(id) && !deletedFestivalIds.has(id));
      const unchangedClientIds = (previousData._rawRecords?.clients || [])
        .map(r => r.id)
        .filter(id => !changedClientIds.has(id) && !deletedClientIds.has(id));
      
      // Fetch unchanged records (if we have raw records stored)
      if (unchangedProjectIds.length > 0 && previousData._rawRecords?.projects) {
        const cachedProjects = previousData._rawRecords.projects.filter(r => unchangedProjectIds.includes(r.id));
        projectsRecords = [...projectsRecords, ...cachedProjects];
      } else if (unchangedProjectIds.length > 0) {
        // If no raw records cached, need to fetch unchanged records
        const unchangedProjects = await fetchChangedRecords('Projects', unchangedProjectIds, 'Release Date');
        syncStats.apiCalls++;
        projectsRecords = [...projectsRecords, ...unchangedProjects];
      }
      
      if (unchangedJournalIds.length > 0 && previousData._rawRecords?.journal) {
        const cachedJournal = previousData._rawRecords.journal.filter(r => unchangedJournalIds.includes(r.id));
        journalRecords = [...journalRecords, ...cachedJournal];
      } else if (unchangedJournalIds.length > 0) {
        const unchangedJournal = await fetchChangedRecords('Journal', unchangedJournalIds, 'Date');
        syncStats.apiCalls++;
        journalRecords = [...journalRecords, ...unchangedJournal];
      }
      
      if (unchangedFestivalIds.length > 0 && previousData._rawRecords?.festivals) {
        const cachedFestivals = previousData._rawRecords.festivals.filter(r => unchangedFestivalIds.includes(r.id));
        awardsRecords = [...awardsRecords, ...cachedFestivals];
      } else if (unchangedFestivalIds.length > 0) {
        const unchangedFestivals = await fetchChangedRecords('Festivals', unchangedFestivalIds, null);
        syncStats.apiCalls++;
        awardsRecords = [...awardsRecords, ...unchangedFestivals];
      }
      
      if (unchangedClientIds.length > 0 && previousData._rawRecords?.clients) {
        const cachedClients = previousData._rawRecords.clients.filter(r => unchangedClientIds.includes(r.id));
        clientsRecords = [...clientsRecords, ...cachedClients];
      } else if (unchangedClientIds.length > 0) {
        const unchangedClients = await fetchChangedRecords('Client Book', unchangedClientIds, null);
        syncStats.apiCalls++;
        clientsRecords = [...clientsRecords, ...unchangedClients];
      }
      
      // Settings: always use latest if changed, otherwise use cached
      if (changedSettingsIds.size === 0 && previousData._rawRecords?.settings) {
        settingsRecords = previousData._rawRecords.settings;
      }
      
      // Update sync stats
      syncStats.changedRecords = 
        (changeDetection.changed.Projects?.length || 0) +
        (changeDetection.changed.Journal?.length || 0) +
        (changeDetection.changed.Festivals?.length || 0) +
        (changeDetection.changed['Client Book']?.length || 0) +
        (changeDetection.changed.Settings?.length || 0);
      
      syncStats.newRecords = 
        (changeDetection.new.Projects?.length || 0) +
        (changeDetection.new.Journal?.length || 0) +
        (changeDetection.new.Festivals?.length || 0) +
        (changeDetection.new['Client Book']?.length || 0) +
        (changeDetection.new.Settings?.length || 0);
      
      syncStats.deletedRecords = 
        (changeDetection.deleted.Projects?.length || 0) +
        (changeDetection.deleted.Journal?.length || 0) +
        (changeDetection.deleted.Festivals?.length || 0) +
        (changeDetection.deleted['Client Book']?.length || 0);
      
      syncStats.unchangedRecords = 
        unchangedProjectIds.length +
        unchangedJournalIds.length +
        unchangedFestivalIds.length +
        unchangedClientIds.length;
      
      // Store current timestamps for next sync
      if (changeDetection.currentTimestamps) {
        syncStats._currentTimestamps = changeDetection.currentTimestamps;
      }
    }
    
    console.log('Processing data...');
    
    // 4. Build lookup maps
    const awardsMap = {};
    awardsRecords.forEach(r => {
      awardsMap[r.id] = r.fields['Display Name'] || r.fields['Name'] || r.fields['Award'] || 'Unknown Award';
    });
    
    const clientsMap = {};
    clientsRecords.forEach(r => {
      clientsMap[r.id] = r.fields['Company'] || r.fields['Company Name'] || r.fields['Client'] || 'Unknown';
    });
    
    // 5. Process Settings
    const settingsFields = settingsRecords.length > 0 ? settingsRecords[0].fields : {};
    const allowedRoles = settingsFields['Allowed Roles'] 
      ? (Array.isArray(settingsFields['Allowed Roles']) ? settingsFields['Allowed Roles'] : [settingsFields['Allowed Roles']])
      : [];
    
    const config = {
      showreel: {
        enabled: !!settingsFields['Showreel Enabled'],
        videoUrl: settingsFields['Showreel URL'] || '',
        placeholderImage: settingsFields['Showreel Placeholder']?.[0]?.url || ''
      },
      contact: {
        email: settingsFields['Contact Email'] || '',
        phone: settingsFields['Contact Phone'] || '',
        repUK: settingsFields['Rep UK'] || '',
        repUSA: settingsFields['Rep USA'] || '',
        instagram: settingsFields['Instagram URL'] || '',
        vimeo: settingsFields['Vimeo URL'] || '',
        linkedin: settingsFields['LinkedIn URL'] || ''
      },
      about: {
        bio: settingsFields['Bio'] || settingsFields['Bio Text'] || '',
        profileImage: settingsFields['About Image']?.[0]?.url || FALLBACK_BIO_IMAGE
      },
      allowedRoles: allowedRoles,
      defaultOgImage: settingsFields['Default OG Image']?.[0]?.url || ''
    };
    
    // Image optimization removed - using Airtable URLs directly
    
    // 7. Process Projects
    console.log('Processing projects...');
    const visibleProjects = projectsRecords.filter(r => {
      const f = r.fields;
      if (!f['Feature']) return false;
      
      if (allowedRoles.length > 0) {
        const projectRoles = f['Role'] || [];
        const pRoles = Array.isArray(projectRoles) ? projectRoles : [projectRoles];
        return pRoles.some(role => allowedRoles.includes(role));
      }
      return true;
    });
    
    const projects = await Promise.all(visibleProjects.map(async (record) => {
      const f = record.fields;
      
      // Extract full Gallery attachment objects (not just URLs) to access metadata
      const galleryAttachments = f['Gallery'] || [];
      const galleryUrls = galleryAttachments.map(img => img.url);
      
      // Get video URL and thumbnail
      const videoUrl = f['Video URL'] || '';
      const hasVideo = !!(videoUrl && videoUrl.trim());
      let heroImage = galleryUrls[0] || '';
      
      if (!heroImage && hasVideo) {
        const thumbnailUrl = await fetchVideoThumbnail(videoUrl);
        if (thumbnailUrl) heroImage = thumbnailUrl;
      }
      
      // If project has neither video nor gallery images, use default OG image
      if (!heroImage && !hasVideo && galleryUrls.length === 0) {
        heroImage = config.defaultOgImage || '';
      }
      
      // Parse external links
      const linkData = parseExternalLinksData(f['External Links'], getVideoId);
      
      // Process roles and credits
      const allRoles = f['Role'] || [];
      const myRoles = allRoles
        .filter(r => allowedRoles.length === 0 || allowedRoles.includes(r))
        .map(r => ({ role: r, name: 'Gabriel Athanasiou' }));
      
      let extraCredits = [];
      const rawCreditsText = f['Credits Text'] || f['Credits'];
      if (rawCreditsText) {
        extraCredits = parseCreditsText(rawCreditsText);
      }
      
      const credits = [...myRoles, ...extraCredits];
      
      // Parse date
      const rawDate = f['Release Date'] || f['Work Date'];
      const year = rawDate ? rawDate.substring(0, 4) : '';
      
      // Determine project type
      const rawType = f['Project Type'];
      const rawKind = f['Kind'];
      let type = rawType || rawKind || 'Uncategorized';
      const kinds = rawKind ? (Array.isArray(rawKind) ? rawKind : [rawKind]) : [];
      
      const typeLower = type.toLowerCase();
      if (typeLower.includes('short') || typeLower.includes('feature') || typeLower.includes('narrative')) {
        type = 'Narrative';
      } else if (typeLower.includes('commercial') || typeLower.includes('tvc') || typeLower.includes('brand')) {
        type = 'Commercial';
      } else if (typeLower.includes('music')) {
        type = 'Music Video';
      } else if (typeLower.includes('documentary')) {
        type = 'Documentary';
      }
      
      // Process awards
      let awards = [];
      if (f['Festivals']) {
        if (Array.isArray(f['Festivals'])) {
          awards = f['Festivals'].map(id => awardsMap[id] || id);
        } else if (typeof f['Festivals'] === 'string') {
          awards = f['Festivals'].split('\n').filter(s => s.trim().length > 0);
        }
      }
      
      // Process production company
      let productionCompany = '';
      const productionCompanyField = f['Production Company'];
      if (Array.isArray(productionCompanyField)) {
        productionCompany = productionCompanyField.map(id => clientsMap[id] || id).join(', ');
      } else if (productionCompanyField) {
        productionCompany = clientsMap[productionCompanyField] || productionCompanyField;
      }
      
      return {
        id: record.id,
        title: normalizeTitle(f['Name']),
        slug: '', // Will be generated later
        type: type,
        kinds: kinds,
        genre: f['Genre'] || [],
        productionCompany: productionCompany,
        client: f['Client'] || '',
        year: year,
        description: f['About'] || '',
        isFeatured: !!f['Front Page'],
        heroImage: heroImage,
        gallery: galleryUrls,
        _galleryAttachments: galleryAttachments, // Store full attachment objects for Cloudinary sync
        videoUrl: videoUrl,
        additionalVideos: linkData.videos,
        awards: awards,
        credits: credits,
        externalLinks: linkData.links,
        relatedArticleId: f['Related Article']?.[0] || f['Journal']?.[0] || null
      };
    }));
    
    // Sort projects by year
    projects.sort((a, b) => {
      if (!a.year) return 1;
      if (!b.year) return -1;
      return b.year.localeCompare(a.year);
    });
    
    console.log(`Processed ${projects.length} projects`);
    
    // 8. Process Journal Posts
    console.log('Processing journal posts...');
    const now = new Date();
    
    const posts = await Promise.all(
      journalRecords
        .filter(record => {
          const f = record.fields;
          const status = f['Status'] || 'Draft';
          
          if (status === 'Public') return true;
          if (status === 'Scheduled' && f['Date']) {
            const postDate = new Date(f['Date']);
            return postDate <= now;
          }
          return false;
        })
        .map(async (record) => {
          const f = record.fields;
          
          // Extract full Cover Image attachment object (not just URL) to access metadata
          const coverImageAttachment = f['Cover Image']?.[0] || null;
          const imageUrl = coverImageAttachment?.url || '';
          
          // Parse links
          const rawLinks = f['Links'] || f['External Links'];
          const relatedLinks = rawLinks 
            ? rawLinks.split(',').map(s => s.trim()).filter(s => s.length > 0) 
            : [];
          
          return {
            id: record.id,
            title: f['Title'] || 'Untitled',
            date: f['Date'] || '',
            tags: f['Tags'] || [],
            content: f['Content'] || '',
            readingTime: calculateReadingTime(f['Content'] || ''),
            imageUrl: imageUrl,
            _coverImageAttachment: coverImageAttachment, // Store full attachment object for Cloudinary sync
            relatedProjectId: f['Related Project']?.[0] || f['Projects']?.[0] || null,
            source: 'local',
            relatedLinks: relatedLinks
          };
        })
    );
    
    console.log(`Processed ${posts.length} journal posts`);
    
    // Config images already using Airtable URLs (no optimization needed)
    
    // 10. Generate slugs
    const used = new Set();
    const makeUniqueSlug = (text, id) => {
      const base = text.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      
      let slug = base;
      let counter = 1;
      
      while (used.has(slug)) {
        slug = `${base}-${counter}`;
        counter++;
      }
      
      used.add(slug);
      return slug;
    };
    
    projects.forEach(p => {
      const base = p.title || p.id || 'project';
      p.slug = makeUniqueSlug(base + (p.year ? ` ${p.year}` : ''), p.id);
    });
    
    posts.forEach(post => {
      const base = post.title || post.id || 'post';
      post.slug = makeUniqueSlug(base + (post.date ? ` ${post.date}` : ''), post.id);
    });
    
    // 11. Generate sitemap and share-meta files
    // Note: In Netlify Functions, these are served dynamically via sitemap.js function
    // We store them in /tmp for caching, but don't fail if directory doesn't exist
    console.log('Generating sitemap.xml...');
    const sitemap = generateSitemap(projects, posts);
    
    console.log('Generating share-meta.json...');
    const shareMeta = generateShareMeta(projects, posts, config);
    
    // Try to write to public directory (local dev) or /tmp (deployed function)
    try {
      const baseDir = existsSyncSync(path.join(process.cwd(), 'public')) 
        ? path.join(process.cwd(), 'public')
        : '/tmp';
      
      const sitemapPath = path.join(baseDir, 'sitemap.xml');
      await writeFile(sitemapPath, sitemap, 'utf-8');
      console.log(`✅ Sitemap written to ${sitemapPath}`);
      
      const shareMetaPath = path.join(baseDir, 'share-meta.json');
      await writeFile(shareMetaPath, JSON.stringify(shareMeta, null, 2), 'utf-8');
      console.log(`✅ Share-meta written to ${shareMetaPath}`);
    } catch (writeError) {
      console.warn('⚠️ Could not write sitemap/share-meta to disk (non-critical):', writeError.message);
    }
    
    // 12. Sync images to Cloudinary (if enabled and credentials available)
    let cloudinaryMapping = null;
    if (USE_CLOUDINARY && CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
      const existingMapping = await loadCloudinaryMapping();
      cloudinaryMapping = await syncImagesToCloudinary(projects, posts, existingMapping);
    }
    
    // 13. Save complete data to static JSON file for runtime serving
    const finalData = {
      projects,
      posts,
      config,
      lastUpdated: new Date().toISOString(),
      version: '1.0',
      source: 'scheduled-sync',
      // Store raw records for incremental sync (hidden from API response)
      _rawRecords: {
        projects: projectsRecords,
        journal: journalRecords,
        festivals: awardsRecords,
        clients: clientsRecords,
        settings: settingsRecords
      },
      // Store sync metadata for change detection
      syncMetadata: {
        lastSync: new Date().toISOString(),
        timestamps: syncStats._currentTimestamps || {}
      }
    };
    
    const baseDir = existsSyncSync(path.join(process.cwd(), 'public')) 
      ? path.join(process.cwd(), 'public')
      : '/tmp';
    
    const portfolioDataPath = path.join(baseDir, 'portfolio-data.json');
    await writeFile(portfolioDataPath, JSON.stringify(finalData, null, 2), 'utf-8');
    console.log(`✅ Saved complete portfolio data to ${portfolioDataPath}`);
    
    // 14. Return processed data for CDN caching (with sync status)
    console.log('=== Sync Complete ===');
    console.log(`Projects: ${projects.length}`);
    console.log(`Posts: ${posts.length}`);
    console.log(`API Calls: ${syncStats.apiCalls}`);
    console.log(`New: ${syncStats.newRecords}, Changed: ${syncStats.changedRecords}, Deleted: ${syncStats.deletedRecords}, Unchanged: ${syncStats.unchangedRecords}`);
    
    if (USE_CLOUDINARY) {
      console.log('✅ Cloudinary enabled');
    } else {
      console.log('Note: Images using Airtable URLs (Cloudinary disabled)');
    }
    
    // Calculate API savings
    const fullSyncCalls = 50; // Approximate full sync API calls
    const apiCallsSaved = syncStats.mode === 'incremental' && syncStats.apiCalls < fullSyncCalls
      ? fullSyncCalls - syncStats.apiCalls
      : 0;
    
    const responseData = {
      projects,
      posts,
      config,
      lastUpdated: finalData.lastUpdated,
      version: finalData.version,
      source: finalData.source,
      syncStats: {
        mode: syncStats.mode,
        apiCalls: syncStats.apiCalls,
        apiCallsSaved: apiCallsSaved,
        newRecords: syncStats.newRecords,
        changedRecords: syncStats.changedRecords,
        deletedRecords: syncStats.deletedRecords,
        unchangedRecords: syncStats.unchangedRecords
      }
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        'X-Sync-Mode': syncStats.mode
      },
      body: JSON.stringify(responseData)
    };
    
  } catch (error) {
    // Check if error is due to rate limiting
    if (error.isRateLimit || error.statusCode === 429 || error.message?.includes('Rate limit') || error.message?.includes('429')) {
      console.error('⚠️ Airtable API rate limit exceeded');
      console.log('🔄 Attempting to use cached data as fallback...');
      
      const cachedData = await loadCachedData();
      
      if (cachedData && cachedData.projects && cachedData.posts) {
        console.log('✅ Using cached data (last updated: ' + cachedData.lastUpdated + ')');
        console.log('📊 Cached data: ' + cachedData.projects.length + ' projects, ' + cachedData.posts.length + ' posts');
        
        // Update share-meta from cached data
        const shareMeta = generateShareMeta(cachedData.projects, cachedData.posts, cachedData.config);
        
        try {
          const baseDir = existsSyncSync(path.join(process.cwd(), 'public')) 
            ? path.join(process.cwd(), 'public')
            : '/tmp';
          
          const shareMetaPath = path.join(baseDir, 'share-meta.json');
          await writeFile(shareMetaPath, JSON.stringify(shareMeta, null, 2), 'utf-8');
          console.log('✅ Regenerated share-meta.json from cached data');
        } catch (writeError) {
          console.warn('⚠️ Could not write share-meta (non-critical):', writeError.message);
        }
        
        console.log('📍 Using stale data until rate limit resets');
        console.log('⏰ Rate limit typically resets at start of next month (Dec 1st)');
        
        // Return cached data with warning
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=300, s-maxage=600, must-revalidate',
            'X-Data-Source': 'cached-fallback'
          },
          body: JSON.stringify({
            ...cachedData,
            sync: {
              contentChanged: false,
              buildTriggered: false,
              buildReason: 'Rate limit exceeded - using cached data',
              rateLimitHit: true,
              cachedDataAge: cachedData.lastUpdated
            }
          })
        };
      } else {
        console.error('❌ No cached data available and rate limit exceeded');
        return {
          statusCode: 503,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': '3600'
          },
          body: JSON.stringify({
            success: false,
            error: 'Rate limit exceeded and no cached data available',
            rateLimitHit: true,
            timestamp: new Date().toISOString()
          })
        };
      }
    }
    
    console.error('Sync failed:', error);
    throw error;
  }
};

// ==========================================
// NETLIFY FUNCTION (MANUAL INVOCATION ONLY)
// ==========================================

// AUTOMATIC SCHEDULING DISABLED - Now only runs:
// 1. Manually via /.netlify/functions/scheduled-sync endpoint
// 2. On deployment via build hooks or GitHub Actions
// 3. Via sync-now.mjs function

// Export handler for manual invocation (no automatic schedule)
export const handler = async (event) => {
  try {
    // Check for force parameter
    const forceFullSync = event.queryStringParameters?.force === 'true';
    
    if (forceFullSync) {
      console.log('⚡ Force full sync requested');
    }
    
    const result = await syncAirtableData({ forceFullSync });
    return result;
  } catch (error) {
    console.error('Sync failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Also export the main function for manual invocation
export { syncAirtableData };
