import { schedule } from '@netlify/functions';
import fetch from 'node-fetch';
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CONFIGURATION
// ==========================================
const AIRTABLE_TOKEN = process.env.VITE_AIRTABLE_TOKEN || process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;

// NOTE: Image optimization temporarily disabled due to Sharp compatibility issues
// Images will use Airtable URLs directly (already CDN-served)
// See IMPLEMENTATION_LOG.md for future optimization options

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

// Image optimization functions removed - keeping Airtable URLs directly
// See IMPLEMENTATION_LOG.md for future optimization options

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
      
      // Use Airtable image URLs directly (no optimization)
      const galleryUrls = f['Gallery']?.map(img => img.url) || [];
      
      // Get video URL and thumbnail
      const videoUrl = f['Video URL'] || '';
      let heroImage = galleryUrls[0] || '';
      
      if (!heroImage && videoUrl) {
        const thumbnailUrl = await fetchVideoThumbnail(videoUrl);
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
        gallery: galleryUrls,
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
          
          // Use Airtable cover image URL directly (no optimization)
          const imageUrl = f['Cover Image']?.[0]?.url || '';
          
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
    console.log('Generating sitemap.xml...');
    const sitemap = generateSitemap(projects, posts);
    const sitemapPath = path.join(__dirname, '..', '..', 'public', 'sitemap.xml');
    await writeFile(sitemapPath, sitemap, 'utf-8');
    console.log(`✅ Sitemap written to ${sitemapPath}`);
    
    console.log('Generating share-meta.json...');
    const shareMeta = generateShareMeta(projects, posts, config);
    const shareMetaPath = path.join(__dirname, '..', '..', 'public', 'share-meta.json');
    await writeFile(shareMetaPath, JSON.stringify(shareMeta, null, 2), 'utf-8');
    console.log(`✅ Share-meta written to ${shareMetaPath}`);
    
    // Generate hash for deployment trigger
    const hash = createHash('sha256')
      .update(JSON.stringify(shareMeta.projects) + JSON.stringify(shareMeta.posts))
      .digest('hex');
    const hashPath = path.join(__dirname, '..', '..', 'public', 'share-meta.hash');
    await writeFile(hashPath, hash, 'utf-8');
    console.log(`✅ Hash written: ${hash}`);
    
    // 12. Return processed data for CDN caching
    console.log('=== Sync Complete ===');
    console.log(`Projects: ${projects.length}`);
    console.log(`Posts: ${posts.length}`);
    console.log('Note: Images using Airtable URLs (optimization disabled)');
    
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
