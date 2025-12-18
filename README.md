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
npm run sync:static      # Sync static files to Cloudinary
```

## 🔄 Data Sync

Data syncing from Airtable is **manual only** to conserve API credits. To sync content:

1. Go to the repository's **Actions** tab on GitHub
2. Select **"Manual Data Sync (Airtable + Deploy)"** workflow
3. Click **"Run workflow"** to sync data and trigger deployment

See [docs/DATA_SYNC_GUIDE.md](./docs/DATA_SYNC_GUIDE.md) for detailed instructions.

## 🌍 Environment Variables

Create `.env.local`:
```bash
VITE_AIRTABLE_TOKEN=keyXXXXXXXXXXXXXX
VITE_AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX  # Optional: Google Analytics

# Cloudinary (for image optimization and static file hosting)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## 📖 Documentation

### 📘 Master Guide
- **[AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md)** - Complete technical documentation (START HERE)
  - Project architecture and system design
  - Data structures and Airtable schema
  - Environment setup and workflows
  - Deployment and CI/CD processes
  - Performance optimization
  - Troubleshooting guides
- **[CHANGELOG.md](./CHANGELOG.md)** - Complete history of all changes

### 📚 Quick Reference
- **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** - Guide to all documentation files
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Netlify deployment instructions

### Core Systems
- [docs/CDN_CACHE_FINAL_IMPLEMENTATION.md](./docs/CDN_CACHE_FINAL_IMPLEMENTATION.md) - CDN caching architecture
- [docs/CLOUDINARY_INTEGRATION.md](./docs/CLOUDINARY_INTEGRATION.md) - Cloudinary image optimization (production)
- [docs/STATIC_FILES_HOSTING.md](./docs/STATIC_FILES_HOSTING.md) - Static files hosting with Cloudinary
- [docs/DATA_SYNC_GUIDE.md](./docs/DATA_SYNC_GUIDE.md) - Manual data sync from Airtable
- [IMAGE_OPTIMIZATION.md](./IMAGE_OPTIMIZATION.md) - Image optimization system
- [docs/PROCEDURAL_THUMBNAILS.md](./docs/PROCEDURAL_THUMBNAILS.md) - Procedural artwork generation

### Setup & Configuration
- [docs/ENV_SETUP.md](./docs/ENV_SETUP.md) - Environment configuration
- [docs/ANALYTICS_SETUP.md](./docs/ANALYTICS_SETUP.md) - Google Analytics setup
- [docs/SEO_GUIDE.md](./docs/SEO_GUIDE.md) - SEO configuration

**For AI Agents:** Read [AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md) entirely before making any changes.

## 🏗️ Tech Stack

- React 19.2.0 + TypeScript
- Vite 6.2.0
- React Router 6
- Airtable (Headless CMS)
- Cloudinary (Image CDN, Optimization & Static File Hosting)
- Netlify (Hosting + Functions)
- Sharp (Local Image Optimization)
- Google Analytics 4
- GitHub Actions (CI/CD & Static File Sync)

## 📝 License

Private project
