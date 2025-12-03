/**
 * Netlify Function: Serve portfolio-specific sitemap.xml from Cloudinary
 * Serves at: /.netlify/functions/sitemap (redirected from /sitemap.xml)
 * 
 * This function fetches the pre-generated sitemap from Cloudinary CDN
 * based on the PORTFOLIO_MODE environment variable.
 */

const sitemapHandler = async (event, context) => {
  // Get portfolio mode from environment (set per Netlify site)
  const portfolioMode = process.env.PORTFOLIO_MODE || 'directing';
  const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || 'date24ay6';
  
  // Construct Cloudinary URL for the portfolio-specific sitemap
  const sitemapUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/raw/upload/portfolio-static/sitemap-${portfolioMode}.xml`;
  
  console.log(`[sitemap] Fetching sitemap for portfolio: ${portfolioMode}`);
  console.log(`[sitemap] URL: ${sitemapUrl}`);

  try {
    // Fetch the pre-generated sitemap from Cloudinary
    const response = await fetch(sitemapUrl);
    
    if (!response.ok) {
      console.error(`[sitemap] Failed to fetch from Cloudinary: ${response.status}`);
      throw new Error(`Cloudinary fetch failed: ${response.status}`);
    }
    
    const sitemapXml = await response.text();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Netlify-CDN-Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400'
      },
      body: sitemapXml
    };

  } catch (error) {
    console.error('[sitemap] Error fetching sitemap:', error);
    
    // Return minimal sitemap on error
    const fallbackDomain = portfolioMode === 'postproduction' 
      ? 'https://lemonpost.studio' 
      : 'https://directedbygabriel.com';
    
    return {
      statusCode: 200, // Return 200 even on error to avoid SEO penalties
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300'
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${fallbackDomain}/</loc>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${fallbackDomain}/work</loc>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${fallbackDomain}/about</loc>
    <priority>0.7</priority>
  </url>
</urlset>`
    };
  }
};

export const handler = sitemapHandler;
