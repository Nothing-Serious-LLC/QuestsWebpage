#!/bin/bash

# Alternative method: Re-export certificate using security command (macOS)

echo "🔧 Alternative Certificate Export Method"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "This script will help you export the certificate properly using macOS tools."
echo ""
echo "First, let's check what certificates are in your Keychain..."
echo ""

# Find the certificate in Keychain
CERT_NAME="Pass Type ID: pass.com.thequestsapp.questcard"

echo "Searching for: $CERT_NAME"
echo ""

# List certificates that match
security find-certificate -a -c "$CERT_NAME" -Z 2>/dev/null | grep "SHA-1 hash:" | head -1

if [ $? -ne 0 ]; then
    echo "⚠️  Could not find certificate automatically."
    echo ""
    echo "Please do this manually:"
    echo "1. Open Keychain Access"
    echo "2. Search for: Pass Type ID"
    echo "3. Find: pass.com.thequestsapp.questcard"
    echo "4. Right-click → Export"
    echo "5. Important settings:"
    echo "   - File Format: Personal Information Exchange (.p12)"
    echo "   - ⚠️  UNCHECK 'Include extended attributes'"
    echo "   - Click 'OK'"
    echo "6. Save as: questcard-cert-v2.p12"
    echo "7. Set a SIMPLE password (no special characters)"
    echo ""
    exit 0
fi

echo ""
echo "✅ Found certificate in Keychain!"
echo ""
echo "To export manually with correct settings:"
echo ""
echo "1. Open Keychain Access"
echo "2. Click 'My Certificates' in left sidebar"
echo "3. Find and select: Pass Type ID: pass.com.thequestsapp.questcard"
echo "4. Right-click → 'Export...'"
echo "5. IMPORTANT SETTINGS:"
echo "   • File Format: 'Personal Information Exchange (.p12)'"
echo "   • ⚠️  UNCHECK 'Include extended attributes' (this is crucial!)"
echo "   • ⚠️  Use a simple password (letters and numbers only)"
echo "6. Save to Documents folder as: questcard-cert-v2.p12"
echo "7. Try the build again with the new file"
echo ""
echo "The key issue is often:"
echo "  ❌ 'Include extended attributes' is checked"
echo "  ❌ Password has special characters that cause issues"
echo "  ❌ Certificate wasn't selected properly before export"
echo ""
