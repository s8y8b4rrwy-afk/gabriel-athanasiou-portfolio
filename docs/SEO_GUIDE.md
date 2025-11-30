# SEO Implementation Guide

## Overview

Your portfolio now includes comprehensive SEO (Search Engine Optimization) to help Google and other search engines properly index and display your narrative projects, commercials, and blog posts.

## What Google Now Receives

### For Every Narrative Project

When Google crawls a narrative project page (e.g., `/work/eternal-return-2024`), it receives:

#### 1. **Meta Tags** (Social Sharing)
- Page title: `{Project Title} | GABRIEL ATHANASIOU`
- Description: Project synopsis from Airtable
- Open Graph image: Hero image (first gallery image)
- Video URL: Main video link for rich previews
- Twitter Card: Large image with summary

#### 2. **Schema.org Structured Data** (Rich Snippets)

Google receives a **Movie** schema for narrative projects containing:

```json
{
  "@type": "Movie",
  "name": "Project Title",
  "description": "Full project description",
  "dateCreated": "2024-01-01",
  "director": {
    "@type": "Person",
    "name": "Gabriel Athanasiou",
    "jobTitle": "Director",
    "sameAs": ["IMDb", "Instagram", "LinkedIn", "Twitter"]
  },
  "credits": [
    { "roleName": "Director", "name": "Gabriel Athanasiou" },
    { "roleName": "Cinematographer", "name": "..." }
  ],
  "productionCompany": {
    "@type": "Organization",
    "name": "Production Company Name"
  },
  "genre": ["Drama", "Sci-Fi"],
  "award": ["Best Film - Festival 2024"],
  "contentUrl": "Vimeo/YouTube URL",
  "thumbnail": [{"url": "image1.jpg"}, {"url": "image2.jpg"}]
}
```

#### 3. **VideoObject Schema** (for Commercials)

Non-narrative projects get **VideoObject** schema with:
- Brand/sponsor information
- Production company
- All the same metadata

### For Blog Posts

Blog posts receive **Article** schema:
- Headline, description, publish date
- Author information with social profiles
- Keywords from tags
- Cover image

## What This Means

### ✅ Google Can Now:

1. **Display Rich Results** in search:
   - Film title, year, director
   - Star ratings from awards
   - Video thumbnails
   - "Watch on Vimeo/YouTube" buttons

2. **Knowledge Graph Integration**:
   - Links your work to your IMDb profile
   - Shows filmography
   - Displays awards and festivals

3. **Understand Relationships**:
   - You as director → Your films
   - Films → Production companies
   - Films → Awards/Festivals
   - Blog posts ↔ Related projects

4. **Index Video Content**:
   - Video thumbnails appear in Google Images
   - Videos may appear in Google Video search
   - YouTube/Vimeo embeds are recognized

## Airtable Fields Used for SEO

### Required for Good SEO:
- ✅ **Name/Title** - Project name
- ✅ **About** - Project description (used in search results)
- ✅ **Gallery** - Images (first = hero image for social sharing)
- ✅ **Year/Release Date** - For chronological indexing
- ✅ **Project Type** - Helps categorization (Narrative/Commercial/etc)

### Settings Table (Site-wide Configuration):
- ✅ **Default OG Image** - Fallback image for social media previews when project/post has no images
  - Recommended size: 1200x630px
  - Used for homepage, about page, and any content without specific images
  - Uploaded to Cloudinary during sync for CDN performance
  - Ultimate fallback: Unsplash placeholder (only if this field is empty)

### Highly Recommended:
- 🌟 **Video URL** - Enables video rich snippets
- 🌟 **Credits** - Shows team, helps authority
- 🌟 **Awards/Festivals** - Shows credibility in search results
- 🌟 **Client/Production Company** - Professional context
- 🌟 **Genre** - Helps with category searches

### Optional But Helpful:
- **Brand** (for commercials) - Shows client work
- **Kind** - Additional categorization
- **External Links** - IMDb, press coverage, etc.

## Sitemap Configuration

All projects are included in `sitemap.xml` with:
- **Narrative projects**: Priority 0.9 (highest)
- **Featured projects**: Priority 0.8
- **Other projects**: Priority 0.7

