#!/bin/bash

# Apple Wallet Pass Build Script - Official Method
# Based on Apple's PassKit documentation
# This script creates a properly signed .pkpass file

set -e  # Exit on error

PASS_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS_NAME="QuestCard"
OUTPUT_DIR="$PASS_DIR/../"
TEMP_DIR=$(mktemp -d)
PASS_CONTENTS="$TEMP_DIR/pass"

echo "🔨 Building Apple Wallet Pass: $PASS_NAME"
echo "Using Apple's official signing method"
echo ""

# Check if required files exist
if [ ! -f "$PASS_DIR/pass.json" ]; then
    echo "❌ Error: pass.json not found in $PASS_DIR"
    exit 1
fi

# Check for images
if [ ! -f "$PASS_DIR/icon.png" ] || [ ! -f "$PASS_DIR/logo.png" ]; then
    echo "⚠️  Warning: Required images (icon.png, logo.png) not found"
    echo "   Run ./prepare-images.sh first"
    exit 1
fi

# Copy all pass files to temp directory (excluding scripts and docs)
echo "📦 Copying pass contents..."
mkdir -p "$PASS_CONTENTS"
find "$PASS_DIR" -maxdepth 1 -type f \
    \( -name "*.json" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) \
    -exec cp {} "$PASS_CONTENTS/" \;

cd "$PASS_CONTENTS"

# Step 1: Create manifest.json
# The manifest is a JSON file with SHA1 hashes of all files in the pass
echo "📝 Creating manifest.json..."

MANIFEST_ENTRIES=""
for file in *; do
    if [ -f "$file" ]; then
        # Calculate SHA1 hash
        HASH=$(shasum -a 1 "$file" | awk '{print $1}')
        # Add to manifest (format: "filename": "hash")
        if [ -z "$MANIFEST_ENTRIES" ]; then
            MANIFEST_ENTRIES="\"$file\": \"$HASH\""
        else
            MANIFEST_ENTRIES="$MANIFEST_ENTRIES,\"$file\": \"$HASH\""
        fi
    fi
done

# Write manifest.json
echo "{ $MANIFEST_ENTRIES }" | python3 -m json.tool > manifest.json

echo "✅ Manifest created with $(echo "$MANIFEST_ENTRIES" | tr ',' '\n' | wc -l | xargs) files"

# Step 2: Check for signing certificates
CERT_PATH="${CERT_PATH:-}"
CERT_PASSWORD="${CERT_PASSWORD:-}"
WWDR_PATH="${WWDR_PATH:-}"

if [ -z "$CERT_PATH" ] || [ -z "$WWDR_PATH" ]; then
    echo ""
    echo "⚠️  Signing certificates not configured"
    echo ""
    echo "To sign the pass, set these environment variables:"
    echo "  export CERT_PATH=/path/to/passcertificate.p12"
    echo "  export CERT_PASSWORD=your_certificate_password"
    echo "  export WWDR_PATH=/path/to/wwdr.pem"
    echo ""
    echo "Or edit this script and set them at the top."
    echo ""
    echo "📋 How to get certificates:"
    echo "  1. Apple Developer account: https://developer.apple.com/account/"
    echo "  2. Create Pass Type ID: https://developer.apple.com/account/resources/identifiers/list"
    echo "  3. Create Pass Type ID Certificate (download as .p12)"
    echo "  4. Download WWDR: https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer"
    echo "  5. Convert WWDR to PEM: openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem"
    echo ""
    echo "📦 Creating unsigned pass package..."
    echo "   (Will show as unsigned in Wallet, but structure is correct)"
    
    # Create unsigned .pkpass file (just a zip)
    cd "$TEMP_DIR"
    zip -r "$OUTPUT_DIR/${PASS_NAME}.pkpass" pass > /dev/null
    
    echo "✅ Created: ${OUTPUT_DIR}${PASS_NAME}.pkpass (UNSIGNED)"
    echo ""
    echo "⚠️  Note: Unsigned passes may not work properly in Wallet"
    echo "   You must sign it with your certificate for production use"
    
    rm -rf "$TEMP_DIR"
    exit 0
fi

# Step 3: Sign the manifest using the certificate
echo ""
echo "🔐 Signing manifest with certificate..."

# Extract private key and certificate from .p12
KEY_PATH="$TEMP_DIR/key.pem"
CERT_PEM="$TEMP_DIR/cert.pem"

# Extract key and cert from p12 (with better error reporting)
echo "   Extracting private key and certificate..."

# Extract key - handle empty password and OpenSSL 3.0+ legacy provider
# macOS Keychain uses RC2-40-CBC which requires legacy provider in OpenSSL 3.0+
if [ -z "$CERT_PASSWORD" ]; then
    # Empty password - try with legacy provider first (OpenSSL 3.0+)
    KEY_OUTPUT=$(echo "" | openssl pkcs12 -legacy -in "$CERT_PATH" -nocerts -nodes -out "$KEY_PATH" -passin stdin 2>&1)
    KEY_EXIT=$?
    
    # If legacy flag doesn't work, try without it (older OpenSSL)
    if [ $KEY_EXIT -ne 0 ]; then
        KEY_OUTPUT=$(echo "" | openssl pkcs12 -in "$CERT_PATH" -nocerts -nodes -out "$KEY_PATH" -passin stdin 2>&1)
        KEY_EXIT=$?
    fi
