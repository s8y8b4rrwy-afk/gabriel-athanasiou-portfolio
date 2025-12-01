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
import { v2 as cloudinary } from 'cloudinary';
import { getVideoThumbnail } from '../../utils/videoHelpers.mjs';
import { normalizeTitle, calculateReadingTime, parseCreditsText } from '../../utils/textHelpers.mjs';
import { uploadToCloudinary as uploadToCloudinaryHelper, checkImageExists } from '../../utils/cloudinaryHelpers.mjs';
import {
  fetchAirtableTable,
  fetchTimestamps,
  checkForChanges,
  fetchChangedRecords,
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
 * @param {boolean} config.forceFullSync - Force full sync, bypassing incremental checks
 * @param {boolean} config.skipFileWrites - Skip writing files to disk (for serverless environments)
 * @returns {Promise<Object>} Sync results with success status and generated data
 */
export async function syncAllData(config) {
  const {
    airtableToken,
    airtableBaseId,
    outputDir = 'public',
    verbose = false,
    forceFullSync = false,
    skipFileWrites = false
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
    timestamp: new Date().toISOString(),
    syncStats: {
      mode: 'full',
      apiCalls: 0,
      apiCallsSaved: 0,
      newRecords: 0,
      changedRecords: 0,
      deletedRecords: 0,
      unchangedRecords: 0
    }
  };

  try {
    if (verbose) console.log('[sync-core] 🔄 Starting data sync...');

    const outputFile = path.join(outputDir, 'portfolio-data.json');
    
    // Load existing portfolio data for incremental sync
    const existingData = loadExistingData(outputFile);
    const previousMetadata = existingData?.syncMetadata;

    // Determine sync mode
    const useIncrementalSync = !forceFullSync && previousMetadata && previousMetadata.timestamps;
    
    if (useIncrementalSync) {
      if (verbose) console.log('[sync-core] 🔍 Checking for changes (incremental mode)...');
      
      // Fetch timestamps only (lightweight check)
      const [projectsTimestamps, journalTimestamps, festivalsTimestamps, clientsTimestamps, settingsTimestamps] = await Promise.all([
        fetchTimestamps('Projects', airtableToken, airtableBaseId),
        fetchTimestamps('Journal', airtableToken, airtableBaseId),
        fetchTimestamps('Festivals', airtableToken, airtableBaseId),
        fetchTimestamps('Client Book', airtableToken, airtableBaseId),
        fetchTimestamps('Settings', airtableToken, airtableBaseId)
      ]);
      
      results.syncStats.apiCalls += 5;
      
      const currentTimestamps = {
        Projects: projectsTimestamps,
        Journal: journalTimestamps,
        Festivals: festivalsTimestamps,
        'Client Book': clientsTimestamps,
        Settings: settingsTimestamps
      };
      
      // Check for changes
      const changes = checkForChanges(previousMetadata, currentTimestamps);
      
      // Calculate totals
      const totalChanges = Object.values(changes).reduce((sum, table) => 
        sum + table.changed.length + table.new.length + table.deleted.length, 0);
      
      if (totalChanges === 0) {
        // No changes detected - return cached data
        if (verbose) console.log('[sync-core] ✅ No changes detected, using cached data');
        
        results.success = true;
        results.projects = existingData.projects || [];
        results.journal = existingData.posts || [];
        results.config = existingData.config || null;
        results.syncStats.mode = 'cached';
        results.syncStats.apiCallsSaved = 45; // Approximate savings
        results.syncStats.unchangedRecords = projectsTimestamps.length + journalTimestamps.length;
        
        return results;
      }
      
      // Changes detected - fetch only changed records
      if (verbose) {
        console.log(`[sync-core] 📊 Changes detected:`);
        for (const [table, tableChanges] of Object.entries(changes)) {
          const total = tableChanges.changed.length + tableChanges.new.length + tableChanges.deleted.length;
          if (total > 0) {
            console.log(`  ${table}: ${tableChanges.new.length} new, ${tableChanges.changed.length} changed, ${tableChanges.deleted.length} deleted`);
          }
        }
      }
      
      results.syncStats.mode = 'incremental';
      results.syncStats.newRecords = Object.values(changes).reduce((sum, t) => sum + t.new.length, 0);
      results.syncStats.changedRecords = Object.values(changes).reduce((sum, t) => sum + t.changed.length, 0);
      results.syncStats.deletedRecords = Object.values(changes).reduce((sum, t) => sum + t.deleted.length, 0);
      
      // Load existing raw records to merge with changes
      const existingRawRecords = existingData._rawRecords || {
        Projects: [],
        Journal: [],
        Festivals: [],
        'Client Book': [],
        Settings: []
      };
      
      // Fetch changed records for each table
      const fetchPromises = [];
      const tableNames = ['Projects', 'Journal', 'Festivals', 'Client Book', 'Settings'];
      const sortFields = { Projects: 'Release Date', Journal: 'Date', Festivals: null, 'Client Book': null, Settings: null };
      
      for (const tableName of tableNames) {
        const tableChanges = changes[tableName];
        const changedIds = [...tableChanges.new, ...tableChanges.changed];
        
        if (changedIds.length > 0) {
          fetchPromises.push(
            fetchChangedRecords(tableName, changedIds, sortFields[tableName], airtableToken, airtableBaseId)
              .then(records => ({ tableName, records }))
          );
          results.syncStats.apiCalls++;
        }
      }
      
      const changedRecordsResults = await Promise.all(fetchPromises);
      
      // Merge changed records with existing records
      const rawRecords = { ...existingRawRecords };
      
      for (const { tableName, records } of changedRecordsResults) {
        const existingRecords = rawRecords[tableName] || [];
        const changedIds = new Set(records.map(r => r.id));
        const deletedIds = new Set(changes[tableName].deleted);
        
        // Remove deleted records and records that were updated
        const unchangedRecords = existingRecords.filter(r => 
          !changedIds.has(r.id) && !deletedIds.has(r.id)
        );
        
        // Merge unchanged + changed records
        rawRecords[tableName] = [...unchangedRecords, ...records];
      }
      
      // Also need to handle tables with only deletions (no new/changed records)
      for (const tableName of tableNames) {
        const deletedIds = new Set(changes[tableName].deleted);
        if (deletedIds.size > 0 && !changedRecordsResults.some(r => r.tableName === tableName)) {
          const existingRecords = rawRecords[tableName] || [];
          rawRecords[tableName] = existingRecords.filter(r => !deletedIds.has(r.id));
        }
      }
      
      results.syncStats.apiCallsSaved = Math.max(0, 50 - results.syncStats.apiCalls);
      
      // Build lookup maps from merged data
      const festivalsMap = {};
      (rawRecords.Festivals || []).forEach(r => {
        festivalsMap[r.id] = r.fields['Display Name'] || r.fields['Name'] || r.fields['Award'] || 'Unknown Award';
      });
      
      const clientsMap = {};
      (rawRecords['Client Book'] || []).forEach(r => {
        clientsMap[r.id] = r.fields['Company'] || r.fields['Company Name'] || r.fields['Client'] || 'Unknown';
      });
      
      if (verbose) console.log('[sync-core] ✅ Built lookup maps from merged data');
      
      // Load Cloudinary mapping
      const cloudinaryMapping = loadCloudinaryMapping(outputDir);
      
      // Process records
      results.config = processConfigRecords(rawRecords.Settings || [], cloudinaryMapping, verbose);
      if (verbose) console.log('[sync-core] ✅ Processed config/settings data');
      
      results.projects = await processProjectRecords(
        rawRecords.Projects || [],
        festivalsMap,
        clientsMap,
        cloudinaryMapping,
        results.config,
        verbose
      );
      if (verbose) console.log(`[sync-core] ✅ Processed ${results.projects.length} projects`);
      
      results.journal = processJournalRecords(rawRecords.Journal || [], cloudinaryMapping, verbose);
      if (verbose) console.log(`[sync-core] ✅ Processed ${results.journal.length} journal posts`);
      
      // Build sets of changed record IDs for incremental Cloudinary sync
      const changedProjectIds = new Set([
        ...changes.Projects.new,
        ...changes.Projects.changed
      ]);
      const changedJournalIds = new Set([
        ...changes.Journal.new,
        ...changes.Journal.changed
      ]);
      
      // Upload images to Cloudinary (only for changed records)
      const updatedMapping = await syncImagesToCloudinary(
        results.projects,
        results.journal,
        cloudinaryMapping,
        verbose,
        changedProjectIds,
        changedJournalIds
      );
      
      // Save updated Cloudinary mapping (skip in serverless environments)
      if (updatedMapping && !skipFileWrites) {
        saveCloudinaryMapping(outputDir, updatedMapping);
        if (verbose) console.log(`[sync-core] ✅ Saved Cloudinary mapping`);
      } else if (updatedMapping && skipFileWrites && verbose) {
        console.log(`[sync-core] ⏭️ Skipped saving Cloudinary mapping (serverless mode)`);
      }
      
      // Build new timestamp map for next sync
      const newTimestampMap = {};
      for (const [tableName, timestamps] of Object.entries(currentTimestamps)) {
        newTimestampMap[tableName] = {};
        timestamps.forEach(({ id, lastModified }) => {
          newTimestampMap[tableName][id] = lastModified;
        });
      }
      
      // Save portfolio data with metadata (skip in serverless environments)
      const portfolioData = {
        projects: cleanProcessedData(results.projects),
        posts: cleanProcessedData(results.journal),
        config: results.config,
        lastUpdated: results.timestamp,
        version: '1.0',
        source: 'build-time-sync',
        _rawRecords: rawRecords,
        syncMetadata: {
          lastSync: results.timestamp,
          timestamps: newTimestampMap
        }
      };
      
      if (!skipFileWrites) {
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(outputFile, JSON.stringify(portfolioData, null, 2));
        if (verbose) console.log(`[sync-core] ✅ Wrote ${outputFile} (incremental mode)`);
      } else if (verbose) {
        console.log(`[sync-core] ⏭️ Skipped writing ${outputFile} (serverless mode)`);
      }
      
    } else {
      // FULL SYNC MODE
      if (forceFullSync && verbose) {
        console.log('[sync-core] 🔄 Force full sync requested');
      } else if (verbose) {
        console.log('[sync-core] 🔄 Full sync mode (no previous metadata)');
      }
      
      results.syncStats.mode = 'full';
      
      // Build lookup maps for festivals and clients
      const { festivalsMap, clientsMap } = await buildLookupMaps(airtableToken, airtableBaseId);
      results.syncStats.apiCalls += 2;
      if (verbose) console.log('[sync-core] ✅ Built lookup maps');

      // Load Cloudinary mapping if exists
      const cloudinaryMapping = loadCloudinaryMapping(outputDir);

      // Fetch all records
      const [projectsRecords, journalRecords, festivalsRecords, clientsRecords, settingsRecords] = await Promise.all([
        fetchAirtableTable('Projects', 'Release Date', airtableToken, airtableBaseId),
        fetchAirtableTable('Journal', 'Date', airtableToken, airtableBaseId),
        fetchAirtableTable('Festivals', null, airtableToken, airtableBaseId),
        fetchAirtableTable('Client Book', null, airtableToken, airtableBaseId),
        fetchAirtableTable('Settings', null, airtableToken, airtableBaseId)
      ]);
      results.syncStats.apiCalls += 5;
      
      const rawRecords = {
        Projects: projectsRecords,
        Journal: journalRecords,
        Festivals: festivalsRecords,
        'Client Book': clientsRecords,
        Settings: settingsRecords
      };

      // Process config/settings data FIRST
      results.config = processConfigRecords(settingsRecords, cloudinaryMapping, verbose);
      if (verbose) console.log('[sync-core] ✅ Processed config/settings data');

      // Process projects
      results.projects = await processProjectRecords(
        projectsRecords,
        festivalsMap,
        clientsMap,
        cloudinaryMapping,
        results.config,
        verbose
      );
      if (verbose) console.log(`[sync-core] ✅ Processed ${results.projects.length} projects`);

      // Process journal posts
      results.journal = processJournalRecords(journalRecords, cloudinaryMapping, verbose);
      if (verbose) console.log(`[sync-core] ✅ Processed ${results.journal.length} journal posts`);
      
      // Upload images to Cloudinary (incremental detection by attachment ID)
      const updatedMapping = await syncImagesToCloudinary(
        results.projects,
        results.journal,
        cloudinaryMapping,
        verbose
      );
      
      // Save updated Cloudinary mapping (skip in serverless environments)
      if (updatedMapping && !skipFileWrites) {
        saveCloudinaryMapping(outputDir, updatedMapping);
        if (verbose) console.log(`[sync-core] ✅ Saved Cloudinary mapping`);
      } else if (updatedMapping && skipFileWrites && verbose) {
        console.log(`[sync-core] ⏭️ Skipped saving Cloudinary mapping (serverless mode)`);
      }
      
      // Fetch timestamps for next incremental sync
      const [projectsTimestamps, journalTimestamps, festivalsTimestamps, clientsTimestamps, settingsTimestamps] = await Promise.all([
        fetchTimestamps('Projects', airtableToken, airtableBaseId),
        fetchTimestamps('Journal', airtableToken, airtableBaseId),
        fetchTimestamps('Festivals', airtableToken, airtableBaseId),
        fetchTimestamps('Client Book', airtableToken, airtableBaseId),
        fetchTimestamps('Settings', airtableToken, airtableBaseId)
      ]);
      results.syncStats.apiCalls += 5;
      
      // Build timestamp map
      const timestampMap = {
        Projects: {},
        Journal: {},
        Festivals: {},
        'Client Book': {},
        Settings: {}
      };
      
      projectsTimestamps.forEach(({ id, lastModified }) => { timestampMap.Projects[id] = lastModified; });
      journalTimestamps.forEach(({ id, lastModified }) => { timestampMap.Journal[id] = lastModified; });
      festivalsTimestamps.forEach(({ id, lastModified }) => { timestampMap.Festivals[id] = lastModified; });
      clientsTimestamps.forEach(({ id, lastModified }) => { timestampMap['Client Book'][id] = lastModified; });
      settingsTimestamps.forEach(({ id, lastModified }) => { timestampMap.Settings[id] = lastModified; });

      // Save portfolio data with metadata (skip in serverless environments)
      const portfolioData = {
        projects: cleanProcessedData(results.projects),
        posts: cleanProcessedData(results.journal),
        config: results.config,
        lastUpdated: results.timestamp,
        version: '1.0',
        source: 'build-time-sync',
        _rawRecords: rawRecords,
        syncMetadata: {
          lastSync: results.timestamp,
          timestamps: timestampMap
        }
      };

      if (!skipFileWrites) {
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(outputFile, JSON.stringify(portfolioData, null, 2));
        if (verbose) console.log(`[sync-core] ✅ Wrote ${outputFile} (full mode)`);
      } else if (verbose) {
        console.log(`[sync-core] ⏭️ Skipped writing ${outputFile} (serverless mode)`);
      }
    }

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
 * Clean processed data by removing internal _raw* fields
 */
function cleanProcessedData(data) {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    // Remove any keys starting with underscore (internal fields)
    if (key.startsWith('_')) {
      return undefined;
    }
    return value;
  }));
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
  return { generatedAt: new Date().toISOString(), projects: [], journal: [], config: { images: [] } };
}

