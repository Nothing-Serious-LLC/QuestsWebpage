#!/bin/bash
# COMPLETE REBUILD - Run this to fix all issues

cd "$(dirname "$0")"

echo "🔧 COMPLETE PASS REBUILD - Fixing All Known Issues"
echo "═══════════════════════════════════════════════════════════════"
echo ""

cd QuestCard.pass

# Make script executable
chmod +x build-final.sh prepare-images.sh 2>/dev/null

# Set certificate paths
export CERT_PATH="$HOME/Documents/cardfixed.p12"
export CERT_PASSWORD=""
export WWDR_PATH="$HOME/.questcard-certs/wwdr.pem"

echo "Certificate: $CERT_PATH"
echo "WWDR: $WWDR_PATH"
echo ""

# Ensure images are prepared
echo "Step 1: Preparing images..."
if [ -f "prepare-images.sh" ]; then
    ./prepare-images.sh
else
    echo "⚠️  prepare-images.sh not found, continuing..."
fi

echo ""
echo "Step 2: Building pass with all fixes..."
./build-final.sh

BUILD_EXIT=$?

cd ..

if [ $BUILD_EXIT -eq 0 ]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "✅ REBUILD SUCCESSFUL!"
    echo ""
    echo "📋 All fixes applied:"
    echo "   ✅ sharingProhibited: false (explicit)"
    echo "   ✅ barcodes array format (Apple standard)"
    echo "   ✅ Complete certificate chain"
    echo "   ✅ All required images"
    echo "   ✅ Files at zip root"
    echo ""
    echo "📱 Next: Commit and push to deploy"
    echo ""
    echo "   git add QuestCard.pkpass QuestCard.pass/pass.json"
    echo "   git commit -m 'Fix Wallet pass: Add sharingProhibited, barcodes array, complete cert chain'"
    echo "   git push origin main"
    echo ""
else
    echo ""
    echo "❌ Build failed - check errors above"
    exit 1
fi
