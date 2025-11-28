#!/usr/bin/env bash
# Netlify Ignore Build Script
# Optimizes build minutes by controlling when builds run

set -e

# Get current branch name
BRANCH=${HEAD:-"unknown"}

# Get commit message
COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null || echo "")

# Always build deploy previews (pull requests)
if [ "$CONTEXT" = "deploy-preview" ]; then
  echo "✅ Deploy preview (PR) - proceeding with build"
  exit 1
fi

# Build on main branch ONLY if:
# 1. Commit message contains [deploy] or [force-deploy]
# 2. Triggered by scheduled-sync.mjs (commit message contains "Scheduled sync")
# 3. Triggered by GitHub Action weekly check (commit message contains "[deploy]")
if [ "$BRANCH" = "main" ]; then
  if echo "$COMMIT_MSG" | grep -Ei '\[deploy\]|\[force-deploy\]|Scheduled sync'; then
    echo "✅ Main branch with deploy marker or scheduled trigger - proceeding with build"
    exit 1
  else
    echo "⏭️  Main branch without deploy marker - skipping build (scheduled weekly check will deploy)"
    exit 0
  fi
fi

# For feature branches: only build if [deploy] or [force-deploy] in commit message
if echo "$COMMIT_MSG" | grep -Ei '\[deploy\]|\[force-deploy\]'; then
  echo "✅ Deploy marker found in commit message - proceeding with build"
  exit 1
fi

# Skip all other builds
echo "⏭️  Skipping build to save build minutes"
exit 0
