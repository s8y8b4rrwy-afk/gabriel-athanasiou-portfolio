// Netlify Edge Function: Dynamic Meta Tag Injection
// Intercepts /work/* and /journal/* requests to inject project/post-specific OG tags
// Uses share-meta.json manifest (generated at build time) for zero runtime Airtable calls

import type { Context } from "https://edge.netlify.com";

export const config = { path: ["/", "/work", "/work/*", "/about", "/journal", "/journal/*", "/game"] };

interface ShareItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  type: string;
  year?: string;
  date?: string;
}

interface ShareManifest {
  generatedAt: string;
  projects: ShareItem[];
  posts: ShareItem[];
}

// Default fallback meta (will be enhanced from portfolio config)
// Note: These are overridden by portfolio-specific config at runtime
const DEFAULT_META = {
  title: "Portfolio",
  description: "Creative portfolio",
  image: "", // Populated from manifest.config.defaultOgImage or ultimate fallback
  type: "website"
};

interface ManifestConfig {
  defaultOgImage?: string;
}

// Escape HTML special chars for safe meta injection
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\r?\n/g, " "); // Remove newlines
}

// Truncate description to safe length for meta tags
function truncate(text: string, maxLength: number = 200): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? clean.slice(0, maxLength) + "..." : clean;
}