/**
 * Save Cloudinary mapping
 */
function saveCloudinaryMapping(outputDir, mapping) {
  try {
    const mappingFile = path.join(outputDir, 'cloudinary-mapping.json');
    mapping.generatedAt = new Date().toISOString();
    fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2), 'utf-8');
  } catch (error) {
    console.error('[sync-core] ❌ Failed to save Cloudinary mapping:', error.message);
  }
}

/**
 * Configure Cloudinary SDK
 */
function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const useCloudinary = process.env.USE_CLOUDINARY === 'true';
  
  if (!useCloudinary) {
    return { enabled: false };
  }
  
  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('[sync-core] ⚠️ USE_CLOUDINARY=true but credentials missing');
    return { enabled: false };
  }
  
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
  
  return { enabled: true, cloudName };
}

/**
 * Upload images to Cloudinary with incremental detection
 * Checks Cloudinary directly to see if images already exist (by public_id)
 * Only checks changed records to minimize API calls
 * 
 * @param {Array} projects - All projects
 * @param {Array} journal - All journal posts  
 * @param {Object} existingMapping - Existing cloudinary mapping
 * @param {boolean} verbose - Enable verbose logging
 * @param {Set} changedProjectIds - Set of project record IDs that changed (optional)
 * @param {Set} changedJournalIds - Set of journal record IDs that changed (optional)
 */
