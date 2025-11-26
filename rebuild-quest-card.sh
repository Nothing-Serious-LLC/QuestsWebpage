#!/bin/bash
# Complete rebuild script for Quest Card Wallet Pass

cd "$(dirname "$0")"

echo "🔨 Rebuilding Quest Card Wallet Pass..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

cd QuestCard.pass

export CERT_PATH="$HOME/Documents/cardfixed.p12"
export CERT_PASSWORD=""
export WWDR_PATH="$HOME/.questcard-certs/wwdr.pem"

echo "Using certificate: $CERT_PATH"
echo "Using WWDR: $WWDR_PATH"
echo ""

if [ ! -f "$CERT_PATH" ]; then
    echo "❌ Certificate not found: $CERT_PATH"
    exit 1
fi

if [ ! -f "$WWDR_PATH" ]; then
    echo "⚠️  WWDR not found. Downloading..."
    mkdir -p "$(dirname "$WWDR_PATH")"
    curl -o "$(dirname "$WWDR_PATH")/AppleWWDRCAG4.cer" "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer" 2>/dev/null
    openssl x509 -inform DER -in "$(dirname "$WWDR_PATH")/AppleWWDRCAG4.cer" -out "$WWDR_PATH" 2>/dev/null
fi

echo "Building pass..."
./build-proper.sh

if [ $? -eq 0 ]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "✅ Rebuild complete!"
    echo ""
    echo "Next steps:"
    echo "  1. git add QuestCard.pkpass"
    echo "  2. git commit -m 'Rebuild Wallet pass'"
    echo "  3. git push origin main"
    echo ""
    echo "Test at: https://pkpassvalidator.azurewebsites.net/"
else
    echo ""
    echo "❌ Build failed - check errors above"
    exit 1
fi
