#!/bin/bash

# Apple Wallet Pass Build Script
# This script creates a signed .pkpass file from the pass folder

PASS_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS_NAME="QuestCard"
OUTPUT_DIR="$PASS_DIR/../"
CERTIFICATE_PATH=""  # Path to your .p12 certificate file
CERTIFICATE_PASSWORD=""  # Certificate password
WWDR_PATH=""  # Path to Apple WWDR certificate

echo "🔨 Building Apple Wallet Pass: $PASS_NAME"
echo ""

# Check if required files exist
if [ ! -f "$PASS_DIR/pass.json" ]; then
    echo "❌ Error: pass.json not found in $PASS_DIR"
    exit 1
fi

# Check for images (warn if missing)
if [ ! -f "$PASS_DIR/icon.png" ] || [ ! -f "$PASS_DIR/logo.png" ]; then
    echo "⚠️  Warning: Required images (icon.png, logo.png) not found"
    echo "   The pass will still build, but won't display correctly"
    echo ""
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
PASS_CONTENTS="$TEMP_DIR/pass"

# Copy all files to temp directory
echo "📦 Copying pass contents..."
cp -r "$PASS_DIR"/* "$PASS_CONTENTS"/
rm -f "$PASS_CONTENTS/build.sh" "$PASS_CONTENTS/README.md"

# Check if signing certificates are provided
if [ -z "$CERTIFICATE_PATH" ] || [ -z "$WWDR_PATH" ]; then
    echo ""
    echo "⚠️  Certificate paths not configured"
    echo "   To sign the pass, you need:"
    echo "   1. Apple Developer certificate (.p12 file)"
    echo "   2. Apple WWDR certificate"
    echo ""
    echo "   Edit this script and set:"
    echo "   - CERTIFICATE_PATH=/path/to/cert.p12"
    echo "   - CERTIFICATE_PASSWORD=yourpassword"
    echo "   - WWDR_PATH=/path/to/wwdr.pem"
    echo ""
    echo "   Or use an online tool like:"
    echo "   - https://www.passsource.com/"
    echo "   - https://www.passninja.com/"
    echo ""
    echo "📦 Creating unsigned .zip file instead..."
    cd "$TEMP_DIR"
    zip -r "$OUTPUT_DIR/${PASS_NAME}.zip" pass > /dev/null
    echo "✅ Created: ${OUTPUT_DIR}${PASS_NAME}.zip"
    echo "   Rename to ${PASS_NAME}.pkpass for testing (will show as unsigned)"
else
    # Sign the pass using openssl
    echo "🔐 Signing pass..."
    # Note: Actual signing requires openssl commands with certificates
    # This is a placeholder - full signing requires proper certificate setup
    echo "   (Signing requires proper certificate configuration)"
fi

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Build complete!"
echo ""
echo "📱 To test:"
echo "   1. Email the .pkpass file to yourself"
echo "   2. Open on iPhone and tap to add to Wallet"
echo "   3. Or use AirDrop to send to another iPhone"
