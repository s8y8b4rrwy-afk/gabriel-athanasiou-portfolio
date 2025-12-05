#!/usr/bin/env bash
# Netlify Ignore Build Script for Instagram Studio
# Only deploy when commit message contains [deploy]

set -e

# Get commit message
COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null || echo "")

# Always build deploy previews (pull requests)
if [ "$CONTEXT" = "deploy-preview" ]; then
  echo "✅ Deploy preview (PR) - proceeding with build"
  exit 1
fi

# Only build if commit message contains [deploy]
if echo "$COMMIT_MSG" | grep -Ei '\[deploy\]|\[force-deploy\]'; then
  echo "✅ Deploy marker found - proceeding with build"
  exit 1
else
  echo "⏭️  No deploy marker - skipping build"
  echo "   Add [deploy] to your commit message to trigger a build"
  exit 0
fi
