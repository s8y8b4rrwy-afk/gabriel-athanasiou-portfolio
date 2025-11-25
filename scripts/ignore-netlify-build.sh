#!/usr/bin/env bash
# Netlify Ignore Build Script
# Skips builds unless commit message contains [deploy] or [force-deploy]

set -e

# Fetch latest commit message (ensure git present in build image)
COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null || echo "")

if echo "$COMMIT_MSG" | grep -Ei '\[deploy\]|\[force-deploy\]'; then
  echo "Deploy marker found in commit message. Proceeding with build."
  # Exit non-zero so Netlify DOES run the build
  exit 1
fi

echo "No deploy marker found. Skipping Netlify build to prevent automatic deployment."
# Exit 0 causes Netlify to skip the build
exit 0
