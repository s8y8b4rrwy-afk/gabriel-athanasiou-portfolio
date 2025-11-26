



import { Project, BlogPost, HomeConfig } from '../types';
import { ProjectType } from '../types';
import { STATIC_PROJECTS, STATIC_POSTS, STATIC_CONFIG } from '../data/staticData';
import { instagramService } from './instagramService';
import { makeUniqueSlug } from '../utils/slugify';// ==========================================
// CONFIGURATION
// ==========================================
// Toggle this to TRUE to enable Instagram Posts in the Journal feed
const ENABLE_INSTAGRAM_INTEGRATION = false; 

// ==========================================
// 1. AIRTABLE KEYS (FROM ENV)
// ==========================================
const AIRTABLE_TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN || ""; 
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID || ""; 

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=1920&auto=format&fit=crop";

// ==========================================
// UTILITIES
// ==========================================

export const calculateReadingTime = (content: string): string => {
    if (!content) return "1 min read";
    const text = content.replace(/<[^>]*>/g, '');
    const wordCount = text.split(/\s+/).length;
    const readingSpeed = 225; 
    const minutes = Math.ceil(wordCount / readingSpeed);
    return `${minutes} min read`;
};

// Helper to extract ID from URL (Enhanced Regex with Vimeo Hash Support)
const getVideoId = (url: string): { type: 'youtube' | 'vimeo' | null, id: string | null, hash?: string | null } => {
    if (!url) return { type: null, id: null };
    const cleanUrl = url.trim();

    // YouTube Regex
    // Covers: youtube.com/watch?v=, youtube.com/embed/, youtu.be/, youtube.com/v/, youtube.com/shorts/, youtube.com/live/
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
                // Handle partial URLs by ensuring protocol
                const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
                const urlObj = new URL(fullUrl);
                const h = urlObj.searchParams.get('h');
                if (h) hash = h;
            } catch (e) {
                // Fallback regex if URL parsing fails
                const queryHash = cleanUrl.match(/[?&]h=([a-zA-Z0-9]+)/);
                if (queryHash) hash = queryHash[1];
            }
        }

        return { type: 'vimeo', id, hash };
    }

    return { type: null, id: null };
};

// Async helper to resolve vanity URLs via OEmbed
const resolveVideoUrl = async (url: string): Promise<string> => {
    if (!url) return '';
    const { type, id, hash } = getVideoId(url);
    
    // If we already have a valid ID, just reconstruct the canonical URL
    if (id) {
        if (type === 'youtube') return `https://www.youtube.com/watch?v=${id}`;
        if (type === 'vimeo') {
            return hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`;
        }
    }

    // Fallback: Use OEmbed only if regex failed (e.g. vanity URLs like vimeo.com/staffpicks)
    if (url.includes('vimeo.com')) {
        try {
            const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.video_id) {
                    return `https://vimeo.com/${data.video_id}`;
                }
            }
        } catch (e) {
            console.warn(`Failed to resolve Vimeo OEmbed for: ${url}`);
        }
    }

    return url;
};

export const getEmbedUrl = (url: string, autoplay: boolean = false, muted: boolean = false): string | null => {
    const { type, id, hash } = getVideoId(url);
    if (!type || !id) return null; 

    const params = new URLSearchParams();
    if (autoplay) {
        params.set('autoplay', '1');
        // Only mute if explicitly requested or typically required for background autoplay.
        // If autoplay is true but muted is false, we rely on browser interaction or settings.
        if (muted) {
            params.set('muted', '1');
        }
    }

    if (type === 'youtube') {
        params.set('rel', '0');
        params.set('modestbranding', '1');
        params.set('playsinline', '1');
        params.set('controls', '1');
        return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    }

    if (type === 'vimeo') {
        if (hash) params.set('h', hash);
        params.set('title', '0');
        params.set('byline', '0');
        params.set('portrait', '0');
        params.set('dnt', '1'); // Do Not Track
        params.set('playsinline', '1');
        return `https://player.vimeo.com/video/${id}?${params.toString()}`;
    }

    return null;
};

