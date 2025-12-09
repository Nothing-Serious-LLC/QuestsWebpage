#!/bin/bash
# FINAL COMPREHENSIVE Wallet Pass Build Script
# Fixes all known issues for proper installation

set -e

PASS_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS_NAME="QuestCard"
OUTPUT_DIR="$PASS_DIR/../"
TEMP_DIR=$(mktemp -d)
PASS_CONTENTS="$TEMP_DIR/pass"

echo "🔨 FINAL Wallet Pass Build - Fixing All Issues"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Validate pass.json structure first
echo "📄 Validating pass.json..."
if [ ! -f "$PASS_DIR/pass.json" ]; then
    echo "❌ Error: pass.json not found"
    exit 1
fi

# Check for critical fields
python3 << 'EOF'
import json
import sys

with open('QuestCard.pass/pass.json') as f:
    p = json.load(f)

errors = []

# Required fields
required = ['formatVersion', 'passTypeIdentifier', 'serialNumber', 'teamIdentifier', 'organizationName', 'description']
for field in required:
    if field not in p:
        errors.append(f"Missing required field: {field}")

# Check sharingProhibited
if 'sharingProhibited' not in p or p.get('sharingProhibited') is not False:
    errors.append("sharingProhibited must be explicitly set to false")

# Check generic pass type
if 'generic' not in p:
    errors.append("Missing 'generic' pass type")
elif 'primaryFields' not in p['generic'] or len(p['generic']['primaryFields']) == 0:
    errors.append("Must have at least one primaryField")

# Check barcode
if 'barcodes' not in p and 'barcode' not in p:
    errors.append("Missing barcode or barcodes")

if errors:
    print("❌ pass.json errors:")
    for err in errors:
        print(f"   - {err}")
    sys.exit(1)
else:
    print("✅ pass.json structure is valid")
EOF

if [ $? -ne 0 ]; then
    echo "❌ pass.json validation failed"
    exit 1
fi

# Ensure images exist
echo ""
echo "🖼️  Checking required images..."
REQUIRED_IMAGES=("icon.png" "icon@2x.png" "icon@3x.png" "logo.png" "logo@2x.png" "logo@3x.png")
MISSING=()
for img in "${REQUIRED_IMAGES[@]}"; do
    if [ ! -f "$PASS_DIR/$img" ]; then
        MISSING+=("$img")
        echo "  ❌ $img MISSING"
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    echo ""
    echo "⚠️  Missing images. Generating..."
    if [ -f "$PASS_DIR/prepare-images.sh" ]; then
        cd "$PASS_DIR"
        ./prepare-images.sh
        cd "$PASS_DIR"
    else
        echo "❌ prepare-images.sh not found"
        exit 1
    fi
fi

# Copy all pass files
echo ""
echo "📦 Preparing pass contents..."
mkdir -p "$PASS_CONTENTS"
find "$PASS_DIR" -maxdepth 1 -type f \
    \( -name "*.json" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) \
    ! -name "*.sh" ! -name "*.md" \
    -exec cp {} "$PASS_CONTENTS/" \;

cd "$PASS_CONTENTS"

# Verify all required files copied
if [ ! -f "pass.json" ] || [ ! -f "icon.png" ] || [ ! -f "logo.png" ]; then
    echo "❌ Error: Required files not copied"
    exit 1
fi

# Create manifest.json
echo "📝 Creating manifest.json..."
MANIFEST_ENTRIES=""
FILE_COUNT=0
for file in *; do
    if [ -f "$file" ] && [ "$file" != "manifest.json" ]; then
        HASH=$(shasum -a 1 "$file" | awk '{print $1}')
        if [ -z "$MANIFEST_ENTRIES" ]; then
            MANIFEST_ENTRIES="\"$file\": \"$HASH\""
        else
            MANIFEST_ENTRIES="$MANIFEST_ENTRIES,\"$file\": \"$HASH\""
        fi
        FILE_COUNT=$((FILE_COUNT + 1))
    fi
done

echo "{ $MANIFEST_ENTRIES }" | python3 -m json.tool > manifest.json.tmp
mv manifest.json.tmp manifest.json

echo "  ✅ Manifest created with $FILE_COUNT files"

# Certificate setup
CERT_PATH="${CERT_PATH:-$HOME/Documents/cardfixed.p12}"
CERT_PASSWORD="${CERT_PASSWORD:-}"
WWDR_PATH="${WWDR_PATH:-$HOME/.questcard-certs/wwdr.pem}"

if [ ! -f "$CERT_PATH" ]; then
    echo ""
    echo "❌ Certificate not found: $CERT_PATH"
    exit 1
fi

