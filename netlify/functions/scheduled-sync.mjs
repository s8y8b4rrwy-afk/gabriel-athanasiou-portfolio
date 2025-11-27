import { schedule } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';
import sharp from 'sharp';
import crypto from 'crypto';

// ==========================================
// CONFIGURATION
// ==========================================
const AIRTABLE_TOKEN = process.env.VITE_AIRTABLE_TOKEN || process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;

// KV Store key for cached data
const KV_DATA_KEY = 'airtable-data';
const KV_HASH_KEY = 'airtable-data-hash';

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Calculate hash of data to detect changes
const hashData = (data) => {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
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

// Download and optimize image to WebP
const optimizeImage = async (imageUrl, quality = 80) => {
  try {
    const response = await fetchWithTimeout(imageUrl, {}, 30000);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    
    const buffer = await response.buffer();
    
    // Convert to WebP with specified quality
    const webpBuffer = await sharp(buffer)
      .webp({ quality })
      .toBuffer();
    
    return webpBuffer;
  } catch (error) {
    console.error(`Failed to optimize image ${imageUrl}:`, error.message);
    return null;
  }
};

// Generate stable blob key from URL
const generateBlobKey = (url) => {
  const hash = crypto.createHash('md5').update(url).digest('hex');
  return `images/${hash}.webp`;
};

// Process and upload image to Blobs storage
const processAndUploadImage = async (imageUrl, blobStore, existingBlobs = new Set()) => {
  if (!imageUrl) return null;
  
  const blobKey = generateBlobKey(imageUrl);
  
  // Skip if already processed
  if (existingBlobs.has(blobKey)) {
    console.log(`Image already exists: ${blobKey}`);
    return `/.netlify/blobs/${blobKey}`;
  }
  
  console.log(`Processing new image: ${imageUrl}`);
  const webpBuffer = await optimizeImage(imageUrl);
  
  if (!webpBuffer) return null;
  
  // Upload to Netlify Blobs
  await blobStore.set(blobKey, webpBuffer, {
    metadata: {
      originalUrl: imageUrl,
      processedAt: new Date().toISOString()
    }
  });
  
  console.log(`Uploaded to Blobs: ${blobKey}`);
  return `/.netlify/blobs/${blobKey}`;
};

// Text processing utilities (from textHelpers)
const normalizeTitle = (title) => {
  if (!title) return '';
  return title.replace(/\s+/g, ' ').trim();
};

const calculateReadingTime = (text) => {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return Math.max(1, minutes);
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
  
  // Vimeo
  const vimeoRegex = /vimeo\.com\/(?:video\/)?(\d+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1] };
  
  return { type: null, id: null };
};

