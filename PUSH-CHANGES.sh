#!/bin/bash
# Push all changes to GitHub

cd "$(dirname "$0")"

echo "📦 Staging all changes..."
git add -A

echo ""
echo "📋 Changes to commit:"
git status --short

echo ""
echo "📝 Committing..."
git commit -m "Remove Quest Card from public access, fix logo and navigation

- Remove Get Quest Card button from index.html
- Add noindex to get-card.html (private page for users only)
- Block get-card.html and QuestCard.pkpass in robots.txt
- Fix logo to use Quests Logo.svg
- Fix all navigation links across site
- Add brand name text to index.html header"

echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Done! Changes deployed to https://thequestsapp.com"


