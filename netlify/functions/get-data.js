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
    console.error('[get-data] Failed to load static data:', error);
    
    // Return empty data structure as fallback
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
        source: 'fallback'
      })
    };
  }
};