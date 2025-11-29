import { schedule } from '@netlify/functions';
import fetch from 'node-fetch';
import { writeFile, readFile, mkdir, existsSync } from 'fs/promises';
import { existsSync as existsSyncSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createHash } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

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

// Fallback bio picture with Cloudinary presets (fine: q_75, ultra: q_90)
const FALLBACK_BIO_IMAGE = 'https://res.cloudinary.com/date24ay6/image/upload/v1764382938/ZAF08121_nagmpv.jpg';

// Cloudinary configuration
const USE_CLOUDINARY = process.env.USE_CLOUDINARY === 'true';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Build hook configuration
const NETLIFY_BUILD_HOOK = process.env.NETLIFY_BUILD_HOOK;

// Initialize Cloudinary if enabled and credentials available
if (USE_CLOUDINARY && CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  });
  console.log('✅ Cloudinary configured');
} else if (USE_CLOUDINARY) {
  console.warn('⚠️ USE_CLOUDINARY=true but credentials missing');
}

// Transformation presets for eager generation
const TRANSFORMATION_PRESETS = {
  widths: [800, 1600],
  qualities: [90, 75],  // ultra, fine
  dprs: [1.0, 2.0],
  format: 'webp'
};

// Generate all eager transformation combinations (8 total: 2 widths × 2 qualities × 2 DPRs × 1 format)
const EAGER_TRANSFORMATIONS = [];
for (const width of TRANSFORMATION_PRESETS.widths) {
  for (const quality of TRANSFORMATION_PRESETS.qualities) {
    for (const dpr of TRANSFORMATION_PRESETS.dprs) {
      EAGER_TRANSFORMATIONS.push({
        width: width,
        quality: quality,
        dpr: dpr,
        crop: 'limit',
        format: TRANSFORMATION_PRESETS.format,
        fetch_format: 'auto'
      });
    }
  }
}

console.log(`🎯 Eager transformations configured: ${EAGER_TRANSFORMATIONS.length} variants per image`);

// NOTE: Image optimization temporarily disabled due to Sharp compatibility issues
// Images will use Airtable URLs directly (already CDN-served)
// See IMPLEMENTATION_LOG.md for future optimization options

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Calculate hash of data to detect changes
const hashData = (data) => {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
};

// Load previous hash to detect changes
const loadPreviousHash = async () => {
  try {
    const baseDir = existsSyncSync(path.join(process.cwd(), 'public')) 
      ? path.join(process.cwd(), 'public')
      : '/tmp';
    const hashPath = path.join(baseDir, 'share-meta.hash');
    const hash = await readFile(hashPath, 'utf-8');
    return hash.trim();
  } catch (error) {
    console.log('ℹ️ No previous hash found (first run or file deleted)');
    return null;
  }
};

// Trigger Netlify build hook when content changes
const triggerNetlifyBuild = async (reason = 'Content updated') => {
  if (!NETLIFY_BUILD_HOOK) {
    console.log('⏭️  NETLIFY_BUILD_HOOK not configured, skipping build trigger');
    return { triggered: false, reason: 'No hook configured' };
  }

  const buildHookUrl = `https://api.netlify.com/build_hooks/${NETLIFY_BUILD_HOOK}`;
  
  try {
    console.log('🔔 Triggering Netlify build...');
    const response = await fetchWithTimeout(buildHookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger_title: reason })
    }, 10000);

    if (response.ok) {
      console.log('✅ Netlify build triggered successfully');
      return { triggered: true, reason };
    } else {
      console.error(`⚠️  Build hook failed: ${response.status} ${response.statusText}`);
      return { triggered: false, reason: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.error('⚠️  Failed to trigger build hook:', error.message);
    return { triggered: false, reason: error.message };
  }
};

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

// Generate a stable hash from Airtable attachment metadata
// This is used to detect changes in images without relying on URLs which change with each fetch
const generateAttachmentHash = (attachment) => {
  if (!attachment) return null;
  
  // Use stable Airtable metadata: id, filename, size, type
  // These fields don't change unless the actual file changes
  const stableData = {
    id: attachment.id || '',
    filename: attachment.filename || '',
    size: attachment.size || 0,
    type: attachment.type || ''
  };
  
  return createHash('md5').update(JSON.stringify(stableData)).digest('hex');
};

