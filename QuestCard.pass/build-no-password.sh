#!/bin/bash

# Build script for certificate with no password

cd "$(dirname "$0")"

CERT_PATH="$HOME/Documents/cardfixed.p12"
WWDR_PATH="$HOME/.questcard-certs/wwdr.pem"

echo "🔨 Building Apple Wallet Pass (No Password Certificate)"
echo ""

# Check if certificate exists
if [ ! -f "$CERT_PATH" ]; then
    echo "❌ Certificate not found: $CERT_PATH"
    exit 1
fi

# Check if WWDR exists
if [ ! -f "$WWDR_PATH" ]; then
    echo "📥 Downloading WWDR certificate..."
    mkdir -p "$(dirname "$WWDR_PATH")"
    curl -o "$(dirname "$WWDR_PATH")/AppleWWDRCAG4.cer" "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer" 2>/dev/null
    openssl x509 -inform DER -in "$(dirname "$WWDR_PATH")/AppleWWDRCAG4.cer" -out "$WWDR_PATH" 2>/dev/null
fi

# Set environment variables
export CERT_PATH
export CERT_PASSWORD=""  # Empty password
export WWDR_PATH

# Run the build script
./build-proper.sh
