import { cmsService } from '../services/cmsService';

/**
 * Generates a dynamic sitemap.xml based on current projects and posts from Airtable
 * This should be called on the server side or during build time
 */
export const generateSitemap = async (): Promise<string> => {
  try {
    const { projects, posts } = await cmsService.fetchAll();
    
    const baseUrl = 'https://gabrielathanasiou.com';
    const currentDate = new Date().toISOString().split('T')[0];

    // Start XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Home page
    xml += `  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>\n`;

    // Main pages
    xml += `  <url>
    <loc>${baseUrl}/work</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>\n`;

    xml += `  <url>
    <loc>${baseUrl}/journal</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>\n`;

    xml += `  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.7</priority>
  </url>\n`;

    // Projects
    projects.forEach((project) => {
      const projectUrl = `${baseUrl}/work/${project.slug || project.id}`;
      const lastmod = project.year || currentDate;
      
      xml += `  <url>
    <loc>${projectUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
    });

    // Blog posts
    posts.forEach((post) => {
      const postUrl = `${baseUrl}/journal/${post.slug || post.id}`;
      const lastmod = post.date || currentDate;
      
      xml += `  <url>
    <loc>${postUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
    });

    // Close XML
    xml += '</urlset>';

    return xml;
  } catch (error) {
    console.error('Failed to generate sitemap:', error);
    // Return a minimal fallback sitemap
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://gabrielathanasiou.com/</loc>
    <priority>1.0</priority>
  </url>
</urlset>`;
  }
};
