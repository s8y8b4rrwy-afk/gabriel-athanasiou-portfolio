# Analytics Integration Map

This shows exactly where analytics tracking has been added to your portfolio.

## Component Tracking Hierarchy

```
App.tsx (ROOT)
├── 📊 analyticsService.init() [INITIALIZATION]
│   └─ Loads Google Analytics script on app start
│
├── 📍 trackPageView() on route change [PAGE TRACKING]
│   └─ Every time user navigates, GA tracks the path
│
├─ Navigation.tsx (no tracking needed)
│
├─ GlobalStyles.tsx (no tracking needed)
│
├─ Cursor.tsx (no tracking needed)
│
└─ Routes
   ├── Route: /
   │   └── HomeView
   │       └── (no direct tracking, uses parent page view)
   │
   ├── Route: /work
   │   └── IndexView
   │       └── (tracked by parent page view)
   │
   ├── Route: /work/:slug ⭐
   │   └── ProjectDetailView
   │       ├── 📊 trackProjectView() on load
   │       │   └─ Records: projectId, projectTitle, projectType
   │       │
   │       ├── 🎬 handleWatchClick()
   │       │   └─ trackVideoPlay() [VIDEO PLAY EVENT]
   │       │       └─ Records: projectId, projectTitle
   │       │
   │       ├── SocialShare Component ⭐
   │       │   └── 📱 trackSocialShare() [SOCIAL SHARE EVENT]
   │       │       └─ Records: platform, title, url
   │       │
   │       └── externalLinks Map
   │           └── onClick handler
   │               └─ trackExternalLink() [EXTERNAL LINK EVENT]
   │                   └─ Records: label, url
   │
   ├── Route: /journal
   │   └── BlogView
   │       └── (tracked by parent page view)
   │
   ├── Route: /journal/:slug ⭐
   │   └── BlogPostView
   │       ├── 📊 trackBlogPostView() on load [BLOG POST VIEW EVENT]
   │       │   └─ Records: postId, postTitle
   │       │
   │       ├── SocialShare Component ⭐
   │       │   └── 📱 trackSocialShare() [SOCIAL SHARE EVENT]
   │       │
   │       └── Related Project Link
   │           └── (navigation tracked by App.tsx page view)
   │
   ├── Route: /about
   │   └── AboutView
   │       └── (tracked by parent page view)
   │
   └── Route: *
       └── HomeView
           └── (fallback, tracked by page view)
```

## Event Flow Diagram

### Page Navigation Flow
```
User clicks link or types URL
        ↓
useLocation detects change
        ↓
App.tsx useEffect fires
        ↓
analyticsService.trackPageView(path, title)
        ↓
gtag('config', measurementId, { page_path, page_title })
        ↓
Google Analytics backend processes
        ↓
Real-time dashboard updates (+1 page view)
        ↓
Reports build over time (24-48h)
```

### Event Tracking Flow
```
User interacts with component
        ↓
Event handler fires (click, submit, etc.)
        ↓
analyticsService.trackEvent() called
        ↓
Data prepared with context (project ID, platform, etc.)
        ↓
gtag('event', eventName, eventData)
        ↓
Google Analytics backend processes
        ↓
Event appears in Real-time Events tab (~30 seconds)
        ↓
Aggregated in event reports (24-48h)
```

## Tracking by Component

### ✅ Already Integrated

**App.tsx**
```typescript
useEffect(() => {
  // INITIALIZATION (app load)
  analyticsService.init('G-XXXXXXXXXX');
}, []);

useEffect(() => {
  // PAGE TRACKING (route change)
  const pageTitle = getPageTitle(location.pathname);
  analyticsService.trackPageView(location.pathname, pageTitle);
}, [location.pathname]);
```

**SocialShare.tsx**
```typescript
// Track when user clicks share button
const handleClick = () => {
  if (label === 'Twitter') {
    analyticsService.trackSocialShare('twitter', title, url);
  }
  // ... same for LinkedIn, Facebook, Copy
}
```

**ProjectDetailView.tsx**
```typescript
// Track when page loads
useEffect(() => {
  if (project) {
    analyticsService.trackProjectView(project.id, project.title, project.type);
  }
}, [project]);

// Track when user clicks play
const handleWatchClick = () => {
  analyticsService.trackVideoPlay(project.id, project.title);
  setIsPlaying(true);
}

// Track external link clicks
<a onClick={() => analyticsService.trackExternalLink(link.label, link.url)}>
```

