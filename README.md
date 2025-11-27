# Gabriel Athanasiou Portfolio

Production-ready React portfolio website with Airtable CMS, optimized images, and Google Analytics 4.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## 🔧 Development

```bash
npm run dev              # Start dev server
npm run build            # Production build with image optimization
npm run preview          # Preview production build
npm run optimize:images  # Manually optimize images from Airtable
npm run test:images      # Test Airtable image URLs
```

## 🌍 Environment Variables

Create `.env.local`:
```bash
VITE_AIRTABLE_TOKEN=keyXXXXXXXXXXXXXX
VITE_AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX  # Optional: Google Analytics
```

## 📖 Documentation

### Core Documentation
- [AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md) - Complete technical documentation (for AI agents and developers)
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Netlify deployment instructions

### Architecture & Features
- [docs/CDN_CACHE_FINAL_IMPLEMENTATION.md](./docs/CDN_CACHE_FINAL_IMPLEMENTATION.md) - CDN caching architecture
- [docs/CLOUDINARY_INTEGRATION.md](./docs/CLOUDINARY_INTEGRATION.md) - Cloudinary image optimization (production)
- [IMAGE_OPTIMIZATION.md](./IMAGE_OPTIMIZATION.md) - Image optimization system
- [docs/PROCEDURAL_THUMBNAILS.md](./docs/PROCEDURAL_THUMBNAILS.md) - Procedural artwork generation

### Setup Guides
- [docs/ENV_SETUP.md](./docs/ENV_SETUP.md) - Environment configuration
- [docs/ANALYTICS_SETUP.md](./docs/ANALYTICS_SETUP.md) - Google Analytics setup
- [docs/SEO_GUIDE.md](./docs/SEO_GUIDE.md) - SEO configuration

## 🏗️ Tech Stack

- React 19.2.0 + TypeScript
- Vite 6.2.0
- React Router 6
- Airtable (Headless CMS)
- Cloudinary (Image CDN & Optimization)
- Netlify (Hosting + Functions)
- Sharp (Local Image Optimization)
- Google Analytics 4

## 📝 License

Private project
