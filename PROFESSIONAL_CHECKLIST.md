# Portfolio Professional & Performance Checklist

## ✅ Completed
- Lightweight bundle (only React, Router, Tailwind)
- No heavy dependencies or bloat
- Lazy loading on images
- GPU-accelerated animations
- SEO fundamentals (meta tags, canonical, schema.org)
- Dynamic sitemap from Airtable
- Social sharing buttons
- Responsive design
- Dark mode optimized
- Type-safe with TypeScript

## ⚠️ High Priority (Do Soon)

### 1. Replace Placeholder Images
**Status**: Not started
**Impact**: Critical for professionalism
**Action**: Replace all Unsplash placeholders with real portfolio images
- Hero images in projects
- Featured work grid images
- Blog post cover images
- Profile photo in About section

**Current placeholders**:
- `https://images.unsplash.com/photo-1492691527719-9d1e07e534b4` (hero)
- `https://images.unsplash.com/photo-1626814026160-2237a95fc5a0` (placeholder)
- `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d` (profile)

### 2. Optimize Images
**Status**: Utility created (`utils/imageOptimization.ts`)
**Action**: Update image tags in components
```tsx
// Example implementation in ProjectDetailView.tsx
import { getOptimizedImageUrl, getImageSizes } from '../utils/imageOptimization';

// Update img tags to use:
<img 
  src={getOptimizedImageUrl(src, 1440)}
  srcSet={generateSrcSet(src)}
  sizes={getImageSizes('hero')}
  alt={title}
  decoding="async"
  loading="lazy"
  width="1440"
  height="810"
/>
```

### 3. Update Profile Photo
**Status**: Currently `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d`
**Action**: Upload real photo to Airtable "Settings" table
- Field: "About Image"
- Recommended: Professional headshot, 400x400px minimum

## 🟡 Medium Priority (Optimize Later)

### 4. Core Web Vitals Enhancements
- Add width/height attributes to images (prevents layout shift)
- Preload critical hero images (already in index.html for main hero)
- Consider blur-up placeholder effect for slower connections

### 5. Performance Monitoring
- Add Google Analytics to track real user metrics
- Monitor Core Web Vitals in Search Console
- Test on mobile with slow networks (DevTools > Throttling)

### 6. Image Format Strategy
- Current: JPEG (Unsplash), automatic via Airtable
- Future: Consider WebP with fallback (if hosting on CDN with transformation)
- Already optimal: Airtable serves images efficiently

## 🟢 Low Priority (Nice to Have)

### 7. Advanced Optimizations
- Add analytics with custom events
- Implement resource hints (dns-prefetch, preconnect) for external services
- Consider image blur-up effect for perceived performance
- Prefetch next project on detail page (user usually clicks next)

### 8. Accessibility
- Alt text on images ✅ (mostly in place, verify all)
- Image description in schema.org
- Video captions/transcripts (if applicable)

## Next Steps
1. **Immediately**: Replace placeholder images with real portfolio work
2. **Week 1**: Update profile photo and test Core Web Vitals
3. **Week 2**: Monitor in Google Analytics & Search Console
4. **Ongoing**: Add new projects to Airtable, sitemap updates automatically

## Testing Commands
```bash
# Build and analyze bundle size
npm run build

# Check TypeScript
npx tsc --noEmit

# Lighthouse audit (local)
npm run preview
# Then open http://localhost:4173 in browser DevTools > Lighthouse
```

## Performance Targets
- Lighthouse Score: 90+
- Core Web Vitals: All Green
  - LCP (Largest Contentful Paint): < 2.5s
  - FID (First Input Delay): < 100ms
  - CLS (Cumulative Layout Shift): < 0.1
- Bundle Size: < 100KB gzipped
