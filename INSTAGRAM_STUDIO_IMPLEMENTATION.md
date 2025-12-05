# 🍋 Lemon Post Instagram Studio - Implementation Plan

> A comprehensive tool for generating, previewing, and scheduling Instagram posts from your portfolio data.

---

## Table of Contents

1. [Overview](#overview)
2. [Deployment & Access](#deployment--access)
3. [Local Development with ngrok](#local-development-with-ngrok)
4. [Instagram Account Setup](#instagram-account-setup)
5. [Architecture](#architecture)
6. [Implementation Phases](#implementation-phases)
7. [Cloud Sync](#cloud-sync)
8. [Cloudinary Image URLs](#cloudinary-image-urls)
9. [Technical Specifications](#technical-specifications)
10. [Post Format & Templates](#post-format--templates)
11. [Hashtag Strategy](#hashtag-strategy)
12. [API Integration](#api-integration)
13. [Rate Limits & Best Practices](#rate-limits--best-practices)
14. [Future Enhancements](#future-enhancements)

---

## Overview

### What This Tool Does

- **Reads** project data from `portfolio-data-postproduction.json`
- **Generates** Instagram-ready captions with credits, hashtags, and CTAs
- **Previews** posts exactly as they'll appear on Instagram
- **Schedules** posts via calendar interface
- **Publishes** directly to Instagram via Graph API (Phase 3)

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + TypeScript + Vite |
| Styling | CSS Modules or Tailwind |
| State | React Context / Zustand |
| API | Instagram Graph API |
| Data Source | Local JSON files |
| Cloud Sync | Cloudinary (signed uploads) |
| Hosting | Netlify (gram-studio.netlify.app) |
| Custom Domain | studio.lemonpost.studio |

---

## Deployment & Access

### Live URLs

| Environment | URL |
|-------------|-----|
| Production | https://studio.lemonpost.studio |
| Netlify URL | https://gram-studio.netlify.app |
| Local Dev | http://localhost:5174 |

### Password Protection

The app is protected with password authentication:
- Password hash stored in `VITE_PASSWORD_HASH` environment variable
- Uses SHA-256 for secure client-side hashing
- "Remember Me" option stores authentication for 7 days

### Deployment Control

Automatic deploys are **disabled** for this site. To deploy:

```bash
# Include [deploy] in your commit message to trigger a build
git commit -m "feat: Add new feature [deploy]"
git push origin main
```

Commits without `[deploy]` or `[force-deploy]` will be skipped by Netlify.

### Environment Variables (Netlify)

#### Instagram Studio Site (gram-studio.netlify.app)

| Variable | Description |
|----------|-------------|
| `VITE_PASSWORD_HASH` | SHA-256 hash of the login password |
| `VITE_SYNC_FUNCTION_URL` | URL to the sync function |
| `VITE_INSTAGRAM_APP_ID` | Instagram App ID: `837730882390944` |
| `VITE_INSTAGRAM_REDIRECT_URI` | OAuth callback: `https://studio.lemonpost.studio/auth/callback` |

#### Main Site Functions (lemonpost.studio / gabriel-athanasiou.netlify.app)

| Variable | Description |
|----------|-------------|
| `CLOUDINARY_API_SECRET` | Cloudinary API secret (for signed uploads) |
| `INSTAGRAM_APP_ID` | Instagram App ID: `837730882390944` |
| `INSTAGRAM_APP_SECRET` | Instagram App Secret (server-side, never expose!) |

---

## Local Development with ngrok

### Why ngrok?

Meta (Instagram) **doesn't allow `localhost`** URLs for OAuth redirect URIs. ngrok creates a secure HTTPS tunnel from the internet to your local machine, giving you a public URL that Meta will accept.

### Prerequisites

- Node.js installed
- ngrok installed: `brew install ngrok`
- ngrok account (free tier works): https://ngrok.com

### One-Time Setup

#### 1. Configure ngrok Auth Token

Get your token from https://dashboard.ngrok.com/get-started/your-authtoken

```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

### Starting Local Development

#### Terminal 1: Start Dev Server

```bash
cd scripts/instagram-studio
npm run dev
# Server runs on port 5174
```

#### Terminal 2: Start ngrok Tunnel

```bash
ngrok http 5174
```

You'll see output like:
```
Session Status                online
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:5174
```

#### Terminal 3: Update Local Environment

Create/update `.env.local` in the instagram-studio folder:

```bash
cd scripts/instagram-studio
echo "VITE_INSTAGRAM_REDIRECT_URI=https://abc123.ngrok-free.app/auth/callback" > .env.local
```

Replace `abc123.ngrok-free.app` with your actual ngrok URL.

> **Note:** The Vite config has `allowedHosts: true` to allow ngrok connections.

### Add ngrok URL to Meta Dashboard

1. Copy your ngrok URL (e.g., `https://abc123.ngrok-free.app`)
2. Go to [Meta Developers](https://developers.facebook.com/apps/) → Your App
3. Navigate to: **Instagram** → **Instagram Login with Business** → **Settings**
4. Add to "Valid OAuth redirect URIs": `https://abc123.ngrok-free.app/auth/callback`
5. Save

**Note:** Free tier gives you a random URL each time you restart ngrok. You'll need to update Meta Dashboard each session.

### Restart Dev Server

After updating `.env.local`, restart the dev server to pick up the new redirect URI.

### Testing the OAuth Flow

1. Open the ngrok URL in your browser: `https://abc123.ngrok-free.app`
2. Go to **Settings** → **Connect Instagram**
3. Click "Connect" - this should redirect to Instagram
4. Authorize the app
5. You should be redirected back and see "Connected as @username"

### Quick Reference

```bash
# Full local dev setup with Instagram OAuth
# Terminal 1
cd scripts/instagram-studio && npm run dev

# Terminal 2
ngrok http 5174

# Terminal 3 - Update redirect URI
cd scripts/instagram-studio
echo "VITE_INSTAGRAM_REDIRECT_URI=https://YOUR-NGROK-URL.ngrok-free.app/auth/callback" > .env.local

# Then restart Terminal 1's dev server and update Meta Dashboard
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid redirect_uri" | Ensure ngrok URL in Meta Dashboard matches `.env.local` exactly |
| "ERR_NGROK_3200" | Make sure dev server is running on port 5174 |
| "Blocked request" host error | Already fixed - Vite config has `allowedHosts: true` |
| Token expired | Go to Settings → Disconnect, then reconnect |
| ngrok session expired | Restart ngrok and update Meta Dashboard with new URL |

---

## Instagram Account Setup

### Step 1: Convert to Business/Creator Account

Instagram's API only works with **Business** or **Creator** accounts.

1. Open Instagram app → Go to your profile
2. Tap **☰ Menu** → **Settings and privacy**
3. Scroll to **Account type and tools**
4. Tap **Switch to professional account**
5. Choose **Business** (recommended for brands) or **Creator**
6. Select a category: `Media Production` or `Video Creator`
7. Complete the setup

### Step 2: Connect to Facebook Page

Instagram API requires a connected Facebook Page.

1. Go to Instagram → **Settings** → **Account** → **Sharing to other apps**
2. Tap **Facebook** and log in
3. **Create a new Facebook Page** for Lemon Post if you don't have one:
   - Page name: `Lemon Post`
   - Category: `Media/News Company` or `Video Creator`
4. Link the Instagram account to this Facebook Page

### Step 3: Create Meta Developer Account

1. Go to [developers.facebook.com](https://developers.facebook.com/)
2. Click **Get Started** and log in with your Facebook account
3. Accept the developer terms
4. Verify your account (phone number required)

### Step 4: Create a Meta App

1. In Meta Developer Dashboard, click **Create App**
2. Select **Business** as the app type
3. Fill in:
   - App name: `Lemon Post Instagram Studio`
   - Contact email: your email
   - Business Account: Select or create one
4. Click **Create App**

### Step 5: Add Instagram Graph API

1. In your app dashboard, find **Add Products**
2. Click **Set Up** on **Instagram Graph API**
3. Go to **App Settings** → **Basic**
4. Add your **Privacy Policy URL** (can use your website)
5. Add **App Domains**: `localhost` (for development)

### Step 6: Generate Access Tokens

#### For Development (Short-lived token):

1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app from the dropdown
3. Click **Generate Access Token**
4. Select permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_insights`
   - `pages_show_list`
   - `pages_read_engagement`
5. Click **Generate Access Token**
6. Copy and save this token

#### For Production (Long-lived token):

1. Exchange short-lived token for long-lived token:
```bash
curl -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_LIVED_TOKEN}"
```

2. Long-lived tokens last 60 days
3. Set up token refresh in your app

### Step 7: Get Instagram Business Account ID

```bash
curl -X GET "https://graph.facebook.com/v18.0/me/accounts?access_token={ACCESS_TOKEN}"
```

Then for each page, get the Instagram account:

```bash
curl -X GET "https://graph.facebook.com/v18.0/{PAGE_ID}?fields=instagram_business_account&access_token={ACCESS_TOKEN}"
```

Save the `instagram_business_account.id` - you'll need this for posting.

### Step 8: Store Credentials Securely

Create a `.env` file (add to `.gitignore`!):

```env
# Instagram API Credentials
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_ACCESS_TOKEN=your_long_lived_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_ig_business_id
```

---

## Architecture

### Project Structure

```
scripts/
  instagram-studio/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    ├── .env.example
    ├── .env                    # Git ignored
    │
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── index.css
    │   │
    │   ├── components/
    │   │   ├── Layout/
    │   │   │   ├── Header.tsx
    │   │   │   ├── Sidebar.tsx
    │   │   │   └── Layout.tsx
    │   │   │
    │   │   ├── ProjectList/
    │   │   │   ├── ProjectList.tsx
    │   │   │   ├── ProjectCard.tsx
    │   │   │   └── ProjectFilters.tsx
    │   │   │
    │   │   ├── PostPreview/
    │   │   │   ├── PostPreview.tsx
    │   │   │   ├── ImageCarousel.tsx
    │   │   │   ├── CaptionEditor.tsx
    │   │   │   └── HashtagEditor.tsx
    │   │   │
    │   │   ├── Calendar/
    │   │   │   ├── Calendar.tsx
    │   │   │   ├── CalendarDay.tsx
    │   │   │   └── TimeSlotPicker.tsx
    │   │   │
    │   │   └── Schedule/
    │   │       ├── SchedulePanel.tsx
    │   │       ├── ScheduleQueue.tsx
    │   │       └── ScheduleItem.tsx
    │   │
    │   ├── hooks/
    │   │   ├── useProjects.ts
    │   │   ├── useSchedule.ts
    │   │   ├── useInstagramAPI.ts
    │   │   └── useLocalStorage.ts
    │   │
    │   ├── utils/
    │   │   ├── generateCaption.ts
    │   │   ├── generateHashtags.ts
    │   │   ├── formatCredits.ts
    │   │   └── instagramAPI.ts
    │   │
    │   ├── types/
    │   │   ├── project.ts
    │   │   ├── post.ts
    │   │   └── schedule.ts
    │   │
    │   └── data/
    │       └── hashtagLibrary.ts
    │
    └── public/
        └── favicon.svg
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                            │
├─────────────────────────────────────────────────────────────────┤
│  portfolio-data-postproduction.json                             │
│         ↓                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    INSTAGRAM STUDIO                      │   │
│  │                                                          │   │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────────┐     │   │
│  │   │ Projects │ →  │ Generate │ →  │ Post Preview │     │   │
│  │   │   List   │    │ Caption  │    │              │     │   │
│  │   └──────────┘    └──────────┘    └──────────────┘     │   │
│  │         ↓                               ↓               │   │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────────┐     │   │
│  │   │ Schedule │ ←  │ Calendar │ ←  │    Edit      │     │   │
│  │   │   Queue  │    │   View   │    │   Caption    │     │   │
│  │   └──────────┘    └──────────┘    └──────────────┘     │   │
│  │         ↓                                               │   │
│  │   ┌──────────────────────────────────────────────┐     │   │
│  │   │              Instagram Graph API              │     │   │
│  │   │                                               │     │   │
│  │   │   • Create Media Container                    │     │   │
│  │   │   • Publish Media                             │     │   │
│  │   │   • Check Status                              │     │   │
│  │   └──────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                  │
│                      Instagram Feed                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core UI & Caption Generation ✅ COMPLETE
**Timeline: 1-2 days**

#### Features:
- [x] Project list from JSON with filtering
- [x] Post preview component (Instagram-style mockup)
- [x] Caption generator with templates
- [x] Hashtag generator based on project attributes
- [x] Caption editor (editable before posting)
- [x] Copy caption to clipboard
- [x] Download images for manual posting
- [x] Local storage for drafts (basic implementation ready)

#### Deliverables:
- ✅ Working React app at `localhost:5174`
- ✅ Can preview any project as Instagram post
- ✅ Can copy caption for manual posting

---

### Phase 2: Scheduling & Calendar ✅ COMPLETE
**Timeline: 1-2 days**

#### Features:
- [x] Calendar view (month/week)
- [x] Drag & drop scheduling (react-dnd)
- [x] Time slot management
- [x] Schedule queue view
- [x] Optimal posting times suggestions
- [x] Edit scheduled posts
- [x] View scheduled posts per project
- [x] Schedule status filter (scheduled/published/unscheduled)
- [x] Enhanced metadata search (title, description, client, type, kinds, genre, credits, awards)
- [x] Cloudinary image integration (builds URLs from project ID + index, no Airtable ID extraction needed)
- [x] Export schedule to CSV/JSON
- [x] Cloudinary sync (upload/fetch schedule data)
- [x] Recurring post templates
- [x] Draggable calendar mini-cards (reschedule by dragging)
- [x] Calendar shows project titles instead of dots
- [x] Delete scheduled posts from day panel
- [x] Time picker when editing posts
- [x] Click post title to edit
- [x] Previous view restoration on cancel/save

#### Deliverables:
- ✅ Visual calendar with scheduled posts showing titles
- ✅ Ability to plan content weeks in advance
- ✅ Schedule data persisted in local storage
- ✅ Edit and manage scheduled posts from project view
- ✅ Filter projects by schedule status
- ✅ All images served via Cloudinary CDN
- ✅ Drag projects onto calendar to quick-schedule
- ✅ Drag scheduled posts between days to reschedule
- ✅ Export/import schedule data to/from Cloudinary
- ✅ Template management for recurring posts
- ✅ Intuitive UX with back navigation

---

### Phase 2.5: Cloud Sync & Deployment ✅ COMPLETE
**Timeline: 1 day**

#### Features:
- [x] Signed uploads to Cloudinary (secure, no unsigned presets needed)
- [x] Sync ALL data: schedules, templates, defaultTemplate, settings
- [x] Auto-fetch from Cloudinary on app boot
- [x] Password protection with SHA-256 hashing
- [x] "Remember Me" authentication (7-day persistence)
- [x] Deployed to Netlify (gram-studio.netlify.app)
- [x] Custom domain (studio.lemonpost.studio)
- [x] Controlled deployments (only with [deploy] marker)
- [x] Server-side Netlify function for secure Cloudinary signatures

#### Deliverables:
- ✅ Data syncs securely to Cloudinary cloud storage
- ✅ Access from any device via custom domain
- ✅ Password-protected access
- ✅ Automatic data loading on app start
- ✅ Export JSON includes all data (schedules + templates + settings)

---

### Phase 3: Instagram API Integration ✅ COMPLETE
**Timeline: 2-3 days**

#### 3.1 OAuth Authentication System
- [x] Create `/auth/callback` route in app
- [x] Build Netlify function for token exchange (`instagram-auth.mjs`)
- [x] Implement token storage locally (with Cloudinary sync planned)
- [x] Add "Connect Instagram" button in Settings
- [x] Display connection status (connected/expired/not connected)
- [x] Auto-refresh tokens before expiry
- [x] Handle token revocation gracefully

#### 3.2 Publishing Features
- [x] Publish single image posts
- [x] Publish carousel posts (up to 10 images)
- [x] "Publish Now" button on scheduled posts
- [x] Post status tracking (pending/published/failed)
- [x] Error handling with user-friendly messages
- [x] Retry logic for failed posts

#### 3.3 Automated Scheduling
- [ ] Background job for scheduled posts (Netlify scheduled functions)
- [ ] Check for due posts every 15 minutes
- [ ] Auto-publish when scheduled time arrives
- [ ] Update post status after publishing
- [ ] Notification system for publish results

#### 3.4 Rate Limit Management
- [x] Track API calls per hour
- [x] Queue posts if approaching limit
- [x] Show rate limit status in UI
- [x] Graceful degradation when limited

#### Deliverables:
- ✅ One-click "Connect Instagram" (OAuth)
- ✅ Token auto-refresh (never expires if used regularly)
- ✅ Publish directly from the app
- ⏳ Automated scheduled posting (Netlify scheduled functions needed)
- ✅ Status dashboard for all posts

#### OAuth Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER CLICKS "CONNECT"                       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           Redirect to Instagram Authorization                    │
│   https://api.instagram.com/oauth/authorize?                     │
│     client_id={APP_ID}&                                          │
│     redirect_uri={CALLBACK_URL}&                                 │
│     scope=instagram_business_basic,instagram_business_content_publish&
│     response_type=code                                           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              User Authorizes on Instagram                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│     Redirect to: studio.lemonpost.studio/auth/callback?code=XXX │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Netlify Function: instagram-auth.mjs                │
│                                                                  │
│   1. Exchange code for short-lived token                         │
│   2. Exchange short-lived for long-lived token (60 days)         │
│   3. Get Instagram Business Account ID                           │
│   4. Store token + account ID in Cloudinary                      │
│   5. Return success to frontend                                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    App Shows "Connected" ✅                      │
│              Token auto-refreshes before expiry                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Token Storage Format (Cloudinary)

```json
{
  "version": "1.2.0",
  "instagram": {
    "connected": true,
    "accountId": "24965197513162722",
    "username": "lemonpoststudio",
    "accessToken": "encrypted_token_here",
    "tokenExpiry": "2026-02-03T12:00:00.000Z",
    "lastRefreshed": "2025-12-05T12:00:00.000Z"
  },
  "schedules": [...],
  "templates": [...]
}
```

---

## Cloud Sync

### How It Works

Instagram Studio uses Cloudinary for cloud storage, enabling access from any device:

1. **Data Stored**: Schedules, templates, default template, and settings
2. **Storage Location**: `instagram-studio/schedule-data.json` in Cloudinary
3. **Sync Method**: Signed uploads via Netlify serverless function

### Sync Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Instagram Studio App                       │
│                (studio.lemonpost.studio)                      │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      │ POST /sync (upload)
                      │ GET  /sync (fetch)
                      ▼
┌──────────────────────────────────────────────────────────────┐
│           Netlify Function (Serverless)                       │
│      lemonpost.studio/.netlify/functions/instagram-studio-sync│
│                                                               │
│   • Generates SHA-1 signature with API secret                 │
│   • Uploads to Cloudinary with signed params                  │
│   • Fetches existing data from Cloudinary                     │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      │ Signed Upload / Fetch
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                     Cloudinary                                │
│                  (cloud: date24ay6)                           │
│                                                               │
│   📁 instagram-studio/                                        │
│      └── schedule-data.json                                   │
└──────────────────────────────────────────────────────────────┘
```

### Data Format (v1.1.0)

```json
{
  "version": "1.1.0",
  "lastUpdated": "2025-12-05T12:00:00.000Z",
  "schedules": [
    {
      "id": "uuid",
      "projectId": "project-slug",
      "scheduledDate": "2025-12-10T15:00:00.000Z",
      "caption": "Generated caption...",
      "hashtags": ["#tag1", "#tag2"],
      "status": "scheduled"
    }
  ],
  "templates": [
    {
      "id": "uuid",
      "name": "Template Name",
      "captionTemplate": "🎬 {title}...",
      "hashtagGroups": ["film", "grading"],
      "isDefault": false
    }
  ],
  "defaultTemplate": {
    "id": "default",
    "name": "Default",
    "captionTemplate": "...",
    "hashtagGroups": [],
    "isDefault": true
  },
  "settings": {
    "preferredPostTime": "15:00",
    "timezone": "Europe/London"
  }
}
```

### Sync Buttons

- **Sync to Cloud ☁️↑**: Uploads current local data to Cloudinary
- **Fetch from Cloud ☁️↓**: Downloads and applies cloud data locally
- **Auto-fetch**: Data is automatically fetched when app loads

### Netlify Function

Located at `netlify/functions/instagram-studio-sync.mjs`:

```javascript
// Handles both GET (fetch) and POST (upload)
// Uses SHA-1 for Cloudinary signature (NOT SHA-256)
// Keeps API secret secure on server side
```

Required environment variables on main site (lemonpost.studio):
- `CLOUDINARY_API_SECRET`: Your Cloudinary API secret

---

## Cloudinary Image URLs

### Why Cloudinary?

Portfolio data from Airtable contains **temporary image URLs** that expire after a few hours. Instagram's API requires **permanent, publicly accessible URLs** to publish posts. All portfolio images are already synced to Cloudinary by the main site, so Instagram Studio builds Cloudinary URLs directly.

### Image Quality Presets

Instagram Studio uses presets matching the main site for consistent image quality:

| Preset | Quality | Width | Format | Use Case |
|--------|---------|-------|--------|----------|
| `micro` | 70 | 600px | webp | Slow 2G connections |
| `fine` | 80 | 1000px | webp | **App preview** (default) |
| `ultra` | 90 | 1600px | webp | Larger displays |
| `hero` | 100 | 2400px | webp | Hero images |
| `instagram` | 100 | original | original | **Instagram publishing** |

**Key difference:**
- **Preview in app**: Uses `fine` preset (42KB, webp, compressed) for fast loading
- **Publish to Instagram**: Uses `instagram` preset (203KB, original jpeg) for best quality

### URL Pattern

Cloudinary images follow this naming convention:
```
portfolio-projects-{recordId}-{index}
```

Where:
- `recordId`: The Airtable record ID (e.g., `rec4QdaV0qLrTR8fh`)
- `index`: Zero-based index of the image in the project gallery

### Example URLs

| Use Case | URL |
|----------|-----|
| **App Preview** (fine preset) | `https://res.cloudinary.com/date24ay6/image/upload/f_webp,w_1000,c_limit,q_80/portfolio-projects-rec4QdaV0qLrTR8fh-0` |
| **Instagram Publish** (original) | `https://res.cloudinary.com/date24ay6/image/upload/portfolio-projects-rec4QdaV0qLrTR8fh-0` |

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Portfolio Data (Airtable)                     │
│                                                                  │
│   project.id = "rec4QdaV0qLrTR8fh"                              │
│   project.gallery = ["airtable-url-0", "airtable-url-1", ...]   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ buildCloudinaryUrl(projectId, imageIndex, preset)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudinary URL Built                          │
│                                                                  │
│   For preview (preset='fine'):                                   │
│   url = ".../f_webp,w_1000,c_limit,q_80/{publicId}"             │
│                                                                  │
│   For Instagram (preset='instagram'):                            │
│   url = ".../upload/{publicId}" (no transformations)             │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `src/utils/imageUtils.ts` | Core URL building functions with presets |
| `src/hooks/useCloudinaryImages.ts` | React hooks for components |

### Main Functions

```typescript
// Build a Cloudinary URL with preset (default: 'fine' for preview)
buildCloudinaryUrl(projectId: string, imageIndex: number, preset?: ImagePreset): string

// Convenience functions
buildPreviewUrl(projectId: string, imageIndex: number): string  // Uses 'fine' preset
buildInstagramUrl(projectId: string, imageIndex: number): string // Uses 'instagram' preset

// Convert URLs for preview display (optimized, compressed)
ensureCloudinaryUrls(urls: string[], projectId: string): Promise<string[]>

// Get original quality URLs for Instagram API publishing
getInstagramPublishUrls(urls: string[], projectId: string): Promise<string[]>
```

### React Hooks

```typescript
// Get optimized Cloudinary URL for preview (fine preset)
const imageUrl = useCloudinaryUrl(originalUrl, projectId, imageIndex);

// Get optimized URLs for all gallery images
const imageUrls = useCloudinaryUrls(galleryUrls, projectId);

// Build preview URLs directly from project ID
const urls = useProjectCloudinaryUrls(projectId, imageCount);

// Get original quality URLs for Instagram publishing
const getPublishUrls = useInstagramPublishUrls();
const instagramUrls = await getPublishUrls(selectedImages, projectId);
```

### Cloudinary Mapping

The main site generates a `cloudinary-mapping.json` file that maps project IDs to their Cloudinary images:

```json
{
  "generatedAt": "2025-12-05T12:00:00.000Z",
  "projects": [
    {
      "recordId": "rec4QdaV0qLrTR8fh",
      "title": "The Newspaper",
      "images": [
        {
          "index": 0,
          "publicId": "portfolio-projects-rec4QdaV0qLrTR8fh-0",
          "cloudinaryUrl": "https://res.cloudinary.com/date24ay6/image/upload/..."
        }
      ]
    }
  ]
}
```

This mapping is fetched from `https://lemonpost.studio/cloudinary-mapping.json` and used for validation.

---

### Phase 4: Analytics & Enhancements
**Timeline: Ongoing**

#### Features:
- [ ] Post performance tracking
- [ ] Best time to post analytics
- [ ] Hashtag performance
- [ ] Engagement metrics
- [ ] A/B testing captions
- [ ] AI-powered caption suggestions

---

## Technical Specifications

### Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "date-fns": "^3.0.0",
    "react-calendar": "^4.8.0",
    "react-dnd": "^16.0.0",
    "zustand": "^4.4.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0"
  }
}
```

### NPM Scripts

```json
{
  "scripts": {
    "instagram-studio": "vite --config scripts/instagram-studio/vite.config.ts",
    "instagram-studio:build": "vite build --config scripts/instagram-studio/vite.config.ts"
  }
}
```

---

## Post Format & Templates

### Caption Template

```
🎬 {title} ({year})

{description - max 150 chars}

{🏆 awards - if any}

—
{credits with emojis}

{Client: clientName - if available}
Production: {productionCompany}

—
Lemon Post is a post-production studio specialising in 
colour grading and editing for film, commercials, and 
branded content.

🔗 lemonpost.studio | Link in bio

{hashtags}
```

### Credit Emoji Mapping

| Role | Emoji | Display Format |
|------|-------|----------------|
| Colourist | 🎨 | Colour Grading by {name} |
| Editor | ✂️ | Edit by {name} |
| Director | 🎬 | Directed by {name} |
| DOP / Cinematographer | 📷 | Cinematography by {name} |
| Sound / Audio | 🎵 | Sound by {name} |
| VFX | ✨ | VFX by {name} |
| Producer | 🎞️ | Produced by {name} |
| Writer | ✍️ | Written by {name} |
| Composer | 🎼 | Music by {name} |
| Animator | 🖌️ | Animation by {name} |

### Example Generated Posts

#### Short Film

```
🎬 The Newspaper (2025)

A suspenseful descent into appearances, trust, and the quiet 
power of uncovering the truth.

🏆 Raindance 2025

—
🎨 Colour Grading by Lemon Post
🎬 Directed by Gabriel Athanasiou

Production: Double J Films Limited

—
Lemon Post is a post-production studio specialising in 
colour grading and editing for film, commercials, and 
branded content.

🔗 lemonpost.studio | Link in bio

#shortfilm #drama #periodfilm #mystery #filmmaking 
#cinematography #colorgrading #colourgrading #postproduction 
#filmmaker #indiefilm #raindance #filmfestival #colourist 
#davinciresolve #1950s #ukfilm #londonfilm
```

#### Commercial

```
🎬 Squid Campaign 2025 (2025)

After a successful collaboration with SQUID, we crafted a 
dynamic video blending motion graphics, live action, and animation.

—
🎨 Colour Grading by Lemon Post
✂️ Edit by Lemon Post
🎬 Directed by Gabriel Athanasiou

Client: Squid Loyalty
Production: Storyflow Entertainment Limited

—
Lemon Post is a post-production studio specialising in 
colour grading and editing for film, commercials, and 
branded content.

🔗 lemonpost.studio | Link in bio

#commercial #brandfilm #advertising #crowdfunding #fintech 
#motiongraphics #videoediting #colorgrading #postproduction 
#videoproduction #contentcreation #filmmaker #colourist 
#corporatevideo #dublin #londoncreatives
```

---

## Hashtag Strategy

### Base Hashtags (Always included)
```
#postproduction #colorgrading #colourgrading #filmmaker 
#cinematography #davinciresolve
```

### Dynamic Hashtags by Project Type

| Type | Hashtags |
|------|----------|
| Narrative | #shortfilm #indiefilm #filmmaking #director #cinema |
| Commercial | #commercial #brandfilm #advertising #corporatevideo #branded |
| Music Video | #musicvideo #musicvideomaker #musicvisuals #mvp |
| Documentary | #documentary #documentaryfilm #docfilm #storytelling |

### Dynamic Hashtags by Kind

| Kind | Hashtags |
|------|----------|
| Short Film | #shortfilm #shortfilmmaker #filmfestival |
| Feature Film | #featurefilm #movie #cinema |
| Fashion Film | #fashionfilm #fashionvideo #editorial #fashion |
| Corporate | #corporatevideo #brandvideo #businessvideo |
| Campaign | #campaign #digitalcampaign #marketing |

### Dynamic Hashtags by Genre

| Genre | Hashtags |
|------|----------|
| Drama | #drama #dramafilm #dramatic |
| Comedy | #comedy #comedyfilm #funny |
| Horror | #horror #horrorfilm #scary |
| Thriller | #thriller #suspense #intense |
| Period | #periodfilm #periodpiece #costume |
| Sci-Fi | #scifi #sciencefiction #futuristic |

### Dynamic Hashtags by Credits

| Credit Role | Hashtags |
|-------------|----------|
| Colourist | #colorist #colourist #colorgrading #colourgrade |
| Editor | #editor #filmeditor #videoediting #editing |
| VFX | #vfx #visualeffects #cgi #compositing |

### Location/Industry Hashtags
```
#ukfilm #londonfilm #britishfilm #londoncreatives #ukproduction
```

### Hashtag Count
- **Target**: 15-20 hashtags per post
- **Maximum**: 30 (Instagram limit)
- **Avoid**: Banned or spammy hashtags

---

## API Integration

### Instagram Graph API Endpoints

#### 1. Create Media Container (Single Image)

```javascript
POST https://graph.facebook.com/v18.0/{ig-user-id}/media

{
  "image_url": "https://cloudinary.com/...",
  "caption": "Your caption here...",
  "access_token": "{access-token}"
}
```

#### 2. Create Media Container (Carousel)

```javascript
// Step 1: Create child containers for each image
POST https://graph.facebook.com/v18.0/{ig-user-id}/media
{
  "image_url": "https://...",
  "is_carousel_item": true,
  "access_token": "{access-token}"
}
// Returns: { id: "child_container_id_1" }

// Step 2: Create carousel container
POST https://graph.facebook.com/v18.0/{ig-user-id}/media
{
  "media_type": "CAROUSEL",
  "children": ["child_id_1", "child_id_2", "child_id_3"],
  "caption": "Your caption...",
  "access_token": "{access-token}"
}
// Returns: { id: "carousel_container_id" }
```

#### 3. Publish Media

```javascript
POST https://graph.facebook.com/v18.0/{ig-user-id}/media_publish

{
  "creation_id": "{container-id}",
  "access_token": "{access-token}"
}
```

#### 4. Check Media Status

```javascript
GET https://graph.facebook.com/v18.0/{container-id}?fields=status_code

// status_code can be:
// - EXPIRED
// - ERROR
// - FINISHED
// - IN_PROGRESS
// - PUBLISHED
```

### API Utility Functions

```typescript
// utils/instagramAPI.ts

export async function createImageContainer(
  imageUrl: string, 
  caption: string
): Promise<string> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${IG_USER_ID}/media`,
    {
      method: 'POST',
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption,
        access_token: ACCESS_TOKEN
      })
    }
  );
  const data = await response.json();
  return data.id;
}

export async function createCarouselPost(
  imageUrls: string[],
  caption: string
): Promise<string> {
  // Create child containers
  const childIds = await Promise.all(
    imageUrls.slice(0, 10).map(url => 
      createCarouselItem(url)
    )
  );
  
  // Create carousel container
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${IG_USER_ID}/media`,
    {
      method: 'POST',
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: childIds,
        caption: caption,
        access_token: ACCESS_TOKEN
      })
    }
  );
  
  const data = await response.json();
  return data.id;
}

export async function publishMedia(
  containerId: string
): Promise<string> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${IG_USER_ID}/media_publish`,
    {
      method: 'POST',
      body: JSON.stringify({
        creation_id: containerId,
        access_token: ACCESS_TOKEN
      })
    }
  );
  
  const data = await response.json();
  return data.id;
}
```

---

## Rate Limits & Best Practices

### Instagram API Limits

| Limit | Value | Notes |
|-------|-------|-------|
| API calls | 200/hour/user | All Graph API endpoints combined |
| Content publishing | 25 posts/day | Photos + Carousels + Reels |
| Carousel items | 10 images max | Per carousel post |
| Scheduling ahead | 75 days max | Future scheduling limit |
| Min schedule time | 10 minutes | From current time |

### Best Practices

1. **Posting Frequency**
   - Optimal: 1-2 posts per day
   - Maximum: 3-4 posts per day
   - Avoid: More than 25/day (API limit)

2. **Optimal Posting Times** (UK timezone)
   - Weekdays: 11am-1pm, 7pm-9pm
   - Weekends: 10am-11am
   - Best days: Tuesday, Wednesday, Friday

3. **Caption Best Practices**
   - First line is crucial (appears in preview)
   - Use line breaks for readability
   - Call-to-action at the end
   - Hashtags at the end or in first comment

4. **Image Requirements**
   - Aspect ratios: 1:1 (square), 4:5 (portrait), 1.91:1 (landscape)
   - Minimum resolution: 1080px width
   - Format: JPEG, PNG
   - Max file size: 8MB

5. **Rate Limit Handling**
   ```typescript
   async function publishWithRateLimit(posts: Post[]) {
     for (const post of posts) {
       await publishPost(post);
       // Wait 3 seconds between API calls
       await new Promise(r => setTimeout(r, 3000));
     }
   }
   ```

---

## Future Enhancements

### Multi-Account Support (Planned)
> **Priority Feature**: Support for managing multiple Instagram accounts from one dashboard

| Account | Type | Data Source | Status |
|---------|------|-------------|--------|
| @lemonpost.studio | Post-Production Studio | `portfolio-data-postproduction.json` | 🟢 Active |
| @gabriel.athanasiou (Director) | Director/Filmmaker | `portfolio-data-directing.json` | 🔜 Planned |

**Implementation Notes:**
- [ ] Account switcher in header/sidebar
- [ ] Separate schedule data per account (Cloudinary)
- [ ] Account-specific templates and hashtag libraries
- [ ] Unified calendar view with color-coded accounts
- [ ] Per-account API credentials storage

### AI-Powered Features
- [ ] GPT-generated caption variations
- [ ] Hashtag relevance scoring
- [ ] Optimal posting time predictions
- [ ] Content performance predictions

### Multi-Platform Support
- [ ] Twitter/X integration
- [ ] LinkedIn integration
- [ ] Facebook Page integration
- [ ] TikTok integration

### Advanced Scheduling
- [ ] Content calendar export (Google Calendar, iCal)
- [ ] Team collaboration features
- [ ] Approval workflows
- [ ] Content recycling

### Analytics Dashboard
- [ ] Engagement metrics
- [ ] Follower growth tracking
- [ ] Best performing content analysis
- [ ] Competitor analysis

---

## Quick Start Commands

```bash
# Navigate to Instagram Studio
cd scripts/instagram-studio

# Install dependencies
npm install

# Run locally
npm run dev
# Opens at http://localhost:5174

# Build for production
npm run build

# Deploy to Netlify (include [deploy] in commit message)
git add -A
git commit -m "feat: Your changes [deploy]"
git push origin main
```

### Accessing the App

1. **Production**: Go to https://studio.lemonpost.studio
2. **Enter password** when prompted
3. **Check "Remember Me"** to stay logged in for 7 days
4. Data automatically syncs from Cloudinary on load

### Making Changes

1. Edit schedules, templates, or settings in the app
2. Click **"Sync to Cloud ☁️↑"** to save to Cloudinary
3. Access from any device - data persists in the cloud

---

## Checklist Before Going Live

- [x] Instagram Studio app built and tested
- [x] Cloudinary sync working (signed uploads)
- [x] Password protection enabled
- [x] Deployed to Netlify
- [x] Custom domain configured (studio.lemonpost.studio)
- [x] Environment variables set
- [x] Deploy gate active ([deploy] required)
- [x] Instagram account converted to Business/Creator ✅
- [x] Facebook Page created and linked ✅
- [x] Meta Developer account set up ✅
- [x] Meta App created with Instagram Graph API ✅
- [x] Access tokens generated ✅
- [x] Instagram Business Account ID obtained ✅
- [x] OAuth flow implemented ✅
- [x] Publishing features built ✅
- [x] Rate limit management added ✅
- [ ] Test post successful (manual verification needed)

### Current API Credentials

| Credential | Value | Notes |
|------------|-------|-------|
| Instagram App ID | `1386961439465356` | SocialUpload-Studio-IG |
| Instagram Account ID | `24965197513162722` | @lemonpoststudio |
| Redirect URL | `https://studio.lemonpost.studio/auth/callback` | For OAuth flow |
| Token Expiry | ~60 days | Auto-refresh via OAuth |

---

## Support & Resources

- [Instagram Graph API Documentation](https://developers.facebook.com/docs/instagram-api)
- [Meta for Developers](https://developers.facebook.com/)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Instagram Content Publishing](https://developers.facebook.com/docs/instagram-api/guides/content-publishing)

---

*Last Updated: 5 December 2025*
*Version: 1.3.1 - Fixed Cloudinary image URL building (uses projectId + index pattern)*