async function syncImagesToCloudinary(projects, journal, existingMapping, verbose, changedProjectIds = null, changedJournalIds = null) {
  const cloudinaryConfig = configureCloudinary();
  
  if (!cloudinaryConfig.enabled) {
    if (verbose) console.log('[sync-core] ⏭️  Cloudinary upload skipped (disabled or no credentials)');
    return existingMapping;
  }
  
  // Build lookup for existing mapping
  const existingProjectsMap = new Map(
    (existingMapping.projects || []).map(p => [p.recordId, p])
  );
  const existingJournalMap = new Map(
    (existingMapping.journal || []).map(j => [j.recordId, j])
  );
  
  // Determine which records need checking
  const isFullSync = changedProjectIds === null && changedJournalIds === null;
  const projectsToCheck = isFullSync 
    ? new Set(projects.map(p => p.id))
    : changedProjectIds || new Set();
  const journalToCheck = isFullSync
    ? new Set(journal.map(j => j.id))
    : changedJournalIds || new Set();
  
  const totalToCheck = projectsToCheck.size + journalToCheck.size;
  
  if (totalToCheck === 0) {
    if (verbose) console.log('[sync-core] ⏭️  No changed records - skipping Cloudinary checks');
    return existingMapping;
  }
  
  if (verbose) {
    if (isFullSync) {
      console.log(`[sync-core] 🔄 Full sync: checking Cloudinary for all ${totalToCheck} records...`);
    } else {
      console.log(`[sync-core] 🔄 Incremental sync: checking Cloudinary for ${totalToCheck} changed records...`);
    }
  }
  
  const newMapping = {
    generatedAt: new Date().toISOString(),
    projects: [],
    journal: [],
    config: existingMapping.config || { images: [] }
  };
  
  let uploadCount = 0;
  let skipCount = 0;
  let failCount = 0;
  let reuseCount = 0;
  
  // Process project images
  for (const project of projects) {
    // Check if this project needs checking or can reuse existing mapping
    if (!projectsToCheck.has(project.id)) {
      // Project unchanged - reuse existing mapping if available
      const existingProject = existingProjectsMap.get(project.id);
      if (existingProject) {
        newMapping.projects.push(existingProject);
        reuseCount += existingProject.images?.length || 0;
        continue;
      }
    }
    
    const projectData = {
      recordId: project.id,
      title: project.title,
      images: []
    };
    
    // Get gallery attachments from raw Airtable data
    const galleryAttachments = project._rawGallery || [];
    
    for (let i = 0; i < galleryAttachments.length; i++) {
      const attachment = galleryAttachments[i];
      const publicId = `portfolio-projects-${project.id}-${i}`;
      
      // Check if image already exists in Cloudinary by public_id
      const existingImage = await checkImageExists(cloudinary, publicId);
      
      if (existingImage) {
        // Image already exists in Cloudinary - skip upload
        if (verbose) console.log(`[sync-core]    ⏭️  Exists: ${project.title} [${i}]`);
        projectData.images.push({
          index: i,
          publicId: existingImage.publicId,
          cloudinaryUrl: existingImage.cloudinaryUrl,
          airtableId: attachment.id,
          format: existingImage.format,
          size: existingImage.size
        });
        skipCount++;
      } else {
        // Image doesn't exist - upload it
        if (verbose) console.log(`[sync-core]    📤 Uploading: ${project.title} [${i}]`);
        
        const result = await uploadToCloudinaryHelper(
          cloudinary,
          attachment.url,
          publicId,
          { title: project.title }
        );
        
        if (result.success) {
          projectData.images.push({
            index: i,
            publicId: result.publicId,
            cloudinaryUrl: result.cloudinaryUrl,
            airtableId: attachment.id,
            format: result.format,
            size: result.size
          });
          uploadCount++;
        } else {
          projectData.images.push({
            index: i,
            publicId: publicId,
            cloudinaryUrl: '',
            airtableId: attachment.id,
            error: result.error
          });
          failCount++;
        }
      }
    }
    
    newMapping.projects.push(projectData);
  }
  
  // Process journal images
  for (const post of journal) {
    // Check if this post needs checking or can reuse existing mapping
    if (!journalToCheck.has(post.id)) {
      // Post unchanged - reuse existing mapping if available
      const existingPost = existingJournalMap.get(post.id);
      if (existingPost) {
        newMapping.journal.push(existingPost);
        reuseCount += existingPost.images?.length || 0;
        continue;
      }
    }
    
    const postData = {
      recordId: post.id,
      title: post.title,
      images: []
    };
    
    // Get cover image attachment from raw data
    const coverAttachment = post._rawCoverImage;
    
    if (coverAttachment) {
      const publicId = `portfolio-journal-${post.id}`;
      
      // Check if image already exists in Cloudinary
      const existingImage = await checkImageExists(cloudinary, publicId);
      
      if (existingImage) {
        // Image already exists - skip upload
        if (verbose) console.log(`[sync-core]    ⏭️  Exists: ${post.title}`);
        postData.images.push({
          index: 0,
          publicId: existingImage.publicId,
          cloudinaryUrl: existingImage.cloudinaryUrl,
          airtableId: coverAttachment.id,
          format: existingImage.format,
          size: existingImage.size
        });
        skipCount++;
      } else {
        // Image doesn't exist - upload it
        if (verbose) console.log(`[sync-core]    📤 Uploading: ${post.title}`);
        
        const result = await uploadToCloudinaryHelper(
          cloudinary,
          coverAttachment.url,
          publicId,
          { title: post.title }
        );
        
        if (result.success) {
          postData.images.push({
            index: 0,
            publicId: result.publicId,
            cloudinaryUrl: result.cloudinaryUrl,
            airtableId: coverAttachment.id,
            format: result.format,
            size: result.size
          });
          uploadCount++;
        } else {
          postData.images.push({
            index: 0,
            publicId: publicId,
            cloudinaryUrl: '',
            airtableId: coverAttachment.id,
            error: result.error
          });
          failCount++;
        }
      }
    }
    
    newMapping.journal.push(postData);
  }
  
  if (verbose) {
    const stats = [`${uploadCount} uploaded`, `${skipCount} already exist`, `${failCount} failed`];
    if (reuseCount > 0) stats.push(`${reuseCount} reused from cache`);
    console.log(`[sync-core] ✅ Cloudinary sync complete: ${stats.join(', ')}`);
  }
  
  return newMapping;
}

/**
 * Load existing portfolio data for incremental sync
 * @param {string} filePath - Path to portfolio-data.json
 * @returns {Object|null} Previous sync data or null if not found
 */
function loadExistingData(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('[sync-core] ⚠️ Could not load existing data:', error.message);
  }
  return null;
}

/**
 * Process project records from raw Airtable data
 * @param {Array} rawRecords - Raw Airtable project records
 * @param {Object} festivalsMap - Festival ID to name mapping
 * @param {Object} clientsMap - Client ID to name mapping
 * @param {Object} cloudinaryMapping - Cloudinary URL mapping
 * @param {Object} config - Settings/config data
 * @param {boolean} verbose - Enable verbose logging
 * @returns {Promise<Array>} Processed project objects
 */
async function processProjectRecords(rawRecords, festivalsMap, clientsMap, cloudinaryMapping, config, verbose) {
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

  for (const r of rawRecords) {
    const f = r.fields || {};
    
    // Check Display Status field
    const displayStatus = f['Display Status'] || '';
    if (displayStatus === 'Hidden' || !displayStatus) continue;

    const rawTitle = f['Name'] || 'Untitled';
    const title = normalizeTitle(rawTitle);
    const releaseDate = f['Release Date'] || '';
    const workDate = f['Work Date'] || releaseDate;
    const description = f['About'] || f['Description'] || '';
    
    // Extract year from dates
    const year = (releaseDate || workDate).split('-')[0] || '';
    
    // Map Display Status to isFeatured and isHero
    const isFeatured = displayStatus === 'Featured' || displayStatus === 'Hero';
    const isHero = displayStatus === 'Hero';
    
    // Get project type and categories
    const type = normalizeProjectType(f['Project Type'] || '');
    const kinds = f['Kind'] ? [f['Kind']] : (f['Kinds'] || []);
    const genre = f['Genre'] || [];
    const client = f['Client'] || '';
    
    // Parse credits from Credits field
    const rawCredits = f['Credits (new)'] || f['Credits'] || '';
    const extraCredits = parseCreditsText(rawCredits);
    
    // Prepend owner's credits based on Role field and allowed roles
    const ownerCredits = [];
    const roleField = f['Role'] || null;
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
    
    // Get video URL directly from Video URL field
    const videoUrl = f['Video URL'] || '';
    
    // Parse external links (fallback if Video URL is not set)
    const rawLinks = f['External Links'] || '';
    const { links, videos } = parseExternalLinks(rawLinks);
    
    // Build image URLs (prefer Cloudinary if available)
    const galleryAttachments = f['Gallery'] || f['Gallery (Image)'] || [];
    const gallery = galleryAttachments.map((att, idx) => {
      const cloudinaryImg = cloudinaryMap[r.id]?.[idx];
      return cloudinaryImg?.cloudinaryUrl || att.url;
    });
    
    // Use Video URL field first, fallback to parsed videos from External Links
    const finalVideoUrl = videoUrl || videos.join(', ');
    
    // Set heroImage to first gallery image, or video thumbnail if no gallery
    let heroImage = gallery[0] || '';
    if (!heroImage && finalVideoUrl) {
      try {
        const videoThumbnail = await getVideoThumbnail(finalVideoUrl);
        heroImage = videoThumbnail || '';
      } catch (err) {
        if (verbose) console.warn(`[sync-core] ⚠️ Failed to fetch video thumbnail for ${title}:`, err.message);
      }
    }
    
    // Additional videos array (empty for now, can be populated if needed)
    const additionalVideos = [];
    
    // Resolve awards
    const festivalIds = f['Festivals'] || f['Awards'] || [];
    const awards = resolveAwards(festivalIds, festivalsMap);
    
    // Resolve production company
    const productionCompanyId = f['Production Company']?.[0];
    const productionCompany = resolveProductionCompany(productionCompanyId, clientsMap);
    
    // Get related article ID if exists
    const relatedArticleId = f['Related Article']?.[0] || null;
    
    projects.push({
      id: r.id,
      slug: makeSlug(title),
      title,
      type,
      kinds,
      genre,
      productionCompany,
      client,
      year,
      releaseDate,
      workDate,
      description,
      isFeatured,
      isHero,
      heroImage,
      gallery,
      videoUrl: finalVideoUrl,
      additionalVideos,
      awards,
      credits,
      externalLinks: links,
      relatedArticleId,
      // Store raw attachments for Cloudinary upload detection
      _rawGallery: galleryAttachments
    });
  }

  // Sort projects by date (Release Date takes priority, then Work Date) - newest first
  projects.sort((a, b) => {
    const dateA = a.releaseDate || a.workDate || '1900-01-01';
    const dateB = b.releaseDate || b.workDate || '1900-01-01';
    return dateB.localeCompare(dateA); // Descending order (newest first)
  });

  return projects;
}

