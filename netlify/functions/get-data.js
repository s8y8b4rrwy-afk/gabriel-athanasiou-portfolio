import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

// Get path to static data file generated at build time
const getStaticDataPath = () => {
  if (typeof import.meta.url === 'undefined') {
    return path.join(process.cwd(), 'public', 'portfolio-data.json');
  }
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, '..', '..', 'public', 'portfolio-data.json');
};

// Fetch minimal data from Airtable as emergency fallback
async function fetchAirtableFallback() {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.VITE_AIRTABLE_TOKEN || '';
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID || '';

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    console.error('[get-data] ❌ Airtable credentials not available for fallback');
    throw new Error('No Airtable credentials');
  }

  console.log('[get-data] 🔄 Attempting Airtable fallback fetch...');

  // Fetch minimal project data (just titles and slugs to show something)
  const projectsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Projects`;
  const projectsRes = await fetch(projectsUrl, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
  });

  if (!projectsRes.ok) {
    throw new Error(`Airtable fetch failed: ${projectsRes.status}`);
  }

  const projectsData = await projectsRes.json();
  const projects = (projectsData.records || []).map(rec => ({
    id: rec.id,
    title: rec.fields['Project Title'] || 'Untitled',
    slug: (rec.fields['Project Title'] || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    thumbnail: '',
    year: '',
    role: '',
    type: 'Uncategorized',
    isFeatured: false,
    isHero: false
  }));

  return {
    projects,
    posts: [],
    config: {
      showreel: { enabled: false, videoUrl: '', placeholderImage: '' },
      contact: { email: '', phone: '', repUK: '', repUSA: '', instagram: '', vimeo: '', linkedin: '' },
      about: { text: '', socialImage: '' },
      general: { allowedRoles: [] }
    },
    lastUpdated: new Date().toISOString(),
    version: '1.0',
    source: 'airtable-fallback'
  };
}

export const handler = async (event, context) => {
  try {
    console.log('[get-data] Loading static portfolio data from build');
    
    const dataPath = getStaticDataPath();
    const data = await readFile(dataPath, 'utf-8');
    
    // Serve the static JSON generated at build time
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Cache aggressively since data only updates at build time
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
      body: data
    };

  } catch (error) {
    console.error('[get-data] ⚠️ Failed to load static data:', error.message);
    
    // Try Airtable as emergency fallback
    try {
      const fallbackData = await fetchAirtableFallback();
      console.log('[get-data] ✅ Successfully fetched fallback data from Airtable');
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          // Don't cache fallback data aggressively
          'Cache-Control': 'public, max-age=300, must-revalidate'
        },
        body: JSON.stringify(fallbackData)
      };
    } catch (fallbackError) {
      console.error('[get-data] ❌ Airtable fallback also failed:', fallbackError.message);
      
      // Last resort: return empty structure
      return { 
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          projects: [],
          posts: [],
          config: {
            showreel: { enabled: false, videoUrl: '', placeholderImage: '' },
            contact: { email: '', phone: '', repUK: '', repUSA: '', instagram: '', vimeo: '', linkedin: '' },
            about: { text: '', socialImage: '' },
            general: { allowedRoles: [] }
          },
          lastUpdated: new Date().toISOString(),
          version: '1.0',
          source: 'empty-fallback'
        })
      };
    }
  }
};