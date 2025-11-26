import { builder } from '@netlify/functions';
import Airtable from 'airtable';
import * as https from 'node:https';

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=1920&auto=format&fit=crop";

const normalizeTitle = (title) => {
    if (!title) return 'Untitled';
    let clean = title.replace(/[_-]/g, ' ');
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
};

// Slug helpers for server function (no external deps)
const slugify = (input) => {
    if (!input) return 'untitled';
    let s = input.toString().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    s = s.replace(/[^a-z0-9]+/g, '-');
    s = s.replace(/^-+|-+$/g, '');
    s = s.replace(/-{2,}/g, '-');
    return s || 'untitled';
};

const makeUniqueSlug = (base, used, fallbackId) => {
    let candidate = slugify(base);
    if (!used.has(candidate)) { used.add(candidate); return candidate; }
    if (fallbackId) {
        const suffix = (fallbackId + '').replace(/[^a-z0-9]/gi, '').slice(0,6).toLowerCase();
        const alt = `${candidate}-${suffix}`;
        if (!used.has(alt)) { used.add(alt); return alt; }
    }
    let i = 2;
    while (true) {
        const alt = `${candidate}-${i}`;
        if (!used.has(alt)) { used.add(alt); return alt; }
        i += 1;
    }
};

// Helper to extract ID from URL (Enhanced Regex with Vimeo Hash Support)
const getVideoId = (url) => {
    if (!url) return { type: null, id: null };
    const cleanUrl = url.trim();

    // YouTube Regex
    const ytMatch = cleanUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (ytMatch && ytMatch[1]) {
        return { type: 'youtube', id: ytMatch[1] };
    }

    // Vimeo Regex
    // Covers: vimeo.com/123456, vimeo.com/123456/hash, player.vimeo.com/video/123456
    // Ignores prefixes: manage/videos, channels/xxx, groups/xxx/videos
    const vimeoMatch = cleanUrl.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(?:(?:channels\/[a-zA-Z0-9]+\/)|(?:groups\/[a-zA-Z0-9]+\/videos\/)|(?:manage\/videos\/))?([0-9]+)(?:\/([a-zA-Z0-9]+))?/);
    
    if (vimeoMatch && vimeoMatch[1]) {
        let id = vimeoMatch[1];
        let hash = vimeoMatch[2] || null;

        // Check for query param hash if not found in path (?h=abcdef)
        if (!hash && cleanUrl.includes('?')) {
            try {
                // Node.js URL require full path for constructor if parsing incomplete urls, but usually cleanUrl is full
                // Fallback to simple regex if URL constructor fails
                const queryHash = cleanUrl.match(/[?&]h=([a-zA-Z0-9]+)/);
                if (queryHash) hash = queryHash[1];
            } catch (e) {}
        }

        return { type: 'vimeo', id, hash };
    }

    return { type: null, id: null };
};

// Async Resolver for Vanity URLs
const resolveVideoUrl = async (url) => {
    if (!url) return '';
    const { type, id, hash } = getVideoId(url);

    // If we already have a valid ID, just reconstruct the canonical URL
    if (id) {
        if (type === 'youtube') return `https://www.youtube.com/watch?v=${id}`;
        if (type === 'vimeo') {
            return hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`;
        }
    }
    
    // Try OEmbed for Vimeo vanity URLs (Fallback only)
    if (url.includes('vimeo.com')) {
        return new Promise((resolve) => {
            https.get(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.video_id) resolve(`https://vimeo.com/${json.video_id}`);
                        else resolve(url);
                    } catch(e) { resolve(url); }
                });
            }).on('error', () => resolve(url));
        });
    }
    return url;
};

// Robust Async Thumbnail Fetcher
const fetchVideoThumbnail = async (url) => {
    if (!url) return '';
    const { type, id } = getVideoId(url);
    if (!id) return '';

    if (type === 'youtube') {
        return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
    }
    if (type === 'vimeo') {
        // Try OEmbed first for highest quality and private video support
        return new Promise((resolve) => {
            https.get(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const thumb = json.thumbnail_url || json.thumbnail_url_with_play_button || '';
                        resolve(thumb);
                    } catch(e) { 
                        // Fallback to vumbnail if OEmbed fails
                        resolve(`https://vumbnail.com/${id}.jpg`);
                    }
                });
            }).on('error', () => resolve(`https://vumbnail.com/${id}.jpg`));
        });
    }
    return ''; 
};


const parseCreditsText = (text) => {
    if (!text) return [];
    const items = text.split(/[,|\n]+/).map(s => s.trim()).filter(s => s.length > 0);
    return items.map(item => {
        const parts = item.split(':');
        if (parts.length >= 2) {
            return {
                role: parts[0].trim(),
                name: parts.slice(1).join(':').trim()
            };
        }
        return { role: 'Credit', name: item };
    });
};