// Robust Async Thumbnail Fetcher
const fetchVideoThumbnail = async (url: string): Promise<string> => {
    const { type, id } = getVideoId(url);
    if (!id) return '';

    if (type === 'youtube') {
        return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
    }
    if (type === 'vimeo') {
        // Try OEmbed first for highest quality and private video support
        try {
            const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
            if (response.ok) {
                const data = await response.json();
                return data.thumbnail_url || data.thumbnail_url_with_play_button || '';
            }
        } catch (e) {
            console.warn(`Vimeo OEmbed thumbnail failed for ${url}, falling back.`);
        }
        // Fallback to vumbnail if OEmbed fails
        return `https://vumbnail.com/${id}.jpg`;
    }
    return '';
};

const normalizeTitle = (title: string): string => {
    if (!title) return 'Untitled';
    let clean = title.replace(/[_-]/g, ' ');
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
};

const parseCreditsText = (text: string) => {
    if (!text) return [];
    // Split by comma, pipe, or newline
    const items = text.split(/[,|\n]+/).map(s => s.trim()).filter(s => s.length > 0);
    return items.map(item => {
        // Split "Role: Name"
        const parts = item.split(':');
        if (parts.length >= 2) {
            return {
                role: parts[0].trim(),
                name: parts.slice(1).join(':').trim() // Join back in case name has colons
            };
        }
        return { role: 'Credit', name: item };
    });
};

const parseExternalLinksData = async (rawText: string): Promise<{ links: {label: string, url: string}[], videos: string[] }> => {
    const links: {label: string, url: string}[] = [];
    const videos: string[] = [];
    
    if (!rawText) return { links, videos };

    const items = rawText.split(/[,|\n]+/).map(s => s.trim()).filter(s => s.length > 0);

    for (const item of items) {
        if (!item.startsWith('http')) continue;

        const resolvedUrl = await resolveVideoUrl(item);
        const isVideo = getVideoId(resolvedUrl).type !== null;

        if (isVideo) {
            videos.push(resolvedUrl);
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
            } catch(e){}
            
            links.push({ label, url: item });
        }
    }

    return { links, videos };
};

// ==========================================
// DATA FETCHING
// ==========================================

interface ApiResponse {
    projects: Project[];
    posts: BlogPost[];
    config: HomeConfig;
}

let cachedData: ApiResponse | null = null;

// FUTURE PROOF: Fallback to static data if API fails or is unconfigured
const getSafeData = (): ApiResponse => {
    console.warn("Loading Static Fallback Data. API connection may be down.");
    // Clone static arrays so we can safely attach slugs without mutating the source
    const projects = (STATIC_PROJECTS || []).map(p => ({ ...p }));
    const posts = (STATIC_POSTS || []).map(p => ({ ...p }));

    // Attach readable unique slugs
    attachSlugs(projects, posts);

    return {
        projects,
        posts,
        config: STATIC_CONFIG
    };
}

// Attach `slug` fields to project and post arrays, ensuring uniqueness
const attachSlugs = (projects: Project[], posts: BlogPost[]) => {
    const used = new Set<string>();

    // Projects first (preferred namespace)
    projects.forEach(p => {
        const base = p.title || p.id || 'project';
        p.slug = makeUniqueSlug(base + (p.year ? ` ${p.year}` : ''), used, p.id);
    });

    // Posts
    posts.forEach(post => {
        const base = post.title || post.id || 'post';
        post.slug = makeUniqueSlug(base + (post.date ? ` ${post.date}` : ''), used, post.id);
    });
};

// Try loading manifest as optimization (faster than Airtable, zero API usage)
const tryLoadManifest = async (): Promise<ApiResponse | null> => {
    try {
        const response = await fetch('/share-meta.json');
        if (!response.ok) return null;
        
        interface ManifestItem {
            id: string;
            slug: string;
            title: string;
            description: string;
            image: string;
            type: string;
            year?: string;
            date?: string;
        }
        
        interface Manifest {
            generatedAt: string;
            projects: ManifestItem[];
            posts: ManifestItem[];
        }
        
        const manifest: Manifest = await response.json();
        
        // Transform minimal manifest items into full Project/BlogPost objects
        // Note: Manifest only has share fields; missing gallery, credits, etc.
        // For initial render speed, this is acceptable. Full data fetched on navigation if needed.
        const projects: Project[] = manifest.projects.map((item) => ({
            id: item.id,
            slug: item.slug,
            title: item.title,
            type: (item.type as ProjectType) || 'Uncategorized',
            genre: [],
            client: '',
            brand: '',
            year: item.year || '',
            description: item.description,
            isFeatured: false,
            heroImage: item.image,
            gallery: [item.image].filter(Boolean),
            videoUrl: '',
            additionalVideos: [],
            awards: [],
            credits: [],
            externalLinks: [],
            relatedArticleId: null
        }));
        
        const posts: BlogPost[] = manifest.posts.map((item) => ({
            id: item.id,
            slug: item.slug,
            title: item.title,
            date: item.date || '',
            tags: [],
            content: item.description,
            readingTime: calculateReadingTime(item.description),
            imageUrl: item.image,
            relatedProjectId: null,
            source: 'local',
            relatedLinks: []
        }));
        
        console.log('[cmsService] Loaded from manifest (fast path)');
        
        return {
            projects,
            posts,
            config: STATIC_CONFIG // Use static config for now; could extend manifest
        };
    } catch (e) {
        console.warn('[cmsService] Manifest load failed, will fetch from Airtable');
        return null;
    }
};

