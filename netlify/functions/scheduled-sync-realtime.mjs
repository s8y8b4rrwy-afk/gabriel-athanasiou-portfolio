import { schedule } from '@netlify/functions';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { writeFile, readFile, mkdir } from 'fs/promises';
import path from 'path';

// ==========================================
// CONFIGURATION
// ==========================================
const AIRTABLE_TOKEN = process.env.VITE_AIRTABLE_TOKEN || process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;

// Fallback bio picture with Cloudinary presets (fine: q_75, ultra: q_90)
const FALLBACK_BIO_IMAGE = 'https://res.cloudinary.com/date24ay6/image/upload/v1764382938/ZAF08121_nagmpv.jpg';
// Cloudinary (server-side) feature flag and config
const USE_CLOUDINARY = process.env.USE_CLOUDINARY === 'true';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Configure Cloudinary SDK
if (USE_CLOUDINARY && CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  });
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

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Calculate hash of data to detect changes
const hashData = (data) => {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
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
  if (!url) return { type: null, id: null, hash: null };
  
  // YouTube
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const ytMatch = url.match(ytRegex);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1], hash: null };
  
  // Vimeo (with optional private hash)
  const vimeoRegex = /vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1], hash: vimeoMatch[2] || null };
  
  return { type: null, id: null, hash: null };
};