else
    # Has password - try with legacy provider first
    KEY_OUTPUT=$(openssl pkcs12 -legacy -in "$CERT_PATH" -nocerts -nodes -out "$KEY_PATH" -passin "pass:$CERT_PASSWORD" 2>&1)
    KEY_EXIT=$?
    
    # If legacy flag doesn't work, try without it
    if [ $KEY_EXIT -ne 0 ]; then
        KEY_OUTPUT=$(openssl pkcs12 -in "$CERT_PATH" -nocerts -nodes -out "$KEY_PATH" -passin "pass:$CERT_PASSWORD" 2>&1)
        KEY_EXIT=$?
    fi
fi

if [ $KEY_EXIT -ne 0 ]; then
    echo ""
    echo "❌ Error: Failed to extract private key from certificate"
    echo ""
    echo "Full error output:"
    echo "----------------------------------------"
    echo "$KEY_OUTPUT"
    echo "----------------------------------------"
    echo ""
    
    # Check for specific error messages
    if echo "$KEY_OUTPUT" | grep -qi "mac verify error\|bad decrypt"; then
        echo "🔍 Error type: Password or MAC verification failed"
        echo ""
        echo "This usually means:"
        echo "  • Wrong password"
        echo "  • Certificate was exported with 'Include extended attributes' checked"
        echo "  • Certificate file is corrupted"
    elif echo "$KEY_OUTPUT" | grep -qi "no certificates found"; then
        echo "🔍 Error type: No certificates found in file"
        echo ""
        echo "This usually means the .p12 file is empty or corrupted"
    else
        echo "🔍 Unknown error - see full output above"
    fi
    
    echo ""
    echo "💡 SOLUTION: Re-export the certificate correctly"
    echo ""
    echo "Step-by-step:"
    echo "  1. Open Keychain Access app"
    echo "  2. Click 'My Certificates' in left sidebar (important!)"
    echo "  3. Find: Pass Type ID: pass.com.thequestsapp.questcard"
    echo "  4. Right-click on it → 'Export...'"
    echo "  5. Save as: questcard-cert-v2.p12"
    echo "  6. IMPORTANT:"
    echo "     • File Format: Personal Information Exchange (.p12)"
    echo "     • ⚠️  UNCHECK 'Include extended attributes'"
    echo "     • Use a SIMPLE password (letters/numbers only, no special chars)"
    echo "  7. Try building again with the new file"
    echo ""
    echo "Run: ./fix-cert-export.sh for more detailed instructions"
    echo ""
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Extract certificate - handle empty password and OpenSSL 3.0+ legacy provider
if [ -z "$CERT_PASSWORD" ]; then
    # Empty password - try with legacy provider first
    CERT_OUTPUT=$(echo "" | openssl pkcs12 -legacy -in "$CERT_PATH" -clcerts -nokeys -out "$CERT_PEM" -passin stdin 2>&1)
    CERT_EXIT=$?
    
    # If legacy flag doesn't work, try without it
    if [ $CERT_EXIT -ne 0 ]; then
        CERT_OUTPUT=$(echo "" | openssl pkcs12 -in "$CERT_PATH" -clcerts -nokeys -out "$CERT_PEM" -passin stdin 2>&1)
        CERT_EXIT=$?
    fi
else
    # Has password - try with legacy provider first
    CERT_OUTPUT=$(openssl pkcs12 -legacy -in "$CERT_PATH" -clcerts -nokeys -out "$CERT_PEM" -passin "pass:$CERT_PASSWORD" 2>&1)
    CERT_EXIT=$?
    
    # If legacy flag doesn't work, try without it
    if [ $CERT_EXIT -ne 0 ]; then
        CERT_OUTPUT=$(openssl pkcs12 -in "$CERT_PATH" -clcerts -nokeys -out "$CERT_PEM" -passin "pass:$CERT_PASSWORD" 2>&1)
        CERT_EXIT=$?
    fi
fi

if [ $CERT_EXIT -ne 0 ]; then
    echo ""
    echo "❌ Error: Failed to extract certificate from .p12"
    echo ""
    echo "Details:"
    echo "$CERT_OUTPUT"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "   ✅ Extracted key and certificate"

# Sign the manifest.json
# The signature must be in PKCS7 format
openssl smime -binary -sign -certfile "$WWDR_PATH" \
    -signer "$CERT_PEM" -inkey "$KEY_PATH" \
    -in manifest.json -out signature -outform DER

if [ ! -f "$PASS_CONTENTS/signature" ]; then
    echo "❌ Error: Failed to create signature"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "✅ Manifest signed successfully"

# Step 4: Create the .pkpass file (it's just a zip with specific contents)
echo "📦 Creating .pkpass package..."
cd "$TEMP_DIR"
zip -r "$OUTPUT_DIR/${PASS_NAME}.pkpass" pass > /dev/null

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Build complete!"
echo "📁 Output: ${OUTPUT_DIR}${PASS_NAME}.pkpass"
echo ""
echo "📱 To test:"
echo "   1. Transfer to iPhone (email, AirDrop, or web download)"
echo "   2. Tap the file to add to Wallet"
echo "   3. Open Wallet app to see your pass"
echo ""
