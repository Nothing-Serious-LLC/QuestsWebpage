#!/bin/bash
# Commit and push the working Wallet pass

cd "$(dirname "$0")"

echo "📦 Staging all changes..."
git add -A

echo ""
echo "📝 Committing..."
git commit -m "Rebuild Wallet pass with correct structure - now working!

- Fixed zip structure (files at root, not in subdirectory)
- Pass now validates correctly and installs on iPhone
- Added primary field for proper pass recognition
- Fixed signature and certificate handling"

echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Done! Your Wallet pass is now live!"
echo "   Test at: https://thequestsapp.com/get-card.html"
