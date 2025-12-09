#!/bin/bash
# Enhanced Wallet Pass Build Script with improved certificate chain handling

set -e

PASS_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS_NAME="QuestCard"
OUTPUT_DIR="$PASS_DIR/../"
TEMP_DIR=$(mktemp -d)
PASS_CONTENTS="$TEMP_DIR/pass"

echo "🔨 Building Apple Wallet Pass (Enhanced)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check required files
if [ ! -f "$PASS_DIR/pass.json" ]; then
    echo "❌ Error: pass.json not found"
    exit 1
fi

# Verify required images exist
echo "🖼️  Checking required images..."
MISSING_IMAGES=()
for img in "icon.png" "icon@2x.png" "icon@3x.png" "logo.png" "logo@2x.png" "logo@3x.png"; do
    if [ ! -f "$PASS_DIR/$img" ]; then
        MISSING_IMAGES+=("$img")
        echo "  ❌ $img MISSING"
    else
        size=$(stat -f%z "$PASS_DIR/$img" 2>/dev/null || stat -c%s "$PASS_DIR/$img" 2>/dev/null)
        echo "  ✅ $img ($size bytes)"
    fi
done

if [ ${#MISSING_IMAGES[@]} -gt 0 ]; then
    echo ""
    echo "⚠️  Missing images detected. Running prepare-images.sh..."
    cd "$PASS_DIR"
    if [ -f "prepare-images.sh" ]; then
        ./prepare-images.sh
    else
        echo "❌ prepare-images.sh not found. Cannot continue."
        exit 1
    fi
    cd "$PASS_DIR"
fi

echo ""
echo "📦 Copying pass contents..."
mkdir -p "$PASS_CONTENTS"

# Copy all JSON and image files (excluding scripts/docs)
find "$PASS_DIR" -maxdepth 1 -type f \
    \( -name "*.json" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) \
    -exec cp {} "$PASS_CONTENTS/" \;

cd "$PASS_CONTENTS"

# Verify files copied
echo "  Files copied:"
ls -1 *.json *.png 2>/dev/null | while read f; do
    size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
    echo "    ✓ $f ($size bytes)"
done

# Step 1: Create manifest.json
echo ""
echo "📝 Creating manifest.json..."
MANIFEST_ENTRIES=""
FILE_COUNT=0
for file in *; do
    if [ -f "$file" ]; then
        HASH=$(shasum -a 1 "$file" | awk '{print $1}')
        if [ -z "$MANIFEST_ENTRIES" ]; then
            MANIFEST_ENTRIES="\"$file\": \"$HASH\""
        else
            MANIFEST_ENTRIES="$MANIFEST_ENTRIES,\"$file\": \"$HASH\""
        fi
        FILE_COUNT=$((FILE_COUNT + 1))
    fi
done

echo "{ $MANIFEST_ENTRIES }" | python3 -m json.tool > manifest.json
echo "  ✅ Manifest created with $FILE_COUNT files"

# Step 2: Certificate setup
CERT_PATH="${CERT_PATH:-$HOME/Documents/cardfixed.p12}"
CERT_PASSWORD="${CERT_PASSWORD:-}"
WWDR_PATH="${WWDR_PATH:-$HOME/.questcard-certs/wwdr.pem}"

if [ -z "$CERT_PATH" ] || [ ! -f "$CERT_PATH" ]; then
    echo ""
    echo "❌ Certificate not found: $CERT_PATH"
    echo "   Set CERT_PATH environment variable"
    exit 1
fi

if [ ! -f "$WWDR_PATH" ]; then
    echo ""
    echo "⚠️  WWDR certificate not found. Downloading..."
    mkdir -p "$(dirname "$WWDR_PATH")"
    WWDR_CER="$(dirname "$WWDR_PATH")/AppleWWDRCAG4.cer"
    curl -s -o "$WWDR_CER" "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer"
    openssl x509 -inform DER -in "$WWDR_CER" -out "$WWDR_PATH" 2>/dev/null
    echo "  ✅ WWDR downloaded and converted"
fi

# Step 3: Extract certificates
echo ""
echo "🔐 Extracting certificates..."
KEY_PATH="$TEMP_DIR/key.pem"
CERT_PEM="$TEMP_DIR/cert.pem"

# Extract private key
echo "  Extracting private key..."
openssl pkcs12 -legacy -in "$CERT_PATH" -nocerts -nodes -out "$KEY_PATH" -passin "pass:$CERT_PASSWORD" 2>/dev/null || {
    echo "  ❌ Failed to extract private key"
    echo "     Try with empty password or check certificate export"
    exit 1
}

# Extract certificate
echo "  Extracting certificate..."
openssl pkcs12 -legacy -in "$CERT_PATH" -clcerts -nokeys -out "$CERT_PEM" -passin "pass:$CERT_PASSWORD" 2>/dev/null || {
    echo "  ❌ Failed to extract certificate"
    exit 1
}

# Step 4: Sign manifest with full certificate chain
echo ""
echo "🔏 Signing manifest (with full certificate chain)..."
openssl smime -binary -sign \
    -certfile "$WWDR_PATH" \
    -signer "$CERT_PEM" \
    -inkey "$KEY_PATH" \
    -in manifest.json \
    -out signature \
    -outform DER \
    -noattr 2>/dev/null || {
    echo "  ❌ Signing failed"
    exit 1
}

if [ ! -f "signature" ] || [ ! -s "signature" ]; then
    echo "  ❌ Signature file is empty or missing"
    exit 1
fi

sig_size=$(stat -f%z "signature" 2>/dev/null || stat -c%s "signature" 2>/dev/null)
echo "  ✅ Signature created ($sig_size bytes)"

# Step 5: Create .pkpass (zip with files at ROOT)
echo ""
echo "📦 Creating .pkpass package..."
cd "$PASS_CONTENTS"

# Verify all required files exist before zipping
REQUIRED=("manifest.json" "pass.json" "signature" "icon.png" "logo.png")
MISSING=()
for req in "${REQUIRED[@]}"; do
    if [ ! -f "$req" ]; then
        MISSING+=("$req")
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "  ❌ Missing required files: ${MISSING[*]}"
    exit 1
fi

# Create zip with files at ROOT (not in subdirectory)
zip -q -r "$OUTPUT_DIR/${PASS_NAME}.pkpass" . || {
    echo "  ❌ Failed to create zip"
    exit 1
}

pkpass_size=$(stat -f%z "$OUTPUT_DIR/${PASS_NAME}.pkpass" 2>/dev/null || stat -c%s "$OUTPUT_DIR/${PASS_NAME}.pkpass" 2>/dev/null)
echo "  ✅ Pass created ($pkpass_size bytes)"

# Verify zip structure
echo ""
echo "🔍 Verifying zip structure..."
ZIP_FILES=$(unzip -l "$OUTPUT_DIR/${PASS_NAME}.pkpass" 2>/dev/null | grep -E "\.(json|png|signature)$" | awk '{print $4}' | grep -v "^Archive\|^Length" | head -10)

# Check if files are at root (no subdirectories)
HAS_SUBDIR=false
while IFS= read -r file; do
    if [[ "$file" == */* ]]; then
        HAS_SUBDIR=true
        break
    fi
done <<< "$ZIP_FILES"

if [ "$HAS_SUBDIR" = true ]; then
    echo "  ⚠️  Warning: Some files are in subdirectories (should be at root)"
else
    echo "  ✅ All files at root level (correct)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Build complete!"
echo ""
echo "📁 Output: ${OUTPUT_DIR}${PASS_NAME}.pkpass"
echo "📊 Size: $pkpass_size bytes"
echo ""
echo "📱 Testing:"
echo "   1. Validate: https://pkpassvalidator.azurewebsites.net/"
echo "   2. Test on iPhone: Email to yourself and try adding"
echo ""
echo "💡 If 'Add' button is grayed out when shared:"
echo "   - Certificate trust issue (receiving device)"
echo "   - Try installing on same device first"
echo "   - Pass may need to be from trusted domain"
echo ""

# Cleanup
rm -rf "$TEMP_DIR"