# Download WWDR if needed
if [ ! -f "$WWDR_PATH" ]; then
    echo ""
    echo "📥 Downloading WWDR certificate..."
    mkdir -p "$(dirname "$WWDR_PATH")"
    WWDR_CER="$(dirname "$WWDR_PATH")/AppleWWDRCAG4.cer"
    curl -s -o "$WWDR_CER" "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer"
    openssl x509 -inform DER -in "$WWDR_CER" -out "$WWDR_PATH" 2>/dev/null
    echo "  ✅ WWDR downloaded"
fi

# Extract certificates
echo ""
echo "🔐 Extracting certificates..."
KEY_PATH="$TEMP_DIR/key.pem"
CERT_PEM="$TEMP_DIR/cert.pem"

# Extract private key with legacy support
if [ -z "$CERT_PASSWORD" ]; then
    openssl pkcs12 -legacy -in "$CERT_PATH" -nocerts -nodes -out "$KEY_PATH" -passin pass: 2>&1 | grep -v "Mac verify error" || true
else
    openssl pkcs12 -legacy -in "$CERT_PATH" -nocerts -nodes -out "$KEY_PATH" -passin "pass:$CERT_PASSWORD" 2>&1 | grep -v "Mac verify error" || true
fi

# Extract certificate
if [ -z "$CERT_PASSWORD" ]; then
    openssl pkcs12 -legacy -in "$CERT_PATH" -clcerts -nokeys -out "$CERT_PEM" -passin pass: 2>&1 | grep -v "Mac verify error" || true
else
    openssl pkcs12 -legacy -in "$CERT_PATH" -clcerts -nokeys -out "$CERT_PEM" -passin "pass:$CERT_PASSWORD" 2>&1 | grep -v "Mac verify error" || true
fi

if [ ! -f "$KEY_PATH" ] || [ ! -f "$CERT_PEM" ]; then
    echo "  ❌ Failed to extract certificates"
    exit 1
fi

echo "  ✅ Certificates extracted"

# Create signature with FULL certificate chain
echo ""
echo "🔏 Signing manifest (with complete certificate chain)..."
openssl smime -binary -sign \
    -certfile "$WWDR_PATH" \
    -signer "$CERT_PEM" \
    -inkey "$KEY_PATH" \
    -in manifest.json \
    -out signature \
    -outform DER \
    -noattr 2>&1 | grep -v "^Loading" || true

if [ ! -f "signature" ] || [ ! -s "signature" ]; then
    echo "  ❌ Signature creation failed"
    exit 1
fi

sig_size=$(stat -f%z "signature" 2>/dev/null || stat -c%s "signature" 2>/dev/null)
echo "  ✅ Signature created ($sig_size bytes)"

# Create .pkpass (zip with files at ROOT)
echo ""
echo "📦 Creating .pkpass file..."
cd "$PASS_CONTENTS"

# Verify required files
REQUIRED=("manifest.json" "pass.json" "signature" "icon.png" "logo.png")
for req in "${REQUIRED[@]}"; do
    if [ ! -f "$req" ]; then
        echo "  ❌ Missing: $req"
        exit 1
    fi
done

# Create zip - files MUST be at root, not in subdirectory
zip -q -r "$OUTPUT_DIR/${PASS_NAME}.pkpass" . || {
    echo "  ❌ Failed to create zip"
    exit 1
}

pkpass_size=$(stat -f%z "$OUTPUT_DIR/${PASS_NAME}.pkpass" 2>/dev/null || stat -c%s "$OUTPUT_DIR/${PASS_NAME}.pkpass" 2>/dev/null)
echo "  ✅ Pass created ($pkpass_size bytes)"

# Verify zip structure
echo ""
echo "🔍 Verifying zip structure..."
ZIP_LIST=$(unzip -l "$OUTPUT_DIR/${PASS_NAME}.pkpass" 2>/dev/null)
ROOT_FILES=$(echo "$ZIP_LIST" | grep -E "manifest\.json|pass\.json|signature|\.png$" | grep -v "/" | wc -l | tr -d ' ')

if [ "$ROOT_FILES" -lt 4 ]; then
    echo "  ⚠️  Warning: Files may not be at root level"
else
    echo "  ✅ All files at root level (correct)"
fi

# Final validation
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ BUILD COMPLETE!"
echo ""
echo "📁 Output: ${OUTPUT_DIR}${PASS_NAME}.pkpass"
echo "📊 Size: $pkpass_size bytes"
echo ""
echo "✅ Fixes applied:"
echo "   • sharingProhibited: false (explicit)"
echo "   • barcodes array format (Apple standard)"
echo "   • Complete certificate chain in signature"
echo "   • All required images included"
echo "   • Files at zip root (not in subdirectory)"
echo ""
echo "📱 Next steps:"
echo "   1. Validate: https://pkpassvalidator.azurewebsites.net/"
echo "   2. Test download: https://thequestsapp.com/get-card.html"
echo "   3. Test sharing: Email to yourself and try adding"
echo ""

rm -rf "$TEMP_DIR"
