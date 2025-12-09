#!/bin/bash
# Diagnostic script to check Wallet pass contents

cd "$(dirname "$0")"

PASS_FILE="QuestCard.pkpass"

if [ ! -f "$PASS_FILE" ]; then
    echo "❌ QuestCard.pkpass not found"
    exit 1
fi

echo "🔍 Analyzing QuestCard.pkpass"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "📦 Files in pass:"
unzip -l "$PASS_FILE" | grep -v "^Archive\|^Length\|^-" | grep -v "^ *$" | head -20

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Extract and check contents
TEMP_DIR=$(mktemp -d)
unzip -q "$PASS_FILE" -d "$TEMP_DIR"

echo "📋 Checking required files:"
echo ""

REQUIRED_FILES=(
    "manifest.json"
    "pass.json"
    "signature"
    "icon.png"
    "logo.png"
)

MISSING=()
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$TEMP_DIR/$file" ]; then
        size=$(stat -f%z "$TEMP_DIR/$file" 2>/dev/null || stat -c%s "$TEMP_DIR/$file" 2>/dev/null)
        echo "  ✅ $file ($size bytes)"
    else
        echo "  ❌ $file MISSING"
        MISSING+=("$file")
    fi
done

echo ""
echo "📸 Checking image files:"
IMAGE_FILES=$(cd "$TEMP_DIR" && find . -name "*.png" -type f | sort)
if [ -z "$IMAGE_FILES" ]; then
    echo "  ❌ No PNG images found!"
else
    echo "$IMAGE_FILES" | while read img; do
        size=$(stat -f%z "$TEMP_DIR/$img" 2>/dev/null || stat -c%s "$TEMP_DIR/$img" 2>/dev/null)
        echo "  ✅ $img ($size bytes)"
    done
fi

echo ""
echo "📄 Checking pass.json structure:"
if [ -f "$TEMP_DIR/pass.json" ]; then
    echo "  Required fields:"
    python3 -c "
import json
with open('$TEMP_DIR/pass.json') as f:
    p = json.load(f)
    
required = ['formatVersion', 'passTypeIdentifier', 'serialNumber', 'teamIdentifier', 'organizationName', 'description']
for field in required:
    if field in p:
        print(f'    ✅ {field}: {p[field]}')
    else:
        print(f'    ❌ {field}: MISSING')
    
if 'generic' in p and 'primaryFields' in p['generic']:
    print(f'    ✅ primaryFields: {len(p[\"generic\"][\"primaryFields\"])} field(s)')
else:
    print(f'    ❌ primaryFields: MISSING')
    
if 'barcode' in p:
    print(f'    ✅ barcode: {p[\"barcode\"].get(\"format\", \"unknown\")}')
else:
    print(f'    ❌ barcode: MISSING')
" 2>/dev/null || echo "  ⚠️  Could not parse pass.json"
fi

echo ""
echo "🔐 Checking signature:"
if [ -f "$TEMP_DIR/signature" ]; then
    sig_size=$(stat -f%z "$TEMP_DIR/signature" 2>/dev/null || stat -c%s "$TEMP_DIR/signature" 2>/dev/null)
    echo "  ✅ signature exists ($sig_size bytes)"
    
    # Try to verify signature format
    if command -v openssl &> /dev/null; then
        if openssl pkcs7 -in "$TEMP_DIR/signature" -inform DER -print &>/dev/null; then
            echo "  ✅ signature format appears valid (PKCS7 DER)"
        else
            echo "  ⚠️  signature format check inconclusive"
        fi
    fi
else
    echo "  ❌ signature MISSING"
fi

echo ""
echo "📋 Manifest check:"
if [ -f "$TEMP_DIR/manifest.json" ]; then
    echo "  ✅ manifest.json exists"
    manifest_entries=$(python3 -c "import json; f=open('$TEMP_DIR/manifest.json'); print(len(json.load(f)))" 2>/dev/null)
    echo "  📊 Contains $manifest_entries file hash(es)"
else
    echo "  ❌ manifest.json MISSING"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"

if [ ${#MISSING[@]} -gt 0 ]; then
    echo ""
    echo "❌ MISSING REQUIRED FILES:"
    printf '   - %s\n' "${MISSING[@]}"
    echo ""
    echo "💡 These missing files will prevent the pass from installing!"
    exit 1
else
    echo ""
    echo "✅ All required files present"
    echo ""
    echo "💡 If pass still won't install, possible causes:"
    echo "   1. Certificate not trusted (receiving device)"
    echo "   2. Image files corrupted or wrong format"
    echo "   3. Pass Type ID certificate expired/revoked"
    echo "   4. Team ID mismatch"
fi

rm -rf "$TEMP_DIR"
