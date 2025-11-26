#!/bin/bash

# Quick build script that asks for password interactively

cd "$(dirname "$0")"

CERT_PATH="$HOME/Documents/questcard.p12"
WWDR_PATH="$HOME/.questcard-certs/wwdr.pem"

echo "🔨 Building Apple Wallet Pass"
echo ""

# Check if certificate exists
if [ ! -f "$CERT_PATH" ]; then
    echo "❌ Certificate not found: $CERT_PATH"
    exit 1
fi

# Check if WWDR exists
if [ ! -f "$WWDR_PATH" ]; then
    echo "⚠️  WWDR certificate not found. Downloading..."
    mkdir -p "$(dirname "$WWDR_PATH")"
    curl -o "$(dirname "$WWDR_PATH")/AppleWWDRCAG4.cer" "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer" 2>/dev/null
    openssl x509 -inform DER -in "$(dirname "$WWDR_PATH")/AppleWWDRCAG4.cer" -out "$WWDR_PATH" 2>/dev/null
fi

# Ask for password
echo "Enter the password you set when exporting questcard.p12:"
read -rs CERT_PASSWORD
echo ""

# Export variables and run build
export CERT_PATH
export CERT_PASSWORD
export WWDR_PATH

./build-proper.sh
