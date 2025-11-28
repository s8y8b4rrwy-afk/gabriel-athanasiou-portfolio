#!/usr/bin/env bash
# Netlify Ignore Build Script
# Optimizes build minutes by controlling when builds run

set -e

# Get current branch name
BRANCH=${HEAD:-"unknown"}

# Get commit message
COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null || echo "")

# Always build on main branch (production)
if [ "$BRANCH" = "main" ]; then
  echo "✅ Production branch (main) - proceeding with build"
  exit 1
fi

# Always build deploy previews (pull requests)
if [ "$CONTEXT" = "deploy-preview" ]; then
  echo "✅ Deploy preview (PR) - proceeding with build"
  exit 1
fi

# For feature branches: only build if [deploy] or [force-deploy] in commit message
if echo "$COMMIT_MSG" | grep -Ei '\[deploy\]|\[force-deploy\]'; then
  echo "✅ Deploy marker found in commit message - proceeding with build"
  exit 1
fi

# Skip all other builds (feature branches without deploy marker)
echo "⏭️  Feature branch without deploy marker - skipping build to save build minutes"
exit 0
