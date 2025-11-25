/**
 * Netlify Function: Generate dynamic sitemap.xml
 * Serves at: /.netlify/functions/sitemap
 * Redirect to /sitemap.xml in netlify.toml
 */

const Airtable = require('airtable');

const normalizeTitle = (title) => {
    if (!title) return 'Untitled';
    let clean = title.replace(/[_-]/g, ' ');
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
};

// Slug helpers
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

exports.handler = async function(event, context) {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    return { 
      statusCode: 500, 
      headers: { 'Content-Type': 'application/xml' },
      body: '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
    };
  }

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
  const domain = 'https://gabrielathanasiou.com'; // Update to your actual domain

  try {
    // Fetch projects
    const projectRecords = await base('Projects').select().all();
    let globalSettings = null;
    try { const settings = await base('Settings').select({ maxRecords: 1 }).firstPage(); globalSettings = settings[0]; } catch (e) {}
    
    const allowedRolesRaw = globalSettings?.get('Allowed Roles');
    const allowedRoles = allowedRolesRaw ? (Array.isArray(allowedRolesRaw) ? allowedRolesRaw : [allowedRolesRaw]) : [];

    const publishedRecords = projectRecords.filter(r => {
        if (!r.get('Feature')) return false;
        if (allowedRoles.length > 0) {
            const projectRoles = r.get('Role') || [];
            const pRoles = Array.isArray(projectRoles) ? projectRoles : [projectRoles];
            return pRoles.some(role => allowedRoles.includes(role));
        }
        return true;
    });

    // Fetch posts
    let journalRecords = [];
    try { journalRecords = await base('Journal').select({ sort: [{ field: 'Date', direction: 'desc' }] }).all(); } catch (e) {}

    // Build slug map
    const used = new Set();
    const projects = publishedRecords.map(record => {
        const rawDate = record.get('Release Date') || record.get('Work Date');
        const year = rawDate ? rawDate.substring(0, 4) : '';
        const slug = makeUniqueSlug((normalizeTitle(record.get('Name')) || record.id) + (year ? ` ${year}` : ''), used, record.id);
        return { slug, id: record.id };
    });

    const posts = journalRecords.map(record => {
        const date = record.get('Date') || '';
        const slug = makeUniqueSlug((record.get('Title') || record.id) + (date ? ` ${date}` : ''), used, record.id);
        return { slug, id: record.id };
    });

    // Generate sitemap XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    const staticPages = [
      { path: '', priority: '1.0', changefreq: 'weekly' },
      { path: '/work', priority: '0.9', changefreq: 'weekly' },
      { path: '/journal', priority: '0.8', changefreq: 'weekly' },
      { path: '/about', priority: '0.7', changefreq: 'monthly' }
    ];

    staticPages.forEach(page => {
      xml += '  <url>\n';
      xml += `    <loc>${domain}${page.path}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    });

    // Projects
    projects.forEach(project => {
      xml += '  <url>\n';
      xml += `    <loc>${domain}/work/${project.slug}</loc>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    });

    // Posts
    posts.forEach(post => {
      xml += '  <url>\n';
      xml += `    <loc>${domain}/journal/${post.slug}</loc>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.7</priority>\n';
      xml += '  </url>\n';
    });

    xml += '</urlset>';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      body: xml
    };

  } catch (error) {
    console.error('Sitemap generation error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/xml' },
      body: '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
    };
  }
};
