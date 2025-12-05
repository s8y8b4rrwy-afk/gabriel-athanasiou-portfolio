# 🍋 Lemon Post Instagram Studio - Implementation Plan

> A comprehensive tool for generating, previewing, and scheduling Instagram posts from your portfolio data.

---

## Table of Contents

1. [Overview](#overview)
2. [Instagram Account Setup](#instagram-account-setup)
3. [Architecture](#architecture)
4. [Implementation Phases](#implementation-phases)
5. [Technical Specifications](#technical-specifications)
6. [Post Format & Templates](#post-format--templates)
7. [Hashtag Strategy](#hashtag-strategy)
8. [API Integration](#api-integration)
9. [Rate Limits & Best Practices](#rate-limits--best-practices)
10. [Future Enhancements](#future-enhancements)

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
- [ ] Drag & drop scheduling
- [x] Time slot management
- [x] Schedule queue view
- [x] Optimal posting times suggestions
- [x] Edit scheduled posts
- [x] View scheduled posts per project
- [x] Schedule status filter (scheduled/published/unscheduled)
- [x] Enhanced metadata search (title, description, client, type, kinds, genre, credits, awards)
- [x] Cloudinary image integration (automatic Airtable → Cloudinary URL conversion)
- [ ] Export schedule to CSV/JSON
- [ ] Recurring post templates

#### Deliverables:
- ✅ Visual calendar with scheduled posts
- ✅ Ability to plan content weeks in advance
- ✅ Schedule data persisted in local storage
- ✅ Edit and manage scheduled posts from project view
- ✅ Filter projects by schedule status
- ✅ All images served via Cloudinary CDN

---

### Phase 3: Instagram API Integration
**Timeline: 2-3 days**

#### Features:
- [ ] OAuth connection flow
- [ ] Publish single image posts
- [ ] Publish carousel posts (up to 10 images)
- [ ] Scheduled publishing (via API)
- [ ] Post status tracking
- [ ] Error handling & retry logic
- [ ] Rate limit management

#### Deliverables:
- One-click publish to Instagram
- Automated scheduled posting
- Status dashboard for posted content

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
# Navigate to project
cd /path/to/gabriel-athanasiou-portfolio

# Install dependencies (after Phase 1 setup)
cd scripts/instagram-studio && npm install

# Run Instagram Studio
npm run instagram-studio

# Build for production
npm run instagram-studio:build
```

---

## Checklist Before Going Live

- [ ] Instagram account converted to Business/Creator
- [ ] Facebook Page created and linked
- [ ] Meta Developer account set up
- [ ] Meta App created with Instagram Graph API
- [ ] Access tokens generated and stored securely
- [ ] Instagram Business Account ID obtained
- [ ] `.env` file configured
- [ ] Test post successful

---

## Support & Resources

- [Instagram Graph API Documentation](https://developers.facebook.com/docs/instagram-api)
- [Meta for Developers](https://developers.facebook.com/)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Instagram Content Publishing](https://developers.facebook.com/docs/instagram-api/guides/content-publishing)

---

*Last Updated: December 2025*
*Version: 1.0.0*