export const cmsService = {
  
  fetchAll: async (): Promise<ApiResponse> => {
      // Immediate fallback if keys are missing
      if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || AIRTABLE_TOKEN.includes("PASTE_YOUR")) {
          return getSafeData();
      }
      
      if (cachedData) return cachedData;

      try {
          // OPTIMIZATION: Try loading manifest first (instant, no Airtable call)
          // Falls back to full Airtable fetch if manifest unavailable or incomplete
          const manifestData = await tryLoadManifest();
          
          const [awardsMap, clientsMap, projectsRaw, airtablePosts, instagramPosts, config] = await Promise.all([
              fetchAwardsMap(),
              fetchClientsMap(),
              fetchAirtableTable('Projects', 'Release Date'),
              fetchJournal(),
              ENABLE_INSTAGRAM_INTEGRATION ? instagramService.fetchPosts() : Promise.resolve([]),
              fetchSettings()
          ]);
          
          const projects = await processProjects(projectsRaw, awardsMap, clientsMap, config.allowedRoles);
          
          // Merge and Sort Posts (Airtable + Instagram)
          const allPosts = [...airtablePosts, ...instagramPosts].sort((a, b) => {
              // Sort descending by date
              return new Date(b.date).getTime() - new Date(a.date).getTime();
          });

          // Attach slugs to the freshly fetched items
          attachSlugs(projects, allPosts);

          const data = { projects, posts: allPosts, config };
          cachedData = data;
          return data;
      } catch (error) {
          console.error("Airtable Connection Failed. Switching to Safe Mode.", error);
          // Try manifest as final fallback
          const manifestData = await tryLoadManifest();
          if (manifestData) return manifestData;
          return getSafeData();
      }
  },

  getHomeConfig: async (): Promise<HomeConfig> => {
      const data = await cmsService.fetchAll();
      return data.config;
  },

  getProjects: async (): Promise<Project[]> => {
    const data = await cmsService.fetchAll();
    return data.projects;
  },

  getBlogPosts: async (): Promise<BlogPost[]> => {
    const data = await cmsService.fetchAll();
    return data.posts;
  }
};

// ==========================================
// AIRTABLE FETCHERS
// ==========================================

