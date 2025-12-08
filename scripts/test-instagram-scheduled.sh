#!/bin/zsh

# Instagram Studio Scheduled Publishing Diagnostic Script
# Run this locally to check if scheduled posts are set up correctly

echo "🔍 Instagram Studio Scheduled Publishing Diagnostic"
echo "=================================================="
echo ""
echo "This script will check:"
echo "  1. If the scheduled function is deployed"
echo "  2. What's in your Cloudinary schedule data"
echo "  3. If Instagram is connected"
echo "  4. What pending posts exist"
echo ""

# Get the site URL from package.json or ask user
SITE_URL="${1:-https://lemonpost.studio}"

echo "📡 Using site URL: $SITE_URL"
echo ""

# Call the diagnostic function
echo "Fetching diagnostic information..."
echo ""

RESPONSE=$(curl -s "$SITE_URL/.netlify/functions/instagram-diagnostic")

echo "📋 Diagnostic Results:"
echo "===================="
echo ""
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "✅ Diagnostic complete"
echo ""
echo "Next steps:"
echo "1. Review the output above to identify issues"
echo "2. If Instagram is not connected, go to https://studio.lemonpost.studio and connect Instagram"
echo "3. If you have pending posts but they're not publishing:"
echo "   - Check that your scheduled time is in the past (within last hour)"
echo "   - Check Netlify function logs for errors"
echo "4. To manually trigger the scheduled publish, visit:"
echo "   https://lemonpost.studio/.netlify/functions/instagram-scheduled-publish"
