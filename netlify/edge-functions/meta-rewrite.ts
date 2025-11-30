// Netlify Edge Function: Dynamic Meta Tag Injection
// Intercepts /work/* and /journal/* requests to inject project/post-specific OG tags
// Uses share-meta.json manifest (generated at build time) for zero runtime Airtable calls

import type { Context } from "https://edge.netlify.com";

export const config = { path: ["/", "/work", "/work/*", "/about", "/journal", "/journal/*"] };

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

// Default fallback meta (will be enhanced from manifest if available)
// Note: DEFAULT_META.image is a placeholder - actual default comes from manifest.config.defaultOgImage
const DEFAULT_META = {
  title: "GABRIEL ATHANASIOU | Director",
  description: "Director based in London & Athens. Narrative, Commercial, Music Video.",
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
function generateStructuredData(item: any, pathname: string, canonicalUrl: string): string {
  const siteOrigin = new URL(canonicalUrl).origin;
  
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
    
    // Director information
    schema.director = {
      "@type": "Person",
      "name": "Gabriel Athanasiou",
      "jobTitle": "Director",
      "url": siteOrigin,
      "sameAs": [
        "https://twitter.com/gab_ath",
        "https://www.instagram.com/gab.ath",
        "https://www.linkedin.com/in/gabathanasiou/",
        "https://www.imdb.com/name/nm7048843/"
      ]
    };
    
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
    
    const schema: any = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": item.title,
      "description": truncate(item.content || item.description || '', 200),
      "image": item.imageUrl || item.coverImage || item.image,
      "url": canonicalUrl,
      "author": {
        "@type": "Person",
        "name": "Gabriel Athanasiou",
        "jobTitle": "Director",
        "url": siteOrigin,
        "sameAs": [
          "https://twitter.com/gab_ath",
          "https://www.instagram.com/gab.ath",
          "https://www.linkedin.com/in/gabathanasiou/",
          "https://www.imdb.com/name/nm7048843/"
        ]
      },
      "publisher": {
        "@type": "Person",
        "name": "Gabriel Athanasiou"
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
  
  // Default Person schema for homepage or other pages
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Gabriel Athanasiou",
    "url": canonicalUrl,
    "jobTitle": "Director",
    "areaServed": ["London", "Athens"],
    "sameAs": [
      "https://twitter.com/gab_ath",
      "https://www.instagram.com/gab.ath",
      "https://www.linkedin.com/in/gabathanasiou/",
      "https://www.imdb.com/name/nm7048843/"
    ]
  });
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

  // Load manifest (cached by edge runtime per instance)
  // Try share-meta.json first, fall back to portfolio-data.json if empty/unavailable
  let item: any = undefined; // Full item with all fields for structured data
  const ULTIMATE_FALLBACK = "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=1200";
  let defaultOgImage = ULTIMATE_FALLBACK;
  let portfolioData: any = null;
  
  const slug = pathname.split("/").filter(Boolean).pop() || "";
  
  // Fetch portfolio data directly from Cloudinary (primary source)
  // As per architecture: static files are hosted on Cloudinary, not locally
  const cloudinaryUrl = "https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/portfolio-data.json";
  let portfolioRes = await fetch(cloudinaryUrl);
  
  if (portfolioRes.ok) {
    portfolioData = await portfolioRes.json();
    
    // Get default OG image from config
    if (portfolioData.config?.defaultOgImage) {
      defaultOgImage = portfolioData.config.defaultOgImage;
    }
    
    if (pathname.startsWith("/work/") && portfolioData.projects) {
      item = portfolioData.projects.find((p: any) => p.slug === slug || p.id === slug);
      console.log(`[meta-rewrite] Found project: ${item ? item.title : 'NOT FOUND'} (slug: ${slug})`);
    } else if (pathname.startsWith("/journal/") && portfolioData.posts) {
      item = portfolioData.posts.find((p: any) => p.slug === slug || p.id === slug);
      console.log(`[meta-rewrite] Found post: ${item ? item.title : 'NOT FOUND'} (slug: ${slug})`);
    }
  } else {
    console.log("[meta-rewrite] Failed to load portfolio data from Cloudinary, trying share-meta.json fallback");
    
    // Fallback to share-meta.json for basic OG data
    const shareMetaUrl = new URL("/share-meta.json", url.origin);
    const shareMetaRes = await fetch(shareMetaUrl.toString());
    
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
        title: escapeHtml(`${item.title} | GABRIEL ATHANASIOU`),
        description: escapeHtml(truncate(item.description || item.content || '', 200)),
        image: escapeHtml(item.heroImage || item.imageUrl || item.image || item.coverImage || (item.gallery && item.gallery[0]) || defaultOgImage),
        type: ogType
      };
    } else if (pathname === '/work') {
      // Filmography index page
      meta = {
        title: escapeHtml("Filmography | GABRIEL ATHANASIOU"),
        description: escapeHtml("Browse my collection of narrative films, commercials, music videos, and documentaries."),
        image: defaultOgImage,
        type: "website"
      };
    } else if (pathname === '/about') {
      // About page
      const aboutBio = portfolioData?.about?.bio || "Director based in London & Athens. Narrative, Commercial, Music Video.";
      const aboutImage = portfolioData?.about?.picture || defaultOgImage;
      meta = {
        title: escapeHtml("About | GABRIEL ATHANASIOU"),
        description: escapeHtml(truncate(aboutBio, 200)),
        image: escapeHtml(aboutImage),
        type: "website"
      };
    } else if (pathname === '/journal') {
      // Journal index page
      meta = {
        title: escapeHtml("Journal | GABRIEL ATHANASIOU"),
        description: escapeHtml("Updates, behind-the-scenes insights, and reflections from my filmmaking journey."),
        image: defaultOgImage,
        type: "website"
      };
    } else {
      // Home page or other
      meta = { ...DEFAULT_META, image: defaultOgImage };
    }

    const canonicalUrl = escapeHtml(url.href);

    // Generate structured data (JSON-LD) for SEO
    const structuredData = item 
      ? generateStructuredData(item, pathname, canonicalUrl)
      : generateStructuredData(null, pathname, canonicalUrl);

    // Generate complete meta block with structured data
    let metaBlock = `
    <title>${meta.title}</title>
    <meta name="description" content="${meta.description}">
    <meta property="og:title" content="${meta.title}">
    <meta property="og:description" content="${meta.description}">
    <meta property="og:type" content="${meta.type}">
    <meta property="og:image" content="${meta.image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(meta.title)}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:site_name" content="Gabriel Athanasiou">`;
    
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
    <meta property="article:author" content="Gabriel Athanasiou">`;
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
    <meta property="video:director" content="Gabriel Athanasiou">`;
      
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
    <meta name="twitter:image" content="${meta.image}">
    <meta name="twitter:creator" content="@gabrielcine">
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