/**
 * Process journal records from raw Airtable data
 * @param {Array} rawRecords - Raw Airtable journal records
 * @param {Object} cloudinaryMapping - Cloudinary URL mapping
 * @param {boolean} verbose - Enable verbose logging
 * @returns {Array} Processed journal post objects
 */
function processJournalRecords(rawRecords, cloudinaryMapping, verbose) {
  const posts = [];
  
  // Build cloudinary lookup map for journal
  const cloudinaryMap = {};
  if (cloudinaryMapping?.journal) {
    cloudinaryMapping.journal.forEach(post => {
      cloudinaryMap[post.recordId] = post.images || [];
    });
  }

  for (const r of rawRecords) {
    const f = r.fields || {};
    
    const status = f['Status'] || '';
    // Only show Published posts (matching the Airtable "Published" status)
    if (status !== 'Published') continue;

    const title = normalizeTitle(f['Title'] || 'Untitled');
    const date = f['Publish Date'] || f['Date'] || '';
    const content = f['Content'] || '';
    const excerpt = f['Excerpt'] || '';
    const readingTime = calculateReadingTime(content);
    
    // Handle cover image - prefer Cloudinary URL if available
    const coverAttachments = f['Cover Image'] || [];
    const airtableImageUrl = coverAttachments[0]?.url || '';
    
    // Use Cloudinary URL if available, otherwise fall back to Airtable URL
    const cloudinaryImage = cloudinaryMap[r.id]?.[0];
    const imageUrl = cloudinaryImage?.cloudinaryUrl || airtableImageUrl;
    
    // Get tags
    const tags = f['Tags'] || [];
    
    // Get related project ID
    const relatedProjectId = f['Related Project']?.[0] || null;
    
    // Parse related links from Links or External Links field
    const rawLinks = f['Links'] || f['External Links'] || '';
    const relatedLinks = rawLinks 
      ? rawLinks.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    posts.push({
      id: r.id,
      slug: makeSlug(title),
      title,
      date,
      status,
      content,
      excerpt,
      readingTime,
      imageUrl,
      tags,
      relatedProjectId,
      relatedLinks,
      source: 'local',
      // Store raw attachment for Cloudinary upload detection
      _rawCoverImage: coverAttachments[0] || null
    });
  }

  // Sort posts by date (newest first)
  posts.sort((a, b) => {
    const dateA = a.date || '1900-01-01';
    const dateB = b.date || '1900-01-01';
    return dateB.localeCompare(dateA);
  });

  return posts;
}