const fetchVideoThumbnail = async (videoUrl) => {
  if (!videoUrl) return '';
  
  const { type, id } = getVideoId(videoUrl);
  
  try {
    if (type === 'youtube') {
      return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
    } else if (type === 'vimeo') {
      const res = await fetchWithTimeout(`https://vimeo.com/api/v2/video/${id}.json`, {}, 5000);
      if (!res.ok) return '';
      const data = await res.json();
      return data[0]?.thumbnail_large || '';
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
// MAIN SYNC LOGIC
// ==========================================

const syncAirtableData = async () => {
  console.log('=== Starting Airtable Sync ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  // Check configuration
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    throw new Error('Airtable credentials not configured');
  }
  
  // Initialize Blobs store
  const blobStore = getStore('portfolio-images');
  
  // Initialize KV store (using Blobs with 'kv' prefix for now)
  const kvStore = getStore('portfolio-kv');
  
  try {
    // 1. Fetch all data from Airtable
    console.log('Fetching data from Airtable...');
    const [awardsRecords, clientsRecords, projectsRecords, journalRecords, settingsRecords] = await Promise.all([
      fetchAirtableTable('Awards'),
      fetchAirtableTable('Client Book'),
      fetchAirtableTable('Projects', 'Release Date'),
      fetchAirtableTable('Journal', 'Date'),
      fetchAirtableTable('Settings')
    ]);
    
    // 2. Calculate hash of raw data to detect changes
    const rawDataHash = hashData({ 
      projects: projectsRecords, 
      journal: journalRecords, 
      settings: settingsRecords 
    });
    
    // 3. Compare with previous hash
    let previousHash = null;
    try {
      const hashBlob = await kvStore.get(KV_HASH_KEY, { type: 'text' });
      previousHash = hashBlob;
    } catch (e) {
      console.log('No previous hash found, this is first sync');
    }
    
    if (previousHash === rawDataHash) {
      console.log('No changes detected, skipping processing');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'No changes detected', 
          timestamp: new Date().toISOString() 
        })
      };
    }
    
    console.log('Changes detected, processing data...');
    
    // 4. Build lookup maps
    const awardsMap = {};
    awardsRecords.forEach(r => {
      awardsMap[r.id] = r.fields['Display Name'] || r.fields['Name'] || r.fields['Award'] || 'Unknown Award';
    });
    
    const clientsMap = {};
    clientsRecords.forEach(r => {
      clientsMap[r.id] = r.fields['Company Name'] || r.fields['Client'] || 'Unknown';
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
        profileImage: settingsFields['About Image']?.[0]?.url || ''
      },
      allowedRoles: allowedRoles,
      defaultOgImage: settingsFields['Default OG Image']?.[0]?.url || ''
    };
    
    // 6. Get list of existing blobs to avoid re-processing
    const existingBlobs = new Set();
    try {
      const { blobs } = await blobStore.list();
      blobs.forEach(blob => existingBlobs.add(blob.key));
      console.log(`Found ${existingBlobs.size} existing images in Blobs storage`);
    } catch (e) {
      console.log('No existing blobs found or error listing:', e.message);
    }
    
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
      
      // Process gallery images
      const galleryUrls = f['Gallery']?.map(img => img.url) || [];
      const optimizedGallery = [];
      
      for (const url of galleryUrls) {
        const optimizedUrl = await processAndUploadImage(url, blobStore, existingBlobs);
        if (optimizedUrl) optimizedGallery.push(optimizedUrl);
      }
      
      // Process video thumbnail
      const videoUrl = f['Video URL'] || '';
      let heroImage = optimizedGallery[0] || '';
      
      if (!heroImage && videoUrl) {
        const thumbnailUrl = await fetchVideoThumbnail(videoUrl);
        if (thumbnailUrl) {
          const optimizedThumb = await processAndUploadImage(thumbnailUrl, blobStore, existingBlobs);
          if (optimizedThumb) heroImage = optimizedThumb;
        }
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
      
      // Process client
      let clientName = '';
      const clientField = f['Client'];
      if (Array.isArray(clientField)) {
        clientName = clientField.map(id => clientsMap[id] || id).join(', ');
      } else if (clientField) {
        clientName = clientsMap[clientField] || clientField;
      }
      
      return {
        id: record.id,
        title: normalizeTitle(f['Name']),
        type: type,
        kinds: kinds,
        genre: f['Genre'] || [],
        client: clientName,
        brand: f['Brand'] || '',
        year: year,
        description: f['About'] || '',
        isFeatured: !!f['Front Page'],
        heroImage: heroImage,
        gallery: optimizedGallery,
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
          
          // Process cover image
          let imageUrl = '';
          if (f['Cover Image']?.[0]?.url) {
            const optimizedImage = await processAndUploadImage(f['Cover Image'][0].url, blobStore, existingBlobs);
            imageUrl = optimizedImage || '';
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
            imageUrl: imageUrl,
            relatedProjectId: f['Related Project']?.[0] || f['Projects']?.[0] || null,
            source: 'local',
            relatedLinks: relatedLinks
          };
        })
    );
    
    console.log(`Processed ${posts.length} journal posts`);
    
    // 9. Process config images
    if (config.about.profileImage) {
      const optimizedProfile = await processAndUploadImage(config.about.profileImage, blobStore, existingBlobs);
      if (optimizedProfile) config.about.profileImage = optimizedProfile;
    }
    
    if (config.defaultOgImage) {
      const optimizedOg = await processAndUploadImage(config.defaultOgImage, blobStore, existingBlobs);
      if (optimizedOg) config.defaultOgImage = optimizedOg;
    }
    
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
    
    // 11. Save to KV storage
    console.log('Saving to KV storage...');
    const finalData = {
      projects,
      posts,
      config,
      lastUpdated: new Date().toISOString(),
      version: '1.0'
    };
    
    await kvStore.set(KV_DATA_KEY, JSON.stringify(finalData));
    await kvStore.set(KV_HASH_KEY, rawDataHash);
    
    console.log('=== Sync Complete ===');
    console.log(`Projects: ${projects.length}`);
    console.log(`Posts: ${posts.length}`);
    console.log(`Images processed: ${existingBlobs.size}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Sync completed successfully',
        stats: {
          projects: projects.length,
          posts: posts.length,
          images: existingBlobs.size,
          timestamp: new Date().toISOString()
        }
      })
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