const fetchAirtableTable = async (tableName: string, sortField?: string) => {
    const sortParam = sortField ? `&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(sortField)}&sort%5B0%5D%5Bdirection%5D=desc` : '';
    let allRecords: any[] = [];
    let offset: string | null = null;
    
    // Future Proofing: Add timeout to fetch to prevent infinite hanging
    const fetchWithTimeout = async (url: string, options: any, timeout = 5000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (e) {
            clearTimeout(id);
            throw e;
        }
    };
    
    try {
        do {
            const offsetParam = offset ? `&offset=${offset}` : '';
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?${sortParam}${offsetParam}`;
            
            const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
            
            if (!res.ok) {
                // Tolerant fetch for optional tables
                if (['Awards', 'Festivals', 'Settings', 'Journal', 'Clients', 'Client Book'].includes(tableName)) return [];
                throw new Error(`Failed to fetch ${tableName}: ${res.statusText}`);
            }
            const data = await res.json();
            allRecords = [...allRecords, ...(data.records || [])]; 
            offset = data.offset; 
        } while (offset);
    } catch (e) {
        // Re-throw critical table errors to trigger safe mode
        if (tableName === 'Projects') throw e;
        console.warn(`Optional table ${tableName} failed to load.`);
        return [];
    }

    return allRecords;
};

const fetchAwardsMap = async (): Promise<Record<string, string>> => {
    try {
        let records = await fetchAirtableTable('Awards');
        if (!records || records.length === 0) records = await fetchAirtableTable('Festivals');
        const map: Record<string, string> = {};
        records.forEach((r: any) => { map[r.id] = r.fields['Name'] || r.fields['Award'] || 'Unknown Award'; });
        return map;
    } catch (e) { return {}; }
};

const fetchClientsMap = async (): Promise<Record<string, string>> => {
    try {
        let records = await fetchAirtableTable('Client Book');
        if (!records || records.length === 0) {
            records = await fetchAirtableTable('Clients');
        }
        const map: Record<string, string> = {};
        records.forEach((r: any) => { 
            map[r.id] = r.fields['Company Name'] || r.fields['Client'] || r.fields['Company'] || 'Unknown'; 
        });
        return map;
    } catch (e) { return {}; }
};

const processProjects = async (records: any[], awardsMap: Record<string, string>, clientsMap: Record<string, string>, allowedRoles: string[] = []): Promise<Project[]> => {
    try {
        const visibleRecords = records.filter((r: any) => {
            const f = r.fields;
            if (!f['Feature']) return false;
            
            if (allowedRoles && allowedRoles.length > 0) {
                const projectRoles = f['Role'] || [];
                const pRoles = Array.isArray(projectRoles) ? projectRoles : [projectRoles];
                return pRoles.some((role: string) => allowedRoles.includes(role));
            }
            return true;
        });

        const projects = await Promise.all(visibleRecords.map(async (record: any) => {
            const f = record.fields;
            
            const linkData = await parseExternalLinksData(f['External Links']);

            const rawVideoField = f['Video URL'] || '';
            const rawVideoUrls = rawVideoField.split(/[,|\n]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
            
            const allVideoUrls = await Promise.all(rawVideoUrls.map((u: string) => resolveVideoUrl(u)));
            
            const videoUrl = allVideoUrls.length > 0 ? allVideoUrls[0] : '';
            const extraVideoFieldUrls = allVideoUrls.slice(1);
            
            const galleryUrls = f['Gallery']?.map((img: any) => img.url) || [];
            
            // ASYNC THUMBNAIL FETCH
            const autoThumbnail = await fetchVideoThumbnail(videoUrl);
            const heroImage = galleryUrls.length > 0 ? galleryUrls[0] : (autoThumbnail || PLACEHOLDER_IMAGE);

            // Filter roles to only show Allowed Roles from Settings
            const allRoles = f['Role'] || [];
            const myRoles = allRoles
                .filter((r: string) => allowedRoles.length === 0 || allowedRoles.includes(r))
                .map((r: string) => ({ role: r, name: 'Gabriel Athanasiou' }));
            
            let extraCredits: {role: string, name: string}[] = [];
            const rawCreditsText = f['Credits Text'] || f['Credits'];
            if (rawCreditsText) {
                extraCredits = parseCreditsText(rawCreditsText);
            }
            
            const credits = [...myRoles, ...extraCredits];

            const rawDate = f['Release Date'] || f['Work Date'];
            const year = rawDate ? rawDate.substring(0, 4) : '';

            const rawType = f['Project Type'];
            let type = rawType || f['Kind'] || 'Uncategorized';
            
            const typeLower = type ? type.toLowerCase() : '';
            if (typeLower.includes('short') || typeLower.includes('feature') || typeLower.includes('narrative')) {
                type = 'Narrative';
            } else if (typeLower.includes('commercial') || typeLower.includes('tvc') || typeLower.includes('brand')) {
                type = 'Commercial';
            } else if (typeLower.includes('music')) {
                type = 'Music Video';
            } else if (typeLower.includes('documentary')) {
                type = 'Documentary';
            } else {
                type = 'Uncategorized';
            }
            
            const genres = f['Genre'] || [];

            let awards: string[] = [];
            if (f['Festivals']) {
                if (Array.isArray(f['Festivals'])) {
                    awards = f['Festivals'].map((id: string) => awardsMap[id] || id);
                } else if (typeof f['Festivals'] === 'string') {
                    awards = f['Festivals'].split('\n').filter((s:string) => s.trim().length > 0);
                }
            }

            let clientName = '';
            const clientField = f['Client'];
            if (Array.isArray(clientField)) {
                clientName = clientField.map((id: string) => clientsMap[id] || id).join(', ');
            } else if (clientField) {
                 clientName = clientsMap[clientField] || clientField;
            }

            const brandName = f['Brand'] || '';
            const linkedArticleId = f['Related Article']?.[0] || f['Journal']?.[0] || f['Related Project']?.[0] || null;

            return {
                id: record.id,
                title: normalizeTitle(f['Name']),
                type: type,
                genre: genres,
                client: clientName,
                brand: brandName,
                year: year,
                description: f['About'] || '',
                isFeatured: !!f['Front Page'],
                heroImage: heroImage,
                gallery: galleryUrls,
                videoUrl: videoUrl,
                additionalVideos: [...extraVideoFieldUrls, ...linkData.videos],
                awards: awards,
                credits: credits,
                externalLinks: linkData.links, 
                relatedArticleId: linkedArticleId
            };
        }));

        return projects.sort((a, b) => {
            if (!a.year) return 1;
            if (!b.year) return -1;
            return b.year.localeCompare(a.year);
        });

    } catch (e) {
        console.error("Project Processing Error", e);
        // Do not return empty array if processing fails, throw to trigger fallback
        throw e;
    }
};

const fetchJournal = async (): Promise<BlogPost[]> => {
    try {
        const records = await fetchAirtableTable('Journal', 'Date');
        const now = new Date();
        
        return records
            .filter((record: any) => {
                const f = record.fields;
                const status = f['Status'] || 'Draft'; // Default to Draft if no status
                
                // Only show Public posts, or Scheduled posts that have reached their date
                if (status === 'Public') return true;
                if (status === 'Scheduled' && f['Date']) {
                    const postDate = new Date(f['Date']);
                    return postDate <= now;
                }
                return false; // Hide Draft and future Scheduled posts
            })
            .map((record: any) => {
                const f = record.fields;
                const linkedProjectId = f['Related Project']?.[0] || f['Projects']?.[0] || null;
                
                // Parse Links
                const rawLinks = f['Links'] || f['External Links']; // tolerant check for new column
                const relatedLinks = rawLinks ? rawLinks.split(',').map((s:string) => s.trim()).filter((s:string) => s.length > 0) : [];

                return {
                    id: record.id,
                    title: f['Title'] || 'Untitled',
                    date: f['Date'] || '',
                    tags: f['Tags'] || [],
                    content: f['Content'] || '',
                    readingTime: calculateReadingTime(f['Content'] || ''),
                    imageUrl: f['Cover Image']?.[0]?.url || '',
                    relatedProjectId: linkedProjectId,
                    source: 'local',
                    relatedLinks: relatedLinks
                } as BlogPost;
            });
    } catch (e) { return []; }
};

const fetchSettings = async (): Promise<HomeConfig> => {
    try {
        const records = await fetchAirtableTable('Settings');
        if (records.length === 0) return STATIC_CONFIG; // fallback to static config if table empty
        const f = records[0].fields;
        
        // Parse Allowed Roles
        const allowedRoles = f['Allowed Roles'] 
            ? (Array.isArray(f['Allowed Roles']) ? f['Allowed Roles'] : [f['Allowed Roles']])
            : [];

        return {
            showreel: {
                enabled: !!f['Showreel Enabled'],
                videoUrl: f['Showreel URL'] || '',
                placeholderImage: f['Showreel Placeholder']?.[0]?.url || ''
            },
            contact: {
                email: f['Contact Email'] || '',
                phone: f['Contact Phone'] || '',
                repUK: f['Rep UK'] || '',
                repUSA: f['Rep USA'] || '',
                instagram: f['Instagram URL'] || '',
                vimeo: f['Vimeo URL'] || '',
                linkedin: f['LinkedIn URL'] || ''
            },
            about: {
                bio: f['Bio'] || f['Bio Text'] || STATIC_CONFIG.about!.bio,
                profileImage: f['About Image']?.[0]?.url || STATIC_CONFIG.about!.profileImage
            },
            allowedRoles: allowedRoles,
            defaultOgImage: f['Default OG Image']?.[0]?.url || ''
        };
    } catch (e) { return STATIC_CONFIG; }
};