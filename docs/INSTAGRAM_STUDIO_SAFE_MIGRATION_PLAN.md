# Instagram Studio — Safe Server-Side Migration Plan

**Date:** 16 Dec 2025  
**Goal:** Centralize Instagram server-side (cron + publish endpoints) under **Studio** (`studio.lemonpost.studio`) using a *safe, incremental* approach.

---

## 0) Why this is needed

We have the scheduled publisher implemented in-repo (`netlify/functions/instagram-scheduled-publish.mjs`) and configured as a Netlify Scheduled Function:

- `export const config = { schedule: '0 * * * *' }` → **hourly**

However, production tests against `lemonpost.studio/.netlify/functions/instagram-publish-now` returned HTML/404/edge behavior inconsistent with the function’s JSON handler. That strongly suggests the functions are **not deployed/owned by the expected site**.

Centralizing the Instagram server-side into the Studio site removes ambiguity about ownership and ensures the cron actually runs where it should.

---

## 1) Requirements / Success criteria

### Functional
- `POST https://studio.lemonpost.studio/.netlify/functions/instagram-publish-now` returns JSON from our handler.
- `instagram-scheduled-publish` runs hourly (or near-hourly) and appears in Netlify function logs.
- Due posts are published and schedule data is updated.

### Safety
- Main portfolio sites (directing + postproduction) must remain unaffected.
- Migration must be **copy-first** (no deletions until Studio is verified in production).
- Introduce guardrails that prevent noisy failures if Instagram is not connected.

---

## 2) Scope: what moves to Studio

### Must-have server-side functions
- `instagram-scheduled-publish.mjs` (cron)
- `instagram-publish-now.mjs` (manual trigger for testing)

### Likely needed by Studio UI (depending on current usage)
- `instagram-auth.mjs`
- `instagram-publish.mjs`
- `instagram-diagnostic.mjs`
- Any other `instagram-*` Netlify functions referenced by Studio front-end

---

## 3) Approach: “Safe Options” (recommended)

### Option A (Safest): Studio owns all Instagram server-side
- Create a Studio-owned Netlify Functions bundle (separate from root).
- Deploy those functions with the Studio site only.
- Keep existing root functions in place during rollout (no breaking changes).

---

## 4) Implementation plan (phased)

### Phase 1 — Inventory + wiring
1. Identify all `netlify/functions/instagram-*.mjs` endpoints.
2. Identify which endpoints the Studio frontend calls (search for `/.netlify/functions/instagram-` usage).
3. Decide minimum set for v1 (cron + manual trigger) vs “nice to have” endpoints.

**Deliverable:** a list of function files that will be included in Studio deploy.

---

### Phase 2 — Create Studio-specific Netlify configuration
1. Add a Studio-specific `netlify.toml` (or equivalent) under `scripts/instagram-studio/`.
2. Configure:
   - build command (Studio build)
   - publish directory (Studio dist)
   - functions directory (Studio-owned functions folder)

**Safety rule:** do not modify/remove root `netlify.toml` in this phase.

**Deliverable:** Studio can be deployed independently with its own functions bundle.

---

### Phase 3 — Copy functions into Studio-owned functions bundle
1. Create `scripts/instagram-studio/netlify/functions/`.
2. Copy required server-side function files into that folder.
3. Ensure imports and Node compatibility are correct.
4. Add a lightweight response marker header for verification (optional):
   - `X-Function-Owner: studio`

**Deliverable:** Studio functions exist in a deployable directory without changing the original root functions.

---

### Phase 4 — Local verification
1. Run Studio locally with Netlify dev targeting the Studio config.
2. Verify:
   - `POST http://localhost:8888/.netlify/functions/instagram-publish-now` returns JSON
   - Logs show it reads schedule data and evaluates due window

**Optional:** add a tiny smoke test script to curl endpoints.

**Deliverable:** verified JSON response locally.

---

### Phase 5 — Production deploy (Studio)
1. Push changes.
2. Deploy Studio site.
3. Verify:
   - `POST https://studio.lemonpost.studio/.netlify/functions/instagram-publish-now` returns JSON
   - Scheduled function runs hourly (check Netlify logs).

**Deliverable:** confirmed endpoint + confirmed scheduled executions in logs.

---

### Phase 6 — Guardrails (safe operations)
Add safe behavior to avoid cron spam and provide debug-friendly results:
- If Instagram not connected / missing access token → return `200` with `{ ok: true, skipped: true, reason: 'not_connected' }`.
- Add optional `DRY_RUN` mode (env var or query string for manual trigger) that logs what would publish.

**Deliverable:** stable cron behavior even when not connected.

---

### Phase 7 — Cleanup (only after Studio is verified)
1. Decide whether to:
   - Keep root instagram functions as legacy (disabled), or
   - Remove them to prevent confusion.
2. Update docs to reflect final architecture.

**Deliverable:** single source of truth: Studio owns Instagram server-side.

---

## 5) Environment variables (Studio site)

At minimum (based on existing server-side code):
- `CLOUDINARY_CLOUD_NAME` (if required)
- `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` (if using signed upload/update)
- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- Any existing publish token storage keys used by schedule data (e.g. stored inside Cloudinary raw JSON)

Optional:
- `RESEND_API_KEY`
- `NOTIFICATION_EMAIL`

---

## 6) Observability / debugging

### Quick manual test
```bash
curl -i -X POST "https://studio.lemonpost.studio/.netlify/functions/instagram-publish-now"
```
Expected:
- `Content-Type: application/json`
- Body includes something like `{"ok":true,...}`

### Scheduled function verification
- Use Netlify function logs for `instagram-scheduled-publish`.
- Confirm log entries near the top of each hour.

---

## 7) Acceptance checklist
- [ ] Studio deploy includes `instagram-scheduled-publish` and it runs on schedule
- [ ] Manual endpoint returns JSON on `studio.lemonpost.studio`
- [ ] No regressions to portfolio sites
- [ ] Docs updated to reflect Studio ownership
