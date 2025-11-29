# Scheduled Netlify Deploy Setup

This workflow deploys to Netlify weekly (or on-demand) **only if there are code changes**, saving build credits.

## ⚠️ Important: Static File Generation is Now Separate

As of the recent update, static file generation (portfolio-data.json, share-meta.json, sitemap.xml) is handled by a **separate workflow**: `Generate Static Files`.

- See [Static File Generation Documentation](../docs/STATIC_FILE_GENERATION.md) for details
- Run the static file generation workflow first if you need to update content

## Setup Instructions

### 1. Create a Netlify Build Hook

1. Go to your Netlify site dashboard: https://app.netlify.com
2. Navigate to **Site settings → Build & deploy → Build hooks**
3. Click **Add build hook**
4. Name it: `Scheduled Deploy`
5. Copy the generated webhook URL (looks like: `https://api.netlify.com/build_hooks/xxxxx`)

### 2. Add Build Hook to GitHub Secrets

1. Go to your GitHub repo: https://github.com/s8y8b4rrwy-afk/gabriel-athanasiou-portfolio
2. Click **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Name: `NETLIFY_BUILD_HOOK`
5. Value: Paste just the hook ID (the part after `build_hooks/`)
   - Example: If your URL is `https://api.netlify.com/build_hooks/abc123xyz`, enter `abc123xyz`
6. Click **Add secret**

### 2.1 Add Netlify API Credentials (for deployment status checking)

For the workflow to monitor deployment status:

- `NETLIFY_AUTH_TOKEN` – Your Netlify Personal Access Token
- `NETLIFY_SITE_ID` – Your Netlify Site ID

### 3. Verify Setup

1. Go to **Actions** tab in your GitHub repo
2. Find **Smart Netlify Deploy (Code Changes Only)** workflow
3. Click **Run workflow** → **Run workflow** to test manually
4. Check the logs to confirm it detects changes correctly

## How It Works

- **Schedule**: Runs every Sunday at 3 AM UTC
- **Smart Detection**: Only deploys if commits exist since last successful deploy
- **Manual Trigger**: Can be triggered anytime from the Actions tab
- **Credit Saving**: Skips deploy if no changes = no wasted build minutes
- **Uses Pre-generated Files**: Deployment uses static files already in the repository

### Workflow Separation

```
┌─────────────────────────────────┐
│  Generate Static Files          │
│  (generate-static-files.yml)    │
│  - Daily at 2 AM UTC            │
│  - Or manual trigger            │
└───────────────┬─────────────────┘
                │
                ▼
        Version-controlled
        static files in repo
                │
                ▼
┌─────────────────────────────────┐
│  Smart Netlify Deploy           │
│  (scheduled-deploy.yml)         │
│  - Weekly at 3 AM UTC           │
│  - Or manual trigger            │
│  - Uses pre-generated files     │
└─────────────────────────────────┘
```

## Customize Schedule

Edit `.github/workflows/scheduled-deploy.yml` and change the cron expression:

```yaml
schedule:
  - cron: '0 3 * * 0'  # Sunday 3 AM UTC
```

Examples:
- Daily at midnight: `'0 0 * * *'`
- Every 3 days: `'0 0 */3 * *'`
- Bi-weekly (1st & 15th): `'0 0 1,15 * *'`

## Disable Auto-Deploy on Push

To **only** use scheduled deploys (no auto-build on every push):

1. Go to Netlify dashboard → **Site settings → Build & deploy**
2. Under **Build settings**, click **Stop builds**
3. Or set **Deploy contexts** to only production branch manually

This gives you full control over when builds happen.
