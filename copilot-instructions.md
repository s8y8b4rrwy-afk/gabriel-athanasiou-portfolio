# Copilot Instructions (Alias)

This file is an alias for AI assistants. The canonical guide is `AI_AGENT_GUIDE.md` at the repo root. If you're an AI agent, you MUST read and follow that document.


My domains are: 
- directedbygabriel.com for the directing portfolio
- lemonpost.studio for the post production portfolio
- studio.lemonpost.studio for the Instagram Studio App

Quick essentials (do not skip the full guide):

- Documentation-first workflow: update `AI_AGENT_GUIDE.md` after any change.
- Procedural hero fallback:
  - Use `useProceduralThumbnail(title, year, type, undefined, undefined, { showTitle: false, showMetadata: false })` for a clean, textless hero.
  - Procedural slides apply subtle animation (`hero-anim`) and overlay (`hero-anim-gradient`) from `GlobalStyles.tsx`.
  - For Next Project fallback, call `generateProceduralThumbnail()` with `showTitle=false`, `showMetadata=false` when no hero image/video exists.
- CTA behavior:
  - If no hero video, show a CTA button that navigates to `/about` and track `contact_cta_click` via `analyticsService`.
  - Mobile: Center CTA (`absolute inset-0 flex items-center justify-center`).
  - md+: Place CTA bottom-right (`md:bottom-24 md:right-12`).
- Keep files in sync when touching these:
  - `components/views/ProjectDetailView.tsx`
  - `components/GlobalStyles.tsx`
  - `components/ProceduralThumbnail.tsx`
  - `utils/thumbnailGenerator.ts`
  - Docs in `docs/` and root summaries

Canonical reference: see `AI_AGENT_GUIDE.md` for architecture, workflows, and full details.