/**
 * Process config/settings record from raw Airtable data
 * @param {Array} rawRecords - Raw Airtable settings records
 * @param {Object} cloudinaryMapping - Cloudinary URL mapping
 * @param {boolean} verbose - Enable verbose logging
 * @returns {Object} Processed config object
 */
function processConfigRecords(rawRecords, cloudinaryMapping, verbose) {
  if (rawRecords.length === 0) {
    return getDefaultSettings();
  }

  const f = rawRecords[0].fields || {};
  
  // Build cloudinary lookup map for config images
  const cloudinaryConfigImagesArray = cloudinaryMapping?.config?.images || [];
  const cloudinaryConfigImages = {};
  cloudinaryConfigImagesArray.forEach(img => {
    cloudinaryConfigImages[img.type] = img.cloudinaryUrl;
  });
  
  // Extract showreel fields
  const showreelEnabled = f['Showreel Enabled'] || false;
  const showreelUrl = f['Showreel URL'] || '';
  const showreelPlaceholderAttachments = f['Showreel Placeholder'] || [];
  const showreelPlaceholderAirtableUrl = showreelPlaceholderAttachments[0] ? showreelPlaceholderAttachments[0].url : '';
  const showreelPlaceholderImage = cloudinaryConfigImages['showreel'] || showreelPlaceholderAirtableUrl;
  
  // Extract contact fields
  const contactEmail = f['Contact Email'] || '';
  const contactPhone = f['Contact Phone'] || '';
  const repUK = f['Rep UK'] || '';
  const repUSA = f['Rep USA'] || '';
  const instagramUrl = f['Instagram URL'] || '';
  const vimeoUrl = f['Vimeo URL'] || '';
  const linkedinUrl = f['LinkedIn URL'] || f['Linkedin URL'] || ''; 
  
  // Extract about fields
  const bio = f['Bio'] || '';
  const aboutImageAttachments = f['About Image'] || [];
  const aboutAirtableUrl = aboutImageAttachments[0] ? aboutImageAttachments[0].url : '';
  const aboutProfileImage = cloudinaryConfigImages['profile'] || aboutAirtableUrl;
  
  // Extract other settings
  const name = f['Name'] || '';
  // Portfolio owner name: check 'Owner Name' field first, then extract from Bio if available
  let portfolioOwnerName = f['Owner Name'] || f['Portfolio Owner'] || '';
  if (!portfolioOwnerName && bio) {
    // Extract name from beginning of Bio (assumes format "Name (..."  or "Name is...")
    const bioMatch = bio.match(/^([A-Za-zÀ-ÖØ-öø-ÿ]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ]+)*)/);
    if (bioMatch) {
      portfolioOwnerName = bioMatch[1].trim();
    }
  }
  // Default fallback
  if (!portfolioOwnerName) {
    portfolioOwnerName = 'Gabriel Athanasiou';
  }
  
  const allowedRolesRaw = f['Allowed Roles'] || '';
  
  // Handle Allowed Roles - might be string or array
  let allowedRoles = [];
  if (Array.isArray(allowedRolesRaw)) {
    allowedRoles = allowedRolesRaw;
  } else if (typeof allowedRolesRaw === 'string' && allowedRolesRaw) {
    allowedRoles = allowedRolesRaw.split(',').map(r => r.trim()).filter(r => r);
  }
  
  const defaultOgImageAttachments = f['Default OG Image'] || [];
  const defaultOgAirtableUrl = defaultOgImageAttachments[0] ? defaultOgImageAttachments[0].url : '';
  const defaultOgImage = cloudinaryConfigImages['defaultOg'] || defaultOgAirtableUrl;
  
  const lastModified = f['Last Modified'] || '';

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
    portfolioOwnerName: portfolioOwnerName,
    lastModified: lastModified
  };
}