// Generate structured data (JSON-LD) for SEO
function generateStructuredData(item: any, pathname: string, canonicalUrl: string, portfolioConfig?: any): string {
  const siteOrigin = new URL(canonicalUrl).origin;
  
  // Get portfolio-specific owner info
  const ownerName = portfolioConfig?.navTitle || portfolioConfig?.siteTitle || "Portfolio Owner";
  const jobTitle = portfolioConfig?.portfolioId === 'postproduction' ? "Colorist & Editor" : "Director";
  const socialLinks = portfolioConfig?.portfolioId === 'postproduction' 
    ? [] // Post-production portfolio may have different/no social links
    : [
        "https://twitter.com/gab_ath",
        "https://www.instagram.com/gab.ath",
        "https://www.linkedin.com/in/gabathanasiou/",
        "https://www.imdb.com/name/nm7048843/"
      ];
  
  if (pathname.startsWith("/work/")) {
    // Project: Movie or VideoObject schema
    const isNarrative = item.type === 'Narrative';
    const isCommercial = item.type === 'Commercial';
    
    // Use most accurate date available (portfolio-data.json has releaseDate, workDate, year)
    const dateString = item.releaseDate || item.workDate || (item.year ? `${item.year}-01-01` : null);
    const isoDate = dateString ? (dateString.includes('T') ? dateString : `${dateString}T00:00:00Z`) : undefined;
    
    const schema: any = {
      "@context": "https://schema.org",
      "@type": isNarrative ? "Movie" : "VideoObject",
      "name": item.title,
      "description": item.description,
      "thumbnailUrl": item.heroImage || item.image,
      "image": item.heroImage || item.image,
      "url": canonicalUrl,
    };
    
    if (isoDate) {
      schema.dateCreated = isoDate;
      schema.uploadDate = isoDate;
    }
    
    // Creator/Director information based on portfolio type
    if (portfolioConfig?.portfolioId === 'postproduction') {
      // For post-production, list as creator/contributor
      schema.contributor = {
        "@type": "Person",
        "name": ownerName,
        "jobTitle": jobTitle,
        "url": siteOrigin
      };
      if (socialLinks.length > 0) {
        schema.contributor.sameAs = socialLinks;
      }
    } else {
      // For directing portfolio, list as director
      schema.director = {
        "@type": "Person",
        "name": ownerName,
        "jobTitle": jobTitle,
        "url": siteOrigin
      };
      if (socialLinks.length > 0) {
        schema.director.sameAs = socialLinks;
      }
    }
    
    // Credits
    if (item.credits && item.credits.length > 0) {
      schema.credits = item.credits.map((credit: any) => ({
        "@type": "Role",
        "roleName": credit.role,
        "name": credit.name
      }));
    }
    
    // Production company
    if (item.productionCompany) {
      schema.productionCompany = {
        "@type": "Organization",
        "name": item.productionCompany
      };
    }
    
    // Client/sponsor for commercials
    if (isCommercial && item.client) {
      schema.sponsor = {
        "@type": "Organization",
        "name": item.client
      };
    }
    
    // Genre
    if (item.genre && item.genre.length > 0) {
      schema.genre = item.genre;
    }
    
    // Awards
    if (item.awards && item.awards.length > 0) {
      schema.award = item.awards;
    }
    
    // Video content
    if (item.videoUrl) {
      schema.contentUrl = item.videoUrl;
      schema.embedUrl = item.videoUrl;
    }
    
    // Gallery images
    if (item.gallery && item.gallery.length > 0) {
      schema.thumbnail = item.gallery.map((img: string) => ({
        "@type": "ImageObject",
        "url": img
      }));
    }
    
    return JSON.stringify(schema);
    
  } else if (pathname.startsWith("/journal/")) {
    // Blog Post: Article schema
    const publishDate = item.date 
      ? (item.date.includes('T') ? item.date : `${item.date}T00:00:00Z`)
      : undefined;
    
    const authorSchema: any = {
      "@type": "Person",
      "name": ownerName,
      "jobTitle": jobTitle,
      "url": siteOrigin
    };
    if (socialLinks.length > 0) {
      authorSchema.sameAs = socialLinks;
    }
    
    const schema: any = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": item.title,
      "description": truncate(item.content || item.description || '', 200),
      "image": item.imageUrl || item.coverImage || item.image,
      "url": canonicalUrl,
      "author": authorSchema,
      "publisher": {
        "@type": "Person",
        "name": ownerName
      }
    };
    
    if (publishDate) {
      schema.datePublished = publishDate;
    }
    
    if (item.tags && item.tags.length > 0) {
      schema.keywords = item.tags.join(', ');
    }
    
    return JSON.stringify(schema);
  }
  
  // Default Person/Organization schema for homepage or other pages
  const personSchema: any = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": ownerName,
    "url": canonicalUrl,
    "jobTitle": jobTitle
  };
  
  if (portfolioConfig?.portfolioId === 'postproduction') {
    personSchema.areaServed = portfolioConfig?.location || [];
  } else {
    personSchema.areaServed = ["London", "Athens"];
  }
  
  if (socialLinks.length > 0) {
    personSchema.sameAs = socialLinks;
  }
  
  return JSON.stringify(personSchema);
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Process all main routes for OG tags
  const shouldProcess = 
    pathname === '/' ||
    pathname === '/work' ||
    pathname === '/about' ||
    pathname === '/journal' ||
    pathname === '/game' ||
    pathname.startsWith('/work/') ||
    pathname.startsWith('/journal/');

  if (!shouldProcess) {
    return; // Pass through to next handler
  }

  console.log(`[meta-rewrite] Processing: ${pathname}`);

  try {
    // Fetch the original index.html from the published site
    const response = await context.next();
    let html = await response.text();

  // Load manifest from Cloudinary (primary source of truth)
  // portfolio-data.json has complete data, share-meta.json is lightweight fallback
  let item: any = undefined; // Full item with all fields for structured data
  const ULTIMATE_FALLBACK = "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=1200";
  let defaultOgImage = ULTIMATE_FALLBACK;
  let portfolioData: any = null;
  
  // Portfolio-specific branding (will be populated from config)
  let siteName = "Portfolio";
  let siteTitle = "Portfolio";
  let siteDescription = "Creative portfolio";
  let ownerName = "";
  let twitterHandle = "";
  
  const slug = pathname.split("/").filter(Boolean).pop() || "";
  
  // Get portfolio mode from environment (set per Netlify site)
  const portfolioMode = Deno.env.get("PORTFOLIO_MODE") || "directing";
  
  // Fetch portfolio data directly from Cloudinary (primary source)
  // As per architecture: static files are hosted on Cloudinary, not locally
  // Each portfolio has its own data file: portfolio-data-directing.json or portfolio-data-postproduction.json
  const cloudinaryUrl = `https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/portfolio-data-${portfolioMode}.json`;
  console.log(`[meta-rewrite] Fetching from: ${cloudinaryUrl}`);
  let portfolioRes = await fetch(cloudinaryUrl);
  
  if (portfolioRes.ok) {
    portfolioData = await portfolioRes.json();
    
    // Get portfolio-specific config for OG tags
    const config = portfolioData.config || {};
    siteName = config.navTitle || config.siteTitle || siteName;
    siteTitle = config.seoTitle || `${siteName} | ${config.portfolioId === 'postproduction' ? 'Post-Production' : 'Director'}`;
    siteDescription = config.seoDescription || siteDescription;
    ownerName = config.navTitle || siteName;
    twitterHandle = config.twitterHandle || (config.portfolioId === 'postproduction' ? '' : '@gabrielcine');
    
    // Get default OG image from config
    if (config.defaultOgImage) {
      defaultOgImage = config.defaultOgImage;
    }
    
    if (pathname.startsWith("/work/") && portfolioData.projects) {
      item = portfolioData.projects.find((p: any) => p.slug === slug || p.id === slug);
      console.log(`[meta-rewrite] Found project: ${item ? item.title : 'NOT FOUND'} (slug: ${slug})`);
    } else if (pathname.startsWith("/journal/") && portfolioData.posts) {
      item = portfolioData.posts.find((p: any) => p.slug === slug || p.id === slug);
      console.log(`[meta-rewrite] Found post: ${item ? item.title : 'NOT FOUND'} (slug: ${slug})`);
    }
  } else {
    console.log("[meta-rewrite] Failed to load portfolio data from Cloudinary, trying share-meta fallback");
    
    // Fallback to portfolio-specific share-meta.json from Cloudinary
    const shareMetaCloudinaryUrl = `https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/share-meta-${portfolioMode}.json`;
    let shareMetaRes = await fetch(shareMetaCloudinaryUrl);
    
    // If Cloudinary fails, try local fallback
    if (!shareMetaRes.ok) {
      const shareMetaUrl = new URL("/share-meta.json", url.origin);
      shareMetaRes = await fetch(shareMetaUrl.toString());
    }
    
    if (shareMetaRes.ok) {
      const shareMeta: ShareManifest = await shareMetaRes.json();
      
      if (pathname.startsWith("/work/") && shareMeta.projects) {
        item = shareMeta.projects.find((p: any) => p.slug === slug || p.id === slug);
        console.log(`[meta-rewrite] Found project in share-meta: ${item ? item.title : 'NOT FOUND'} (slug: ${slug})`);
      } else if (pathname.startsWith("/journal/") && shareMeta.posts) {
        item = shareMeta.posts.find((p: any) => p.slug === slug || p.id === slug);
        console.log(`[meta-rewrite] Found post in share-meta: ${item ? item.title : 'NOT FOUND'} (slug: ${slug})`);
      }
    } else {
      console.log("[meta-rewrite] Failed to load share-meta.json");
    }
  }    // Build meta tags based on page type
    let meta;
    
    if (item) {
      // Individual project or post
      let ogType = "website";
      if (pathname.startsWith("/journal/")) {
        ogType = "article";
      } else if (pathname.startsWith("/work/")) {
        // Differentiate between narrative films and other video content
        const projectType = (item as any).type || '';
        ogType = projectType === 'Narrative' ? "video.movie" : "video.other";
      }
      
      meta = {
        title: escapeHtml(`${item.title} | ${siteName}`),
        description: escapeHtml(truncate(item.description || item.content || '', 200)),
        image: escapeHtml(item.heroImage || item.imageUrl || item.image || item.coverImage || (item.gallery && item.gallery[0]) || defaultOgImage),
        type: ogType
      };
    } else if (pathname === '/work') {
      // Work index page - use portfolio-specific label
      const workLabel = portfolioData?.config?.workSectionLabel || 'Work';
      meta = {
        title: escapeHtml(`${workLabel} | ${siteName}`),
        description: escapeHtml(portfolioData?.config?.portfolioId === 'postproduction' 
          ? "Professional color grading, editing, and post-production services."
          : "Browse my collection of narrative films, commercials, music videos, and documentaries."),
        image: defaultOgImage,
        type: "website"
      };
    } else if (pathname === '/about') {
      // About page
      const aboutBio = portfolioData?.about?.bio || siteDescription;
      const aboutImage = portfolioData?.about?.picture || defaultOgImage;
      meta = {
        title: escapeHtml(`About | ${siteName}`),
        description: escapeHtml(truncate(aboutBio, 200)),
        image: escapeHtml(aboutImage),
        type: "website"
      };
    } else if (pathname === '/journal') {
      // Journal index page (only on directing portfolio)
      meta = {
        title: escapeHtml(`Journal | ${siteName}`),
        description: escapeHtml("Updates, behind-the-scenes insights, and reflections from my filmmaking journey."),
        image: defaultOgImage,
        type: "website"
      };
    } else if (pathname === '/game') {
      // Game page
      meta = {
        title: escapeHtml(`Game | ${siteName}`),
        description: escapeHtml(`Test your knowledge of ${ownerName}'s work in this interactive trivia game. Can you guess the project from a single frame?`),
        image: "https://res.cloudinary.com/date24ay6/image/upload/v1764713493/Screenshot_2025-12-02_at_22.11.07_lwxwlh.jpg",
        type: "website"
      };
    } else {
      // Home page or other - use portfolio-specific defaults
      meta = {
        title: escapeHtml(siteTitle),
        description: escapeHtml(siteDescription),
        image: defaultOgImage,
        type: "website"
      };
    }

    const canonicalUrl = escapeHtml(url.href);

    // Generate structured data (JSON-LD) for SEO - pass portfolio config for proper branding
    const portfolioConfig = portfolioData?.config;
    const structuredData = item 
      ? generateStructuredData(item, pathname, canonicalUrl, portfolioConfig)
      : generateStructuredData(null, pathname, canonicalUrl, portfolioConfig);

    // Generate complete meta block with structured data
    let metaBlock = `
    <title>${meta.title}</title>
    <meta name="description" content="${meta.description}">
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
    <meta property="og:title" content="${meta.title}">
    <meta property="og:description" content="${meta.description}">
    <meta property="og:type" content="${meta.type}">
    <meta property="og:image" content="${meta.image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(meta.title)}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:site_name" content="${escapeHtml(siteName)}">`;
    
    // Add type-specific OpenGraph tags
    if (meta.type === 'article' && item) {
      // Article-specific tags
      const publishDate = (item as any).date || '';
      if (publishDate) {
        const isoDate = publishDate.includes('T') ? publishDate : `${publishDate}T00:00:00Z`;
        metaBlock += `
    <meta property="article:published_time" content="${escapeHtml(isoDate)}">`;
      }
      metaBlock += `
    <meta property="article:author" content="${escapeHtml(ownerName)}">`;
      if ((item as any).tags && (item as any).tags.length > 0) {
        (item as any).tags.forEach((tag: string) => {
          metaBlock += `
    <meta property="article:tag" content="${escapeHtml(tag)}">`;
        });
      }
    } else if ((meta.type === 'video.movie' || meta.type === 'video.other') && item) {
      // Video-specific tags
      const releaseYear = (item as any).year || '';
      if (releaseYear) {
        metaBlock += `
    <meta property="video:release_date" content="${escapeHtml(releaseYear)}-01-01">`;
      }
      metaBlock += `
    <meta property="video:director" content="${escapeHtml(ownerName)}">`;
      
      // Add video URL if available
      if ((item as any).videoUrl) {
        metaBlock += `
    <meta property="og:video" content="${escapeHtml((item as any).videoUrl)}">`;
      }
      
      // Add video tags (project type)
      const projectType = (item as any).type || '';
      if (projectType) {
        metaBlock += `
    <meta property="video:tag" content="${escapeHtml(projectType)}">`;
      }
    }
    
    // Continue with Twitter and other meta tags
    metaBlock += `
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${meta.title}">
    <meta name="twitter:description" content="${meta.description}">
    <meta name="twitter:image" content="${meta.image}">${twitterHandle ? `
    <meta name="twitter:creator" content="${escapeHtml(twitterHandle)}">` : ''}
    <link rel="canonical" href="${canonicalUrl}">
    <script type="application/ld+json">${structuredData}</script>`;

    // Replace existing meta section (from <title> through last twitter meta before </head>)
    // Strategy: Replace from first <title> to just before </head>, preserving other head content
    html = html.replace(
      /<title>[\s\S]*?<link rel="canonical"[^>]*>/i,
      metaBlock
    );

    // Return modified HTML with cache headers
    return new Response(html, {
      status: response.status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300, stale-while-revalidate=600", // 5min cache, 10min stale
        "x-edge-meta-injected": "true" // Debug header
      }
    });
  } catch (error) {
    // On error, pass through original response
    console.error("[meta-rewrite] Error:", error);
    return context.next();
  }
};
