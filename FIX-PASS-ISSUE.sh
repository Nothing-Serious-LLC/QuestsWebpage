#!/bin/bash
# Complete fix for Wallet pass "Add button won't click" issue

cd "$(dirname "$0")"

echo "🔧 Fixing Wallet Pass Installation Issue"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Step 1: Check current pass contents
echo "Step 1: Diagnosing current pass..."
if [ -f "check-pass-contents.sh" ]; then
    chmod +x check-pass-contents.sh
    ./check-pass-contents.sh
else
    echo "  ⚠️  Diagnostic script not found"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Step 2: Rebuild with enhanced script
echo "Step 2: Rebuilding pass with enhanced script..."
cd QuestCard.pass

# Make scripts executable
chmod +x build-enhanced.sh prepare-images.sh 2>/dev/null

# Set certificate paths
export CERT_PATH="$HOME/Documents/cardfixed.p12"
export CERT_PASSWORD=""
export WWDR_PATH="$HOME/.questcard-certs/wwdr.pem"

echo "Using:"
echo "  Certificate: $CERT_PATH"
echo "  WWDR: $WWDR_PATH"
echo ""

# Run enhanced build
if [ -f "build-enhanced.sh" ]; then
    ./build-enhanced.sh
else
    echo "  ⚠️  Enhanced build script not found, using build-proper.sh"
    ./build-proper.sh
fi

BUILD_EXIT=$?

cd ..

if [ $BUILD_EXIT -eq 0 ]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "✅ Rebuild complete!"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Test on same device:"
    echo "   - Open: https://thequestsapp.com/get-card.html"
    echo "   - Tap 'Add to Apple Wallet'"
    echo "   - If works → Certificate trust issue when sharing"
    echo ""
    echo "2. If still doesn't work when shared:"
    echo "   - This is likely a certificate trust issue"
    echo "   - iOS on receiving device must verify certificate"
    echo "   - Try: Wait a few seconds after receiving pass"
    echo "   - Or: Share via Wallet's built-in 'Share Pass' feature"
    echo ""
    echo "3. Commit and push:"
    echo "   git add QuestCard.pkpass"
    echo "   git commit -m 'Rebuild pass with enhanced script'"
    echo "   git push origin main"
    echo ""
else
    echo ""
    echo "❌ Build failed - check errors above"
    echo ""
    echo "Common fixes:"
    echo "  1. Ensure all images exist: cd QuestCard.pass && ./prepare-images.sh"
    echo "  2. Check certificate path and password"
    echo "  3. Verify WWDR certificate is downloaded"
fi
