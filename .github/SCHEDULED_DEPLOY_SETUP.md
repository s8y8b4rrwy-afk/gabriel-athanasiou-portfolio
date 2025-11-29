# Manual Data Sync Setup

> **⚠️ Note:** Automatic scheduled syncing is **disabled** to conserve Airtable API credits. Use manual triggers only.

This workflow syncs data from Airtable and deploys to Netlify **on-demand** (manual trigger only).

## Setup Instructions

### 1. Create a Netlify Build Hook

1. Go to your Netlify site dashboard: https://app.netlify.com
2. Navigate to **Site settings → Build & deploy → Build hooks**
3. Click **Add build hook**
4. Name it: `Manual Deploy`
5. Copy the generated webhook URL (looks like: `https://api.netlify.com/build_hooks/xxxxx`)

### 2. Add Build Hook to GitHub Secrets

1. Go to your GitHub repo: https://github.com/s8y8b4rrwy-afk/gabriel-athanasiou-portfolio
2. Click **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Name: `NETLIFY_BUILD_HOOK`
5. Value: Paste just the hook ID (the part after `build_hooks/`)
   - Example: If your URL is `https://api.netlify.com/build_hooks/abc123xyz`, enter `abc123xyz`
6. Click **Add secret**

### 2.1 Enable Airtable Data Sync

To sync content from Airtable, add these repository secrets:

- `AIRTABLE_API_KEY` – Your Airtable Personal Access Token
- `AIRTABLE_BASE_ID` – The Base ID containing your content tables

### 3. Verify Setup

1. Go to **Actions** tab in your GitHub repo
2. Find **Manual Data Sync (Airtable + Deploy)** workflow
3. Click **Run workflow** → **Run workflow** to test manually
4. Check the logs to confirm data syncs correctly

## How It Works

- **Trigger**: Manual only (via GitHub Actions UI)
- **Smart Detection**: Only deploys if content changes detected
- **API Conservation**: No automatic syncing = no unnecessary API calls
- **Credit Saving**: Skips deploy if no changes = no wasted build minutes

## Why Manual Only?

Automatic scheduled syncing was disabled to:

1. **Conserve Airtable API credits** - API calls are limited per month
2. **Give developers control** - Sync only when content actually changes
3. **Avoid unnecessary builds** - Prevent wasted Netlify build minutes

## How to Trigger a Sync

1. Go to the **Actions** tab in your GitHub repository
2. Select **"Manual Data Sync (Airtable + Deploy)"** from the workflow list
3. Click **"Run workflow"** dropdown button
4. Optionally enter a reason for the sync
5. Click **"Run workflow"** to start

## Re-enabling Automatic Sync (Not Recommended)

If you need to re-enable automatic scheduled syncing, edit `.github/workflows/scheduled-deploy.yml` and uncomment the schedule section:

```yaml
on:
  schedule:
    - cron: '0 3 * * 0'  # Sunday 3 AM UTC (weekly)
  workflow_dispatch:
    # ... rest of config
```

**Warning:** This will increase Airtable API usage and may exceed your credit limits.
