
import React, { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
  url?: string;
}

export const SEO: React.FC<SEOProps> = ({ 
  title, 
  description = "Director based in London & Athens. Narrative, Commercial, Music Video.",
  image = "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=1200",
  type = 'website',
  url
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
    updateMeta('twitter:title', fullTitle);
    updateMeta('twitter:description', description);
    updateMeta('twitter:image', image);
    updateMeta('twitter:creator', '@gabrielcine');
    
    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      (canonical as HTMLLinkElement).rel = 'canonical';
      document.head.appendChild(canonical);
    }
    (canonical as HTMLLinkElement).href = siteUrl;

    // Schema.org structured data
    const schemaData = {
      "@context": "https://schema.org",
      "@type": type === 'article' ? "NewsArticle" : "Person",
      ...(type === 'website' && {
        name: "Gabriel Athanasiou",
        url: siteUrl,
        description: description,
        image: image,
        jobTitle: "Director",
        areaServed: ["London", "Athens"],
        sameAs: [
          "https://twitter.com/gab_ath",
          "https://www.instagram.com/gab.ath",
          "https://www.linkedin.com/in/gabathanasiou/",
          "https://www.imdb.com/name/nm7048843/"
        ]
      }),
      ...(type === 'article' && {
        headline: fullTitle,
        description: description,
        image: image,
        url: siteUrl,
      })
    };

    let schema = document.querySelector('script[type="application/ld+json"]') as HTMLScriptElement | null;
    if (!schema) {
      schema = document.createElement('script');
      (schema as HTMLScriptElement).type = 'application/ld+json';
      document.head.appendChild(schema);
    }
    (schema as HTMLScriptElement).textContent = JSON.stringify(schemaData);
    
  }, [fullTitle, description, image, type, siteUrl]);

  return null;
};
