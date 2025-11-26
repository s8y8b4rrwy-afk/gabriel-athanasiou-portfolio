# Gabriel Athanasiou Portfolio

High-performance React portfolio website with Airtable CMS, optimized images, and Google Analytics 4.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## 📚 Documentation

**→ [AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md)** - Complete technical documentation for developers and AI agents

This guide includes:
- Architecture overview
- Tech stack details  
- **Shared utilities system** (video, text, slug helpers)
- Data flow and CMS integration
- Development workflow
- Deployment process
- Troubleshooting
- Common tasks

## 🔧 Development

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run preview          # Preview production build
npm run optimize:images  # Optimize images from Airtable
npm run test:images      # Test Airtable image URLs
```

## 🌍 Environment Variables

Create `.env.local`:
```bash
VITE_AIRTABLE_TOKEN=keyXXXXXXXXXXXXXX
VITE_AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
```

## 📖 Additional Documentation

- [AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md) - **Complete technical documentation**
- [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) - Recent code refactoring (Nov 2025)
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Netlify deployment instructions
- [IMAGE_OPTIMIZATION.md](./IMAGE_OPTIMIZATION.md) - Image optimization details
- [docs/ANALYTICS_SETUP.md](./docs/ANALYTICS_SETUP.md) - Google Analytics setup
- [docs/ENV_SETUP.md](./docs/ENV_SETUP.md) - Environment configuration

## 🏗️ Tech Stack

- React 19.2.0 + TypeScript
- Vite 6.2.0
- React Router 6
- Airtable (Headless CMS)
- Netlify (Hosting + Functions)
- Sharp (Image Optimization)
- Google Analytics 4

## 📝 License

Private project
