
import React, { useEffect } from 'react';
import { Project, BlogPost } from '../types';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article' | 'video.movie' | 'video.other';
  url?: string;
  project?: Project; // Enhanced: Pass full project data for rich schema
  post?: BlogPost; // Enhanced: Pass full post data for article schema
}

// Default fallback image (can be overridden by Airtable Settings > Default OG Image)
const FALLBACK_OG_IMAGE = "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=1200";

export const SEO: React.FC<SEOProps> = ({ 
  title, 
  description = "Director based in London & Athens. Narrative, Commercial, Music Video.",
  image = FALLBACK_OG_IMAGE,
  type = 'website',
  url,
  project,
  post
}) => {
  
  const fullTitle = title ? `${title} | GABRIEL ATHANASIOU` : "GABRIEL ATHANASIOU | Director";
  const siteUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  useEffect(() => {
    // Update Title
    document.title = fullTitle;

    // Helper to update meta tags
    const updateMeta = (name: string, content: string, attribute = 'name') => {
      let element = document.querySelector(`meta[${attribute}="${name}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Standard meta tags
    updateMeta('description', description);
    updateMeta('og:title', fullTitle, 'property');
    updateMeta('og:description', description, 'property');
    updateMeta('og:image', image, 'property');
    updateMeta('og:type', type, 'property');
    updateMeta('og:url', siteUrl, 'property');
    updateMeta('twitter:card', 'summary_large_image');
    updateMeta('twitter:title', fullTitle);
    updateMeta('twitter:description', description);
    updateMeta('twitter:image', image);
    updateMeta('twitter:creator', '@gabrielcine');
    
    // Enhanced: Add video-specific Open Graph tags if project has video
    if (project?.videoUrl) {
      updateMeta('og:video', project.videoUrl, 'property');
      updateMeta('og:video:type', 'text/html', 'property');
    }
    
    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      (canonical as HTMLLinkElement).rel = 'canonical';
      document.head.appendChild(canonical);
    }
    (canonical as HTMLLinkElement).href = siteUrl;

    // Enhanced Schema.org structured data
    let schemaData: any;

    if (project) {
      // ENHANCED: Rich Movie/CreativeWork schema for projects
      const isNarrative = project.type === 'Narrative';
      const isCommercial = project.type === 'Commercial';
      
      schemaData = {
        "@context": "https://schema.org",
        "@type": isNarrative ? "Movie" : "VideoObject",
        "name": project.title,
        "description": project.description,
        "image": image, // Use optimized image URL passed as prop
        "url": siteUrl,
        ...(project.year && { "dateCreated": `${project.year}-01-01` }),
        
        // Director information
        "director": {
          "@type": "Person",
          "name": "Gabriel Athanasiou",
          "jobTitle": "Director",
          "url": typeof window !== 'undefined' ? window.location.origin : '',
          "sameAs": [
            "https://twitter.com/gab_ath",
            "https://www.instagram.com/gab.ath",
            "https://www.linkedin.com/in/gabathanasiou/",
            "https://www.imdb.com/name/nm7048843/"
          ]
        },
        
        // Credits as cast/crew
        ...(project.credits && project.credits.length > 0 && {
          "credits": project.credits.map(credit => ({
            "@type": "Role",
            "roleName": credit.role,
            "name": credit.name
          }))
        }),
        
        // Production company
        ...(project.productionCompany && {
          "productionCompany": {
            "@type": "Organization",
            "name": project.productionCompany
          }
        }),
        
        // Client/brand for commercials
        ...(isCommercial && project.client && {
          "sponsor": {
            "@type": "Organization",
            "name": project.client
          }
        }),
        
        // Genre
        ...(project.genre && project.genre.length > 0 && {
          "genre": project.genre
        }),
        
        // Awards
        ...(project.awards && project.awards.length > 0 && {
          "award": project.awards
        }),
        
        // Video content
        ...(project.videoUrl && {
          "contentUrl": project.videoUrl,
          "embedUrl": project.videoUrl,
          "uploadDate": project.year ? `${project.year}-01-01` : undefined
        }),
        
        // Gallery images
        ...(project.gallery && project.gallery.length > 0 && {
          "thumbnail": project.gallery.map(img => ({
            "@type": "ImageObject",
            "url": img
          }))
        })
      };
    } else if (post) {
      // ENHANCED: Rich Article schema for blog posts
      schemaData = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": post.title,
        "description": post.content.substring(0, 200),
        "image": post.imageUrl || image,
        "datePublished": post.date,
        "author": {
          "@type": "Person",
          "name": "Gabriel Athanasiou",
          "jobTitle": "Director",
          "url": typeof window !== 'undefined' ? window.location.origin : '',
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
        },
        "url": siteUrl,
        ...(post.tags && post.tags.length > 0 && {
          "keywords": post.tags.join(', ')
        })
      };
    } else if (type === 'article') {
      // Basic article schema
      schemaData = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": fullTitle,
        "description": description,
        "image": image,
        "url": siteUrl,
      };
    } else {
      // Default Person schema for homepage
      schemaData = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "Gabriel Athanasiou",
        "url": siteUrl,
        "description": description,
        "image": image,
        "jobTitle": "Director",
        "areaServed": ["London", "Athens"],
        "sameAs": [
          "https://twitter.com/gab_ath",
          "https://www.instagram.com/gab.ath",
          "https://www.linkedin.com/in/gabathanasiou/",
          "https://www.imdb.com/name/nm7048843/"
        ]
      };
    }

    let schema = document.querySelector('script[type="application/ld+json"]') as HTMLScriptElement | null;
    if (!schema) {
      schema = document.createElement('script');
      (schema as HTMLScriptElement).type = 'application/ld+json';
      document.head.appendChild(schema);
    }
    (schema as HTMLScriptElement).textContent = JSON.stringify(schemaData);
    
  }, [fullTitle, description, image, type, siteUrl, project, post]);

  return null;
};
