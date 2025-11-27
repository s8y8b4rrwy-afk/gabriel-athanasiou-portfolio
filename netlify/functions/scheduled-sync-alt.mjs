import { schedule } from '@netlify/functions';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

// ==========================================
// CONFIGURATION
// ==========================================
const AIRTABLE_TOKEN = process.env.VITE_AIRTABLE_TOKEN || process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;
// Cloudinary (server-side) feature flag and config
const USE_CLOUDINARY = process.env.USE_CLOUDINARY === 'true';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

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

// Upload image to Cloudinary with highest quality settings
// Cloudinary fetches the original from Airtable and optimizes it
const uploadToCloudinary = async (imageUrl, publicId) => {
  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      public_id: publicId,
      folder: '',
      resource_type: 'image',
      format: 'auto', // Best format per browser (WebP/AVIF)
      quality: 'auto:best', // Highest quality with smart compression
      transformation: [
        { width: 2400, crop: 'limit' } // Max 2400px for retina displays
      ]
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
  
  // Check configuration
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    throw new Error('Airtable credentials not configured');
  }
  
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
    
    console.log('Processing data...');
    
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
      let heroImage = galleryUrls[0] || '';
      
      if (!heroImage && videoUrl) {
        console.log(`Fetching thumbnail for ${f['Name']}: ${videoUrl}`);
        const thumbnailUrl = await fetchVideoThumbnail(videoUrl);
        console.log(`Got thumbnail: ${thumbnailUrl || 'FAILED'}`);
        if (thumbnailUrl) heroImage = thumbnailUrl;
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
        // Upload each gallery image to Cloudinary (if credentials available)
        if (CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
          for (let idx = 0; idx < galleryUrls.length; idx++) {
            const publicId = `portfolio-projects-${record.id}-${idx}`;
            const uploadResult = await uploadToCloudinary(galleryUrls[idx], publicId);
            if (uploadResult.success) {
              console.log(`✓ Uploaded ${publicId}`);
            }
          }
        }
        
        // Generate optimized delivery URLs with highest quality
        cloudinaryGallery = galleryUrls.map((_, idx) => `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto:best,c_limit,dpr_auto,w_1600/portfolio-projects-${record.id}-${idx}`);
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
            // Upload journal cover image (if credentials available)
            if (CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
              const publicId = `portfolio-journal-${record.id}`;
              const uploadResult = await uploadToCloudinary(imageUrl, publicId);
              if (uploadResult.success) {
                console.log(`✓ Uploaded ${publicId}`);
              }
            }
            
            // Use optimized delivery URL with highest quality
            cloudinaryImageUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto:best,c_limit,dpr_auto,w_1600/portfolio-journal-${record.id}`;
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
    
    // 11. Return processed data for CDN caching
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