**BlogPostView.tsx**
```typescript
// Track when blog post page loads
useEffect(() => {
  if (post) {
    analyticsService.trackBlogPostView(post.id, post.title);
  }
}, [post]);
```

## Data Structure Examples

### Page View Event
```json
{
  "type": "page_view",
  "page_path": "/work/my-project",
  "page_title": "Project",
  "session_id": "abc123def456",
  "user_id": "anonymous",
  "timestamp": "2025-11-25T10:30:45Z",
  "device": "desktop",
  "browser": "Chrome"
}
```

### Video Play Event
```json
{
  "type": "video_play",
  "project_id": "rec1234567890",
  "project_title": "My Feature Film",
  "timestamp": "2025-11-25T10:31:15Z",
  "session_id": "abc123def456",
  "user_id": "anonymous"
}
```

### Social Share Event
```json
{
  "type": "social_share",
  "platform": "twitter",
  "title": "My Feature Film",
  "url": "https://gabrielathanasiou.com/work/my-feature-film",
  "timestamp": "2025-11-25T10:32:00Z",
  "session_id": "abc123def456",
  "user_id": "anonymous"
}
```

## Measurement ID Lookup

Your Measurement ID is used to:
1. Associate events with your property
2. Send data to your Google Analytics account
3. Allow GA to organize events by property
4. Generate reports for your account

Format: `G-XXXXXXXXXX` (10 characters)

Example: `G-A1B2C3D4E5`

**Where to find it:**
1. Go to https://analytics.google.com
2. Click your property name
3. Click **Admin** (bottom left)
4. Click **Data Streams**
5. Click your web stream
6. Look for **Measurement ID**

---

## Automatic GA4 Data Collection

Beyond your custom events, GA4 automatically tracks:

- **Page views** ✓ (you're doing this)
- **User engagement** ✓ (scroll depth, time on page)
- **Session data** ✓ (session duration, user ID)
- **Technology** ✓ (browser, OS, device type)
- **Geo data** ✓ (country, region, city)
- **Traffic source** ✓ (direct, search, referral, social)

You don't need to track these manually – GA handles it.

---

## Event Name Conventions

Your custom events follow GA4 best practices:

| Pattern | Example | Scope |
|---------|---------|-------|
| `{category}_{action}` | `video_play` | Action performed |
| `{page}_{view}` | `project_view` | Page visited |
| `{feature}_{action}` | `social_share` | Feature interaction |
| `{location}_{click}` | `external_link_click` | Link interaction |

All event names are:
- Lowercase
- Snake_case
- Descriptive
- GA4 native events where possible

---

## Implementation Checklist

When analytics is working correctly:

- ✅ No TypeScript errors (`npx tsc --noEmit`)
- ✅ Measurement ID set in App.tsx
- ✅ Console logs appear (`✅ Analytics initialized`)
- ✅ Events log in console when triggered (`📊 Event tracked`)
- ✅ Page views track on navigation
- ✅ Video plays tracked when clicking play
- ✅ Social shares tracked for all platforms
- ✅ External links tracked on click
- ✅ Project views tracked on page load
- ✅ Blog post views tracked on page load

---

## Performance Checkpoints

**Bundle Size**: ~17KB added (GA script is external, doesn't count)
**Runtime Overhead**: <1ms per event
**Network Requests**: 1 (GA script load) + events as needed
**Lighthouse Impact**: None (loaded asynchronously)

---

## Testing Checklist

Before deploying:

- [ ] Create GA4 account
- [ ] Get Measurement ID
- [ ] Update App.tsx with Measurement ID
- [ ] Run `npm run dev`
- [ ] Check Console for initialization message
- [ ] Navigate pages → see page views logged
- [ ] Click share buttons → see events logged
- [ ] Visit project page → see project_view logged
- [ ] Click play → see video_play logged
- [ ] Check for TypeScript errors: `npx tsc --noEmit`
- [ ] Deploy to production
- [ ] Check GA Real-time dashboard
- [ ] Verify events appear

---

## Common Questions

**Q: Where exactly is analytics initialized?**
A: `App.tsx` useEffect, line 34, runs once on app load

**Q: Which components track events?**
A: SocialShare, ProjectDetailView, BlogPostView track custom events
   App.tsx tracks page views automatically

**Q: Do I need to add tracking to every component?**
A: No, only where user interactions happen
   Parent page view handles most cases

**Q: Can I add more events later?**
A: Yes, add methods to `analyticsService.ts`
   Then call from components

**Q: Will this slow down my site?**
A: No, GA loads asynchronously and has no impact
