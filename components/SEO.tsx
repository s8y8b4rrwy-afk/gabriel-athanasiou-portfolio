
import React, { useEffect } from 'react';
import { Project, BlogPost, HomeConfig } from '../types';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article' | 'video.movie' | 'video.other';
  url?: string;
  project?: Project; // Enhanced: Pass full project data for rich schema
  post?: BlogPost; // Enhanced: Pass full post data for article schema
  defaultOgImage?: string; // Custom default OG image from Airtable Settings
  config?: HomeConfig; // Portfolio config for SEO defaults
}

// Ultimate fallback image (used if Airtable Settings defaultOgImage is not configured)
const ULTIMATE_FALLBACK_OG_IMAGE = "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=1200";

export const SEO: React.FC<SEOProps> = ({ 
  title, 
  description,
  image,
  type = 'website',
  url,
  project,
  post,
  defaultOgImage,
  config
}) => {
  // Get portfolio-specific defaults from config
  const defaultSiteTitle = config?.siteTitle || config?.navTitle || 'GABRIEL ATHANASIOU';
  const defaultSeoTitle = config?.seoTitle || `${defaultSiteTitle} | Director`;
  const defaultDescription = description || config?.seoDescription || "Director based in London & Athens. Narrative, Commercial, Music Video.";
  const domain = config?.domain || '';
  
  // Use provided image, or fallback to config default, or ultimate fallback
  const ogImage = image || defaultOgImage || config?.defaultOgImage || ULTIMATE_FALLBACK_OG_IMAGE;
  
  const fullTitle = title ? `${title} | ${defaultSiteTitle}` : defaultSeoTitle;
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
    updateMeta('description', defaultDescription);
    updateMeta('og:title', fullTitle, 'property');
    updateMeta('og:description', defaultDescription, 'property');
    updateMeta('og:image', ogImage, 'property');
    updateMeta('og:type', type, 'property');
    updateMeta('og:url', siteUrl, 'property');
    updateMeta('twitter:card', 'summary_large_image');
    updateMeta('twitter:title', fullTitle);
    updateMeta('twitter:description', defaultDescription);
    updateMeta('twitter:image', ogImage);
    updateMeta('twitter:creator', '@gabrielcine');
    
    // Enhanced: Add video-specific Open Graph tags if project has video
    if (project?.videoUrl) {
      updateMeta('og:video', project.videoUrl, 'property');
      updateMeta('og:video:type', 'text/html', 'property');
    }
    
    // Canonical URL - use domain from config if available
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      (canonical as HTMLLinkElement).rel = 'canonical';
      document.head.appendChild(canonical);
    }
    (canonical as HTMLLinkElement).href = siteUrl;

    // NOTE: Structured data (JSON-LD) is now injected server-side by the Netlify Edge Function
    // (netlify/edge-functions/meta-rewrite.ts) for better SEO and crawler compatibility.
    // This ensures search engines see the structured data immediately without waiting for
    // client-side JavaScript execution.
    
  }, [fullTitle, defaultDescription, ogImage, type, siteUrl, project]);

  return null;
};