const fetchVideoThumbnail = async (videoUrl) => {
  if (!videoUrl) return '';
  
  const { type, id, hash } = getVideoId(videoUrl);
  
  try {
    if (type === 'youtube') {
      return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
    } else if (type === 'vimeo') {
      // For private/unlisted videos with hash, use OEmbed API
      if (hash) {
        const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`;
        const res = await fetchWithTimeout(oembedUrl, {}, 5000);
        if (!res.ok) return '';
        const data = await res.json();
        return data.thumbnail_url || '';
      } else {
        // Public videos can use the v2 API
        const res = await fetchWithTimeout(`https://vimeo.com/api/v2/video/${id}.json`, {}, 5000);
        if (!res.ok) return '';
        const data = await res.json();
        return data[0]?.thumbnail_large || '';
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

// Upload image to Cloudinary with eager transformations
// Pre-generates 8 variants at upload time to eliminate cold-start delays
const uploadToCloudinary = async (imageUrl, publicId) => {
  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      public_id: publicId,
      folder: '',
      resource_type: 'image',
      format: 'webp', // Convert to WebP, keep original resolution
      quality: 100, // Upload at highest quality - variants generated by eager transformations
      eager: EAGER_TRANSFORMATIONS, // Pre-generate all 8 transformation variants
      eager_async: false, // Generate synchronously (adds ~6-8 seconds per image)
      overwrite: true // Overwrite existing images with same public_id
    });
    
    return {
      success: true,
      publicId: result.public_id,
      cloudinaryUrl: result.secure_url,
      format: result.format,
      bytes: result.bytes
    };
  } catch (error) {
    console.error(`Failed to upload ${publicId}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// ==========================================
// MAIN SYNC LOGIC
// ==========================================

const syncAirtableData = async () => {
  console.log('=== Starting Airtable Sync ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('🔧 Configuration:');
  console.log(`  USE_CLOUDINARY: ${USE_CLOUDINARY}`);
  console.log(`  CLOUDINARY_CLOUD_NAME: ${CLOUDINARY_CLOUD_NAME ? '✓ Set' : '✗ Missing'}`);
  console.log(`  CLOUDINARY_API_KEY: ${CLOUDINARY_API_KEY ? '✓ Set' : '✗ Missing'}`);
  console.log(`  CLOUDINARY_API_SECRET: ${CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Missing'}`);
  
  // Check configuration
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    throw new Error('Airtable credentials not configured');
  }
  
  // Load existing Cloudinary mapping for change detection
  let existingMapping = { generatedAt: new Date().toISOString(), projects: [], journal: [] };
  if (USE_CLOUDINARY) {
    existingMapping = await loadCloudinaryMapping();
    console.log(`📂 Loaded mapping: ${existingMapping.projects.length} projects, ${existingMapping.journal.length} journal posts`);
  }
  
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
      
      // Base gallery URLs direct from Airtable (highest resolution)
      const galleryUrls = f['Gallery']?.map(img => img.url) || [];
      
      // Get video URL and thumbnail
      const videoUrl = f['Video URL'] || '';
      const hasVideo = !!(videoUrl && videoUrl.trim());
      let heroImage = galleryUrls[0] || '';
      
      if (!heroImage && hasVideo) {
        console.log(`Fetching thumbnail for ${f['Name']}: ${videoUrl}`);
        const thumbnailUrl = await fetchVideoThumbnail(videoUrl);
        console.log(`Got thumbnail: ${thumbnailUrl || 'FAILED'}`);
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
      
      // Debug: Log the first project's production company field
      if (projectsRecords.indexOf(record) === 0) {
        console.log('DEBUG - First project Production Company field:', productionCompanyField);
        console.log('DEBUG - ClientsMap has', Object.keys(clientsMap).length, 'entries');
        if (productionCompanyField && Array.isArray(productionCompanyField) && productionCompanyField.length > 0) {
          console.log('DEBUG - First ID:', productionCompanyField[0], '→', clientsMap[productionCompanyField[0]]);
        }
      }
      
      if (Array.isArray(productionCompanyField)) {
        productionCompany = productionCompanyField.map(id => clientsMap[id] || id).join(', ');
      } else if (productionCompanyField) {
        productionCompany = clientsMap[productionCompanyField] || productionCompanyField;
      }
      
      // If Cloudinary is enabled, upload images and map to optimized URLs
      let cloudinaryGallery = [];
      let cloudinaryHero = '';
      if (USE_CLOUDINARY && CLOUDINARY_CLOUD_NAME) {
        console.log(`🔵 Cloudinary enabled for ${f['Name']}: ${galleryUrls.length} images`);
        // Upload each gallery image to Cloudinary (if credentials available)
        if (CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
          console.log('🔑 Cloudinary credentials found, checking for changes...');
          const existingProject = existingMapping.projects.find(p => p.recordId === record.id);
          
          for (let idx = 0; idx < galleryUrls.length; idx++) {
            const publicId = `portfolio-projects-${record.id}-${idx}`;
            const existingImage = existingProject?.images?.find(img => img.index === idx);
            
            // Check if image already exists and hasn't changed
            if (existingImage && existingImage.originalUrl === galleryUrls[idx]) {
              console.log(`⏭️ Skipping ${publicId} (unchanged)`);
            } else {
              console.log(`📤 Uploading ${publicId} from ${galleryUrls[idx]}`);
              const uploadResult = await uploadToCloudinary(galleryUrls[idx], publicId);
              if (uploadResult.success) {
                console.log(`✅ Uploaded ${publicId} - ${uploadResult.bytes} bytes`);
              } else {
                console.error(`❌ Failed ${publicId}: ${uploadResult.error}`);
              }
            }
          }
        } else {
          console.warn('⚠️ Cloudinary credentials missing - skipping upload');
        }
        
        // Generate optimized delivery URLs with fine preset
        cloudinaryGallery = galleryUrls.map((_, idx) => `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/q_75,w_1600,c_limit,f_auto,dpr_auto/portfolio-projects-${record.id}-${idx}`);
        // Fall back to original heroImage (which might be a video thumbnail) if no Cloudinary gallery exists
        cloudinaryHero = cloudinaryGallery[0] || heroImage;
      }

      const useCloudinary = USE_CLOUDINARY && CLOUDINARY_CLOUD_NAME;

      return {
        id: record.id,
        title: normalizeTitle(f['Name']),
        type: type,
        kinds: kinds,
        genre: f['Genre'] || [],
        productionCompany: productionCompany,
        client: f['Client'] || '',
        year: year,
        description: f['About'] || '',
        isFeatured: !!f['Front Page'],
        heroImage: useCloudinary ? cloudinaryHero : heroImage,
        gallery: useCloudinary ? cloudinaryGallery : galleryUrls,
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
          
          // Base cover image URL from Airtable (highest resolution)
          const imageUrl = f['Cover Image']?.[0]?.url || '';
          
          // If Cloudinary is enabled, upload and use optimized URL
          let cloudinaryImageUrl = imageUrl;
          if (USE_CLOUDINARY && CLOUDINARY_CLOUD_NAME && imageUrl) {
            console.log(`🔵 Uploading journal cover for ${f['Title']}`);
            // Upload journal cover image (if credentials available)
            if (CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
              const publicId = `portfolio-journal-${record.id}`;
              const existingPost = existingMapping.journal.find(p => p.recordId === record.id);
              const existingImage = existingPost?.images?.[0];
              
              // Check if image already exists and hasn't changed
              if (existingImage && existingImage.originalUrl === imageUrl) {
                console.log(`⏭️ Skipping ${publicId} (unchanged)`);
              } else {
                console.log(`📤 Uploading ${publicId} from ${imageUrl}`);
                const uploadResult = await uploadToCloudinary(imageUrl, publicId);
                if (uploadResult.success) {
                  console.log(`✅ Uploaded ${publicId} - ${uploadResult.bytes} bytes`);
                } else {
                  console.error(`❌ Failed ${publicId}: ${uploadResult.error}`);
                }
              }
            }
            
            // Use optimized delivery URL with highest quality
            cloudinaryImageUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/q_75,w_1600,c_limit,f_auto,dpr_auto/portfolio-journal-${record.id}`;
          }
          
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
            imageUrl: cloudinaryImageUrl,
            relatedProjectId: f['Related Project']?.[0] || f['Projects']?.[0] || null,
            source: 'local',
            relatedLinks: relatedLinks
          };
        })
    );
    
    console.log(`Processed ${posts.length} journal posts`);
    
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
    
    // 11. Update Cloudinary mapping with all current images
    if (USE_CLOUDINARY) {
      const updatedMapping = {
        generatedAt: new Date().toISOString(),
        projects: projects.map(p => ({
          recordId: p.id,
          title: p.title,
          images: p.gallery.map((url, idx) => ({
            index: idx,
            publicId: `portfolio-projects-${p.id}-${idx}`,
            cloudinaryUrl: url,
            originalUrl: (p.gallery || [])[idx] || url,
            format: 'webp'
          }))
        })),
        journal: posts.filter(post => post.imageUrl).map(post => ({
          recordId: post.id,
          title: post.title,
          images: [{
            index: 0,
            publicId: `portfolio-journal-${post.id}`,
            cloudinaryUrl: post.imageUrl,
            originalUrl: post.imageUrl,
            format: 'webp'
          }]
        }))
      };
      
      await saveCloudinaryMapping(updatedMapping);
    }
    
    // 12. Return processed data for CDN caching
    console.log('=== Sync Complete ===');
    console.log(`Projects: ${projects.length}`);
    console.log(`Posts: ${posts.length}`);
    
    const finalData = {
      projects,
      posts,
      config,
      lastUpdated: new Date().toISOString(),
      version: '1.0'
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
      body: JSON.stringify(finalData)
    };
    
  } catch (error) {
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