// Check if an attachment has changed by comparing metadata hashes
const hasAttachmentChanged = (attachment, existingImage) => {
  if (!existingImage) return true; // New image
  if (!existingImage.airtableHash) return true; // No hash stored (legacy entry)
  
  const currentHash = generateAttachmentHash(attachment);
  return currentHash !== existingImage.airtableHash;
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

// Upload image to Cloudinary with eager transformations
// Pre-generates 8 variants at upload time to eliminate cold-start delays
const uploadToCloudinary = async (imageUrl, publicId, title = '') => {
  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      public_id: publicId,
      folder: '', // Already in public_id
      resource_type: 'image',
      format: 'webp', // Convert to WebP, keep original resolution
      quality: 100, // Upload at highest quality - variants generated by eager transformations
      eager: EAGER_TRANSFORMATIONS, // Pre-generate all 8 transformation variants
      eager_async: false, // Generate synchronously (adds ~6-8 seconds per image)
      overwrite: true // Replace existing images
    });
    
    return {
      success: true,
      publicId: result.public_id,
      cloudinaryUrl: result.secure_url,
      format: result.format,
      size: result.bytes
    };
  } catch (error) {
    console.error(`Failed to upload ${publicId}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// Process Cloudinary uploads for changed/new images
const syncImagesToCloudinary = async (projects, posts, existingMapping) => {
  if (!USE_CLOUDINARY) {
    console.log('⏭️ Cloudinary disabled (USE_CLOUDINARY=false)');
    return existingMapping;
  }
  
  console.log('🔄 Checking for new/changed images to upload to Cloudinary...');
  console.log('📊 Using Airtable metadata (id, filename, size, type) for change detection');
  
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
    
    // Get raw attachment metadata (preserved during processing)
    const galleryAttachments = project._galleryAttachments || [];
    
    for (let i = 0; i < galleryAttachments.length; i++) {
      const attachment = galleryAttachments[i];
      const imageUrl = attachment.url;
      const publicId = `portfolio-projects-${project.id}-${i}`;
      
      // Find existing image in mapping
      const existingProject = existingMapping.projects.find(p => p.recordId === project.id);
      const existingImage = existingProject?.images?.find(img => img.index === i);
      
      // Use metadata-based change detection instead of URL comparison
      const currentHash = generateAttachmentHash(attachment);
      const imageChanged = hasAttachmentChanged(attachment, existingImage);
      
      if (!imageChanged && existingImage?.cloudinaryUrl) {
        // Image unchanged based on metadata, keep existing entry
        console.log(`⏭️ Skipping ${publicId} (metadata unchanged: ${attachment.filename || 'unknown'})`);
        projectData.images.push({
          ...existingImage,
          // Update the URL in case it changed (URLs are temporary)
          originalUrl: imageUrl,
          // Ensure hash is stored
          airtableHash: currentHash,
          airtableId: attachment.id,
          airtableFilename: attachment.filename,
          airtableSize: attachment.size,
          airtableType: attachment.type
        });
        skipCount++;
      } else {
        // New or changed image based on metadata, upload to Cloudinary
        console.log(`📤 Uploading ${publicId} (${imageChanged ? 'changed' : 'new'}: ${attachment.filename || 'unknown'})`);
        const result = await uploadToCloudinary(imageUrl, publicId, project.title);
        
        if (result.success) {
          projectData.images.push({
            index: i,
            publicId: result.publicId,
            cloudinaryUrl: result.cloudinaryUrl,
            originalUrl: imageUrl,
            format: result.format,
            size: result.size,
            // Store Airtable metadata for future change detection
            airtableHash: currentHash,
            airtableId: attachment.id,
            airtableFilename: attachment.filename,
            airtableSize: attachment.size,
            airtableType: attachment.type
          });
          uploadCount++;
        } else {
          // Upload failed, keep Airtable URL as fallback
          projectData.images.push({
            index: i,
            publicId: publicId,
            cloudinaryUrl: '',
            originalUrl: imageUrl,
            error: result.error,
            airtableHash: currentHash,
            airtableId: attachment.id
          });
          failCount++;
        }
      }
    }
    
    newMapping.projects.push(projectData);
  }
  
  // Process journal posts
  for (const post of posts) {
    if (!post.imageUrl) continue;
    
    const postData = {
      recordId: post.id,
      title: post.title,
      images: []
    };
    
    const publicId = `portfolio-journal-${post.id}`;
    const attachment = post._coverImageAttachment;
    
    if (!attachment) continue;
    
    // Find existing image in mapping
    const existingPost = existingMapping.journal.find(p => p.recordId === post.id);
    const existingImage = existingPost?.images?.[0];
    
    // Use metadata-based change detection
    const currentHash = generateAttachmentHash(attachment);
    const imageChanged = hasAttachmentChanged(attachment, existingImage);
    
    if (!imageChanged && existingImage?.cloudinaryUrl) {
      // Image unchanged based on metadata
      console.log(`⏭️ Skipping ${publicId} (metadata unchanged: ${attachment.filename || 'unknown'})`);
      postData.images.push({
        ...existingImage,
        originalUrl: post.imageUrl,
        airtableHash: currentHash,
        airtableId: attachment.id,
        airtableFilename: attachment.filename,
        airtableSize: attachment.size,
        airtableType: attachment.type
      });
      skipCount++;
    } else {
      // New or changed image
      console.log(`📤 Uploading ${publicId} (${imageChanged ? 'changed' : 'new'}: ${attachment.filename || 'unknown'})`);
      const result = await uploadToCloudinary(post.imageUrl, publicId, post.title);
      
      if (result.success) {
        postData.images.push({
          index: 0,
          publicId: result.publicId,
          cloudinaryUrl: result.cloudinaryUrl,
          originalUrl: post.imageUrl,
          format: result.format,
          size: result.size,
          airtableHash: currentHash,
          airtableId: attachment.id,
          airtableFilename: attachment.filename,
          airtableSize: attachment.size,
          airtableType: attachment.type
        });
        uploadCount++;
      } else {
        postData.images.push({
          index: 0,
          publicId: publicId,
          cloudinaryUrl: '',
          originalUrl: post.imageUrl,
          error: result.error,
          airtableHash: currentHash,
          airtableId: attachment.id
        });
        failCount++;
      }
    }
    
    newMapping.journal.push(postData);
  }
  
  // Note: Config images (profile, showreel) don't have Airtable attachment metadata
  // as they come from Settings table. Keep URL-based detection for these.
  const configImages = [];
  
  // Profile image - uses URL-based detection (Settings table doesn't provide stable metadata)
  if (config.about?.profileImage) {
    const publicId = 'portfolio-config-profile';
    const existingConfigImage = existingMapping.config?.images?.find(img => img.type === 'profile');
    
    // For config images, we still use URL comparison as fallback
    // since Settings attachments may not have stable metadata
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
  
  // Showreel placeholder - uses URL-based detection
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

// Fetch with timeout to prevent hanging
const fetchWithTimeout = async (url, options, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Load existing cached data as fallback during rate limits
const loadCachedData = async () => {
  try {
    const baseDir = existsSyncSync(path.join(process.cwd(), 'public')) 
      ? path.join(process.cwd(), 'public')
      : '/tmp';
    
    const portfolioDataPath = path.join(baseDir, 'portfolio-data.json');
    
    if (existsSyncSync(portfolioDataPath)) {
      const content = await readFile(portfolioDataPath, 'utf-8');
      const data = JSON.parse(content);
      console.log('✅ Loaded existing cached data as fallback');
      return data;
    }
  } catch (error) {
    console.warn('⚠️ Could not load cached data:', error.message);
  }
  return null;
};

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

// Image optimization functions removed - keeping Airtable URLs directly
// See IMPLEMENTATION_LOG.md for future optimization options

// Text processing utilities (from textHelpers)
const normalizeTitle = (title) => {
  if (!title) return '';
  return title.replace(/\s+/g, ' ').trim();
};

const calculateReadingTime = (text) => {
  if (!text) return '1 min read';
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  const mins = Math.max(1, minutes);
  return `${mins} min read`;
};

const parseCreditsText = (rawText) => {
  if (!rawText) return [];
  const lines = rawText.split('\n').filter(l => l.trim().length > 0);
  return lines.map(line => {
    const [role, name] = line.split(':').map(s => s.trim());
    return { role: role || 'Unknown', name: name || 'Unknown' };
  });
};

// Video processing utilities (simplified for server-side)
const getVideoId = (url) => {
  if (!url) return { type: null, id: null };
  
  // YouTube
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const ytMatch = url.match(ytRegex);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
  
  // Vimeo - try numeric ID first
  const vimeoRegex = /vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1], hash: vimeoMatch[2] || null };
  
  // Vimeo vanity URL (e.g., vimeo.com/athanasiou/rooster)
  if (url.includes('vimeo.com/') && !url.includes('player.vimeo.com')) {
    return { type: 'vimeo', id: url, hash: null };
  }
  
  return { type: null, id: null };
};

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

const parseExternalLinksData = (rawText) => {
  const links = [];
  const videos = [];
  
  if (!rawText) return { links, videos };
  
  const items = rawText.split(/[,|\n]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  for (const item of items) {
    if (!item.startsWith('http')) continue;
    
    const isVideo = getVideoId(item).type !== null;
    
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
};

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

const syncAirtableData = async () => {
  console.log('=== Starting Airtable Sync ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  // Check configuration
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    throw new Error('Airtable credentials not configured');
  }
  
  // Variables to track content changes and build trigger
  let contentChanged = false;
  let buildResult = null;
  
  try {
    // 1. Fetch all data from Airtable
    console.log('Fetching data from Airtable...');
    const [awardsRecords, clientsRecords, projectsRecords, journalRecords, settingsRecords] = await Promise.all([
      fetchAirtableTable('Festivals'),
      fetchAirtableTable('Client Book'),
      fetchAirtableTable('Projects', 'Release Date'),
      fetchAirtableTable('Journal', 'Date'),
      fetchAirtableTable('Settings')
    ]);
    
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
      
      // Preserve raw Airtable attachment metadata for change detection
      // Each attachment has: id, url, filename, size, type, width, height, thumbnails
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
      const linkData = parseExternalLinksData(f['External Links']);
      
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
        // Store raw attachment metadata for Cloudinary change detection
        // This data is used internally and stripped before final output
        _galleryAttachments: galleryAttachments,
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
          
          // Preserve raw Airtable attachment metadata for change detection
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
            // Store raw attachment metadata for Cloudinary change detection
            _coverImageAttachment: coverImageAttachment,
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
      
      // Generate hash for deployment trigger
      const currentHash = createHash('sha256')
        .update(JSON.stringify(shareMeta.projects) + JSON.stringify(shareMeta.posts))
        .digest('hex');
      
      // Compare with previous hash to detect changes
      const previousHash = await loadPreviousHash();
      contentChanged = previousHash !== currentHash;
      
      if (contentChanged) {
        console.log(`🔄 Content changed detected`);
        console.log(`   Previous: ${previousHash ? previousHash.substring(0, 12) + '...' : 'none'}`);
        console.log(`   Current:  ${currentHash.substring(0, 12)}...`);
        
        // Trigger Netlify build
        buildResult = await triggerNetlifyBuild('Scheduled sync: Content updated');
        
        // Save new hash
        const hashPath = path.join(baseDir, 'share-meta.hash');
        await writeFile(hashPath, currentHash, 'utf-8');
        console.log(`✅ Hash updated: ${currentHash}`);
      } else {
        console.log(`✅ No content changes detected (hash: ${currentHash.substring(0, 12)}...)`);
      }
    } catch (writeError) {
      console.warn('⚠️ Could not write sitemap/share-meta to disk (non-critical):', writeError.message);
    }
    
    // 12. Sync images to Cloudinary (if enabled and credentials available)
    let cloudinaryMapping = null;
    if (USE_CLOUDINARY && CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
      const existingMapping = await loadCloudinaryMapping();
      cloudinaryMapping = await syncImagesToCloudinary(projects, posts, existingMapping);
    }
    
    // 13. Strip internal attachment metadata before saving (used only for Cloudinary sync)
    const cleanProjects = projects.map(({ _galleryAttachments, ...rest }) => rest);
    const cleanPosts = posts.map(({ _coverImageAttachment, ...rest }) => rest);
    
    // 14. Save complete data to static JSON file for runtime serving
    const finalData = {
      projects: cleanProjects,
      posts: cleanPosts,
      config,
      lastUpdated: new Date().toISOString(),
      version: '1.0',
      source: 'scheduled-sync'
    };
    
    const portfolioDataPath = path.join(baseDir, 'portfolio-data.json');
    await writeFile(portfolioDataPath, JSON.stringify(finalData, null, 2), 'utf-8');
    console.log(`✅ Saved complete portfolio data to ${portfolioDataPath}`);
    
    // 14. Return processed data for CDN caching (with sync status)
    console.log('=== Sync Complete ===');
    console.log(`Projects: ${projects.length}`);
    console.log(`Posts: ${posts.length}`);
    if (USE_CLOUDINARY) {
      console.log('✅ Cloudinary enabled');
    } else {
      console.log('Note: Images using Airtable URLs (Cloudinary disabled)');
    }
    
    const responseData = {
      ...finalData,
      sync: {
        contentChanged: contentChanged || false,
        buildTriggered: buildResult?.triggered || false,
        buildReason: buildResult?.reason || 'No changes detected'
      }
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
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
// NETLIFY SCHEDULED FUNCTION
// ==========================================

// Export as scheduled function (runs daily at midnight UTC)
export const handler = schedule('0 0 * * *', async (event) => {
  try {
    const result = await syncAirtableData();
    return result;
  } catch (error) {
    console.error('Scheduled sync failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
});

// Also export the main function for manual invocation
export { syncAirtableData };