Sitemap is automatically generated during build and located at:
`https://directedbygabriel.com/sitemap.xml`

## Robots.txt

Configured to allow all search engines with special permissions for:
- Google
- Facebook
- Twitter/X
- LinkedIn

Location: `https://directedbygabriel.com/robots.txt`

## How to Verify SEO

### 1. Google Search Console
- Add your site: https://search.google.com/search-console
- Submit sitemap: `https://directedbygabriel.com/sitemap.xml`
- Monitor indexing status

### 2. Rich Results Test
Test any project page:
https://search.google.com/test/rich-results

Paste URL like: `https://directedbygabriel.com/work/your-project-2024`

### 3. Schema Validator
https://validator.schema.org/

Should show:
- ✅ Movie schema detected
- ✅ Person (Director) schema
- ✅ All fields populated

### 4. Social Preview
Test how links appear on social media:
- **Facebook**: https://developers.facebook.com/tools/debug/
- **Twitter**: https://cards-dev.twitter.com/validator
- **LinkedIn**: Just paste URL in LinkedIn post composer

## Best Practices

### To Maximize SEO:

1. **Complete All Fields in Airtable**
   - Don't leave "About" empty
   - Add year to all projects
   - Include production company
   - List all credits

2. **Use Descriptive Titles**
   - "The Last Dance" ✅
   - "Untitled Project" ❌

3. **Write Good Descriptions**
   - 150-300 characters ideal
   - Include genre, tone, key themes
   - Avoid just technical specs

4. **Add Awards**
   - Format: "Best Film - Raindance 2024"
   - Or: "Official Selection: Sundance 2024"

5. **High-Quality Images**
   - First gallery image = social preview
   - 1920x1080 minimum
   - Interesting composition (not black frames)

## Technical Implementation

### Files Modified:
- `components/SEO.tsx` - Enhanced with Movie/Article schema + configurable default OG image
- `components/views/ProjectDetailView.tsx` - Passes full project data + config
- `components/views/BlogPostView.tsx` - Passes full post data + config
- `netlify/edge-functions/meta-rewrite.ts` - Dynamic meta injection using config.defaultOgImage
- `utils/sitemapGenerator.ts` - Prioritizes narrative projects

### OG Image Fallback Chain:
1. **Specific image**: Project hero image or blog post cover
2. **Config default**: `config.defaultOgImage` from Airtable Settings
3. **Ultimate fallback**: Unsplash placeholder (only if config is empty)

This ensures all pages have appropriate social media preview images, using your branded default image instead of generic placeholders.

### Schema Types Used:
- **Movie** - Narrative projects
- **VideoObject** - Commercials, music videos
- **Article** - Blog posts
- **Person** - Homepage, director profile

## Monitoring & Maintenance

### Check Monthly:
1. **Google Search Console** - Indexing issues
2. **Core Web Vitals** - Page speed scores
3. **Rich Results Report** - Schema errors

### Update When:
- New project added → Rebuild site (automatic via Netlify)
- Awards received → Update in Airtable (sync on next build)
- Credits change → Update in Airtable

## Common Issues

### "Project not appearing in Google"
- **Solution**: Wait 1-2 weeks for first index
- Submit URL directly in Search Console
- Check robots.txt isn't blocking

### "No rich results showing"
- **Solution**: Test with Rich Results Tool
- Ensure all required fields filled in Airtable
- Rebuild and redeploy site

### "Wrong image in social preview"
- **Solution**: First gallery image is used
- Add "Social Image" field to Airtable for custom override
- Clear social media cache after changes

## Next Steps

### Immediate:
1. ✅ Submit sitemap to Google Search Console
2. ✅ Test one project URL in Rich Results Tool
3. ✅ Verify all narrative projects have year + description

### Optional Enhancements:
- Add "Social Image" field to Airtable for custom previews
- Create blog posts about each major project (boosts SEO)
- Add cast/crew personal websites to credits (more connections)
- Request IMDb to link to your official site

## Questions?

All SEO metadata is automatically generated from your Airtable data. Simply keep your project information complete and accurate, and Google will receive comprehensive structured data about your work.
