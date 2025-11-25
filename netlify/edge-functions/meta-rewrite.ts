// Netlify Edge Function: Dynamic Meta Tag Injection
// Intercepts /work/* and /journal/* requests to inject project/post-specific OG tags
// Uses share-meta.json manifest (generated at build time) for zero runtime Airtable calls

import type { Context } from "https://edge.netlify.com";

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
const DEFAULT_META = {
  title: "GABRIEL ATHANASIOU | Director",
  description: "Director based in London & Athens. Narrative, Commercial, Music Video.",
  image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=1200",
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

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Only process share-relevant routes
  if (!pathname.startsWith("/work/") && !pathname.startsWith("/journal/")) {
    return; // Pass through to next handler
  }

  try {
    // Fetch the original index.html from the published site
    const response = await context.next();
    let html = await response.text();

    // Load manifest (cached by edge runtime per instance)
    const manifestUrl = new URL("/share-meta.json", url.origin);
    const manifestRes = await fetch(manifestUrl.toString());
    
    let item: ShareItem | undefined;
    let defaultOgImage = DEFAULT_META.image;
    
    if (manifestRes.ok) {
      const manifest: ShareManifest & { config?: ManifestConfig } = await manifestRes.json();
      
      // Use custom default OG image from Settings if available
      if (manifest.config?.defaultOgImage) {
        defaultOgImage = manifest.config.defaultOgImage;
      }
      
      // Extract slug from path (e.g., /work/example-slug -> example-slug)
      const slug = pathname.split("/").filter(Boolean).pop() || "";
      
      if (pathname.startsWith("/work/")) {
        item = manifest.projects.find((p) => p.slug === slug || p.id === slug);
      } else if (pathname.startsWith("/journal/")) {
        item = manifest.posts.find((p) => p.slug === slug || p.id === slug);
      }
    }

    // Build meta tags
    const meta = item
      ? {
          title: escapeHtml(`${item.title} | GABRIEL ATHANASIOU`),
          description: escapeHtml(truncate(item.description, 200)),
          image: escapeHtml(item.image || defaultOgImage),
          type: item.type === "article" ? "article" : "website"
        }
      : { ...DEFAULT_META, image: defaultOgImage };

    const canonicalUrl = escapeHtml(url.href);

    // Generate complete meta block
    const metaBlock = `
    <title>${meta.title}</title>
    <meta name="description" content="${meta.description}">
    <meta property="og:title" content="${meta.title}">
    <meta property="og:description" content="${meta.description}">
    <meta property="og:type" content="${meta.type}">
    <meta property="og:image" content="${meta.image}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${meta.title}">
    <meta name="twitter:description" content="${meta.description}">
    <meta name="twitter:image" content="${meta.image}">
    <meta name="twitter:creator" content="@gabrielcine">
    <link rel="canonical" href="${canonicalUrl}">`;

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
