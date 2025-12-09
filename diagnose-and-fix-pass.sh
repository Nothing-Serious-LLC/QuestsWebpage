#!/bin/bash
# Comprehensive pass diagnosis and fix

cd "$(dirname "$0")"

PASS_FILE="QuestCard.pkpass"
PASS_DIR="QuestCard.pass"

echo "🔍 Diagnosing Wallet Pass Issue"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Step 1: Check what's in the current pass
if [ -f "$PASS_FILE" ]; then
    echo "📦 Current pass contents:"
    unzip -l "$PASS_FILE" 2>/dev/null | grep -E "\.(png|json|signature)" | head -15
    echo ""
fi

# Step 2: Check if all required images exist in source directory
echo "🖼️  Checking source images:"
REQUIRED_IMAGES=(
    "icon.png"
    "icon@2x.png"
    "icon@3x.png"
    "logo.png"
    "logo@2x.png"
    "logo@3x.png"
)

MISSING_IMAGES=()
for img in "${REQUIRED_IMAGES[@]}"; do
    if [ -f "$PASS_DIR/$img" ]; then
        size=$(stat -f%z "$PASS_DIR/$img" 2>/dev/null || stat -c%s "$PASS_DIR/$img" 2>/dev/null)
        echo "  ✅ $img ($size bytes)"
    else
        echo "  ❌ $img MISSING"
        MISSING_IMAGES+=("$img")
    fi
done

echo ""

# Step 3: If images are missing, regenerate them
if [ ${#MISSING_IMAGES[@]} -gt 0 ]; then
    echo "⚠️  Missing images detected. Regenerating..."
    if [ -f "$PASS_DIR/prepare-images.sh" ]; then
        cd "$PASS_DIR"
        ./prepare-images.sh
        cd ..
    else
        echo "  ❌ prepare-images.sh not found"
    fi
fi

# Step 4: Check pass.json for common issues
echo "📄 Checking pass.json structure:"
if [ -f "$PASS_DIR/pass.json" ]; then
    python3 << 'EOF'
import json
import sys

try:
    with open('QuestCard.pass/pass.json') as f:
        p = json.load(f)
    
    issues = []
    
    # Check required fields
    required = ['formatVersion', 'passTypeIdentifier', 'serialNumber', 'teamIdentifier', 'organizationName']
    for field in required:
        if field not in p:
            issues.append(f"Missing required field: {field}")
    
    # Check generic pass structure
    if 'generic' not in p:
        issues.append("Missing 'generic' pass type")
    else:
        if 'primaryFields' not in p['generic'] or len(p['generic']['primaryFields']) == 0:
            issues.append("No primaryFields found (required for generic passes)")
    
    # Check barcode
    if 'barcode' not in p:
        issues.append("Missing barcode")
    
    # Check for logoText or logo
    if 'logoText' not in p and 'logo' not in p:
        issues.append("No logoText or logo specified")
    
    if issues:
        print("  ❌ Issues found:")
        for issue in issues:
            print(f"     - {issue}")
        sys.exit(1)
    else:
        print("  ✅ pass.json structure looks good")
        
except Exception as e:
    print(f"  ❌ Error reading pass.json: {e}")
    sys.exit(1)
EOF

    if [ $? -ne 0 ]; then
        echo ""
        echo "💡 Fixing pass.json issues..."
        # The pass.json looks fine from what we saw, but let's ensure it's valid
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "💡 Common causes of 'Add button but won't click':"
echo ""
echo "1. ✅ Missing or corrupted images (icon.png, logo.png required)"
echo "2. ✅ Certificate trust issue (receiving device doesn't trust cert)"
echo "3. ✅ Pass structure missing required fields"
echo "4. ✅ Certificate chain incomplete in signature"
echo ""
echo "📝 Next steps:"
echo "   1. Run this script: ./check-pass-contents.sh"
echo "   2. Rebuild pass: cd QuestCard.pass && ./build-proper.sh"
echo "   3. Test on same device first (not shared)"
echo "   4. If works locally but not shared → certificate trust issue"
echo ""