const getDataHandler = async (event, context) => {
    const token = process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID;

    if (!token || !baseId) {
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing Keys' }), ttl: 300 };
    }
    const base = new Airtable({ apiKey: token }).base(baseId);

  try {
    const projectRecords = await base('Projects').select().all();
    
    // Awards Map
    let awardsMap = {};
    try {
        let awardRecords = [];
        try { awardRecords = await base('Awards').select().all(); } catch (e) { awardRecords = await base('Festivals').select().all(); }
        awardRecords.forEach(r => { awardsMap[r.id] = r.get('Name') || r.get('Award') || 'Unknown'; });
    } catch (e) {}

    // Clients Map - Try Client Book first, then Clients
    let clientsMap = {};
    try {
        let clientRecords = [];
        try { 
            clientRecords = await base('Client Book').select().all(); 
        } catch (e) { 
            clientRecords = await base('Clients').select().all(); 
        }
        
        clientRecords.forEach(r => { 
            // Prioritize Company Name, REMOVED Name fallback
            clientsMap[r.id] = r.get('Company Name') || r.get('Client') || r.get('Company') || 'Unknown'; 
        });
    } catch (e) {}

    let journalRecords = [];
    try { journalRecords = await base('Journal').select({ sort: [{ field: 'Date', direction: 'desc' }] }).all(); } catch (e) {}

    let globalSettings = null;
    try { const settings = await base('Settings').select({ maxRecords: 1 }).firstPage(); globalSettings = settings[0]; } catch (e) {}
    
    // Process Allowed Roles Filter
    const allowedRolesRaw = globalSettings?.get('Allowed Roles');
    const allowedRoles = allowedRolesRaw ? (Array.isArray(allowedRolesRaw) ? allowedRolesRaw : [allowedRolesRaw]) : [];

    const publishedRecords = projectRecords.filter(r => {
        if (!r.get('Feature')) return false;
        
        // Allowed Roles Filter
        if (allowedRoles.length > 0) {
            const projectRoles = r.get('Role') || [];
            const pRoles = Array.isArray(projectRoles) ? projectRoles : [projectRoles];
            return pRoles.some(role => allowedRoles.includes(role));
        }
        return true;
    });

    // Process Projects with Async Video Resolution
    const projects = await Promise.all(publishedRecords.map(async record => {
      
        // External Links Logic
        const rawExternalLinks = record.get('External Links') || '';
        const extItems = rawExternalLinks.split(/[,|\n]+/).map(s => s.trim()).filter(s => s.length > 0);
        
        const extLinks = [];
        const extVideos = [];
        
        for (const item of extItems) {
            if (!item.startsWith('http')) continue;
            const resolved = await resolveVideoUrl(item);
            const vidInfo = getVideoId(resolved);
            if (vidInfo.type) {
                extVideos.push(resolved);
            } else {
                 let label = "External Link";
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
                } catch(e){}
                extLinks.push({ label, url: item });
            }
        }
      
      const rawVideoField = record.get('Video URL') || '';
      const rawVideoUrls = rawVideoField.split(/[,|\n]+/).map(s => s.trim()).filter(s => s.length > 0);
      
      const allVideoUrls = await Promise.all(rawVideoUrls.map(u => resolveVideoUrl(u)));
      const videoUrl = allVideoUrls.length > 0 ? allVideoUrls[0] : '';
      const extraVideoFieldUrls = allVideoUrls.slice(1);

      const galleryField = record.get('Gallery');
      const galleryUrls = galleryField ? galleryField.map(img => img.url) : [];

      // FETCH THUMBNAIL ASYNC
      const autoThumbnail = await fetchVideoThumbnail(videoUrl);

      const heroImage = galleryUrls.length > 0 ? galleryUrls[0] : (autoThumbnail || PLACEHOLDER_IMAGE);

      // CREDITS - Filter roles to only show Allowed Roles from Settings
      const allRoles = record.get('Role') || [];
      const myRoles = allRoles
          .filter(r => allowedRoles.length === 0 || allowedRoles.includes(r))
          .map(r => ({ role: r, name: 'Gabriel Athanasiou' }));
      let extraCredits = [];
      const rawCreditsText = record.get('Credits Text') || record.get('Credits');
      if (rawCreditsText) {
          extraCredits = parseCreditsText(rawCreditsText);
      }
      const credits = [...myRoles, ...extraCredits];
      
      const rawDate = record.get('Release Date') || record.get('Work Date');
      const year = rawDate ? rawDate.substring(0, 4) : '';

      let type = record.get('Project Type') || record.get('Kind') || 'Uncategorized';
      const typeLower = type ? type.toLowerCase() : '';
      if (typeLower.includes('short') || typeLower.includes('feature') || typeLower.includes('narrative')) type = 'Narrative';
      else if (typeLower.includes('commercial') || typeLower.includes('tvc') || typeLower.includes('brand')) type = 'Commercial';
      else if (typeLower.includes('music')) type = 'Music Video';
      else if (typeLower.includes('documentary')) type = 'Documentary';
      else type = 'Uncategorized';
      
      // Genre logic
      let genres = record.get('Genre') || [];

      const festivalsField = record.get('Festivals');
      let awards = [];
      if (festivalsField) {
          if (Array.isArray(festivalsField)) awards = festivalsField.map(id => awardsMap[id] || id);
          else if (typeof festivalsField === 'string') awards = festivalsField.split('\n').filter(s => s.trim().length > 0);
          else awards = [String(festivalsField)];
      }

      // Client Resolution
      let clientName = '';
      const clientField = record.get('Client');
      if (Array.isArray(clientField)) {
        clientName = clientField.map(id => clientsMap[id] || id).join(', ');
      } else if (clientField) {
        clientName = clientsMap[clientField] || clientField;
      }
      
      const brandName = record.get('Brand') || '';

      const linkedArticleId = record.get('Related Article')?.[0] || record.get('Journal')?.[0] || record.get('Related Project')?.[0] || null;

      return {
        id: record.id,
        title: normalizeTitle(record.get('Name')),
        type: type,
        genre: genres,
        client: clientName,
        brand: brandName,
        year: year,
        description: record.get('About') || '',
        isFeatured: !!record.get('Front Page'),
        heroImage: heroImage,
        gallery: galleryUrls,
        videoUrl: videoUrl,
        additionalVideos: [...extraVideoFieldUrls, ...extVideos],
        awards: awards,
        credits: credits, 
        externalLinks: extLinks,
        relatedArticleId: linkedArticleId
      };
    }));

    projects.sort((a, b) => {
        if (!a.year) return 1;
        if (!b.year) return -1;
        return b.year.localeCompare(a.year);
    });

    const posts = journalRecords.map(record => ({
      id: record.id,
      title: record.get('Title'),
      date: record.get('Date'),
      tags: record.get('Tags') || [],
      content: record.get('Content') || '',
      imageUrl: record.get('Cover Image')?.[0]?.url || '',
      relatedProjectId: record.get('Related Project')?.[0] || record.get('Projects')?.[0] || null
    }));
    
    const defaultBio = "Gabriel Athanasiou is a director and visual artist based between London and Athens. With a background in fine art photography, his work is characterized by a rigorous attention to composition and an emotive, textural approach to light.\n\nHis narrative work explores themes of memory and temporal distortion, while his commercial portfolio includes campaigns for global luxury brands. He is currently developing his first feature film.";
    const defaultImage = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000";

    const config = {
      showreel: {
        enabled: !!globalSettings?.get('Showreel Enabled'),
        videoUrl: globalSettings?.get('Showreel URL') || '',
        placeholderImage: globalSettings?.get('Showreel Placeholder')?.[0]?.url || ''
      },
      contact: {
        email: globalSettings?.get('Contact Email') || '',
        phone: globalSettings?.get('Contact Phone') || '',
        repUK: globalSettings?.get('Rep UK') || '',
        repUSA: globalSettings?.get('Rep USA') || '',
        instagram: globalSettings?.get('Instagram URL') || '',
        vimeo: globalSettings?.get('Vimeo URL') || '',
        linkedin: globalSettings?.get('LinkedIn URL') || ''
      },
      about: {
          bio: globalSettings?.get('Bio') || globalSettings?.get('Bio Text') || defaultBio,
          profileImage: globalSettings?.get('About Image')?.[0]?.url || defaultImage
      },
      allowedRoles: allowedRoles
    };

    // Attach slugs to projects and posts
    try {
        const used = new Set();
        projects.forEach(p => { p.slug = makeUniqueSlug((p.title || p.id) + (p.year ? ` ${p.year}` : ''), used, p.id); });
        posts.forEach(post => { post.slug = makeUniqueSlug((post.title || post.id) + (post.date ? ` ${post.date}` : ''), used, post.id); });
    } catch (e) {
        // non-fatal
    }

        return { 
            statusCode: 200, 
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'public, max-age=300',
                'Netlify-CDN-Cache-Control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=86400'
            },
            body: JSON.stringify({ projects, posts, config }),
            ttl: 900
        };

  } catch (error) {
        return { 
            statusCode: 500, 
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'public, max-age=120',
                'Netlify-CDN-Cache-Control': 'public, max-age=0, s-maxage=120'
            },
            body: JSON.stringify({ error: 'Failed to fetch' }),
            ttl: 120
        };
  }
};

export const handler = builder(getDataHandler);