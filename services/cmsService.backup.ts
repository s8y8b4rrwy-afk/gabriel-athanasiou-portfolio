



import { Project, BlogPost, HomeConfig } from '../types';
import { ProjectType } from '../types';
import { STATIC_PROJECTS, STATIC_POSTS, STATIC_CONFIG } from '../data/staticData';
import { instagramService } from './instagramService';
import { makeUniqueSlug } from '../utils/slugify';
import { getVideoId, resolveVideoUrl, getEmbedUrl, fetchVideoThumbnail } from '../utils/videoHelpers';
import { normalizeTitle, parseCreditsText, calculateReadingTime } from '../utils/textHelpers';

// Re-export commonly used utilities for backwards compatibility
export { getEmbedUrl, calculateReadingTime };

// ==========================================
// CONFIGURATION
// ==========================================
// Toggle this to TRUE to enable Instagram Posts in the Journal feed
const ENABLE_INSTAGRAM_INTEGRATION = false; 

// ==========================================
// 1. AIRTABLE KEYS (FROM ENV)
// ==========================================
const AIRTABLE_TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN || ""; 
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID || "";

// Note: No hardcoded placeholder image needed - components handle fallback with ProceduralThumbnail

// ==========================================
// UTILITIES
// ==========================================
// Video and text utilities are now imported from shared modules

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
            kinds: [],
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
        records.forEach((r: any) => { 
            // Prioritize Display Name if it exists, otherwise use Name or Award
            const displayName = r.fields['Display Name'] || r.fields['Short Name'] || r.fields['Name'] || r.fields['Award'] || 'Unknown Award';
            map[r.id] = displayName;
        });
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
            // Use first gallery image, or video thumbnail, or empty string (components will handle procedural fallback)
            const heroImage = galleryUrls.length > 0 ? galleryUrls[0] : (autoThumbnail || '');

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
            const rawKind = f['Kind'];
            let type = rawType || rawKind || 'Uncategorized';
            
            // Store raw kinds as array (could be single value or multiple)
            const kinds = rawKind ? (Array.isArray(rawKind) ? rawKind : [rawKind]) : [];
            
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
                kinds: kinds,
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