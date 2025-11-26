#!/bin/bash

# Alternative method using macOS security command instead of openssl

CERT_PATH="$HOME/Documents/questcard.p12"

if [ ! -f "$CERT_PATH" ]; then
    echo "❌ Certificate not found: $CERT_PATH"
    exit 1
fi

echo "🔍 Testing certificate with macOS security command (alternative method)"
echo ""

echo "Enter certificate password:"
read -rs CERT_PASSWORD
echo ""

TEMP_DIR=$(mktemp -d)
KEY_PATH="$TEMP_DIR/key.pem"
CERT_PEM="$TEMP_DIR/cert.pem"

echo "Trying macOS security command method..."
echo ""

# Use security command to extract from Keychain instead
# First, let's try to import to temporary keychain and extract from there
TEMP_KEYCHAIN="$TEMP_DIR/temp.keychain"
TEMP_KEYCHAIN_PASS="temp123"

echo "Creating temporary keychain..."
security create-keychain -p "$TEMP_KEYCHAIN_PASS" "$TEMP_KEYCHAIN" 2>&1
security set-keychain-settings -lut 3600 "$TEMP_KEYCHAIN" 2>&1
security unlock-keychain -p "$TEMP_KEYCHAIN_PASS" "$TEMP_KEYCHAIN" 2>&1

echo "Importing certificate to temporary keychain..."
echo "$CERT_PASSWORD" | security import "$CERT_PATH" -k "$TEMP_KEYCHAIN" -P "$CERT_PASSWORD" -T /usr/bin/security 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Successfully imported to temporary keychain"
    echo ""
    echo "Certificate imported successfully. This means the password is correct."
    echo ""
    echo "The issue might be with how openssl handles the password."
    echo "Let's try a different openssl approach..."
else
    echo "❌ Failed to import certificate"
    echo "This suggests the password is wrong or the file is corrupted"
fi

# Cleanup
security delete-keychain "$TEMP_KEYCHAIN" 2>/dev/null
rm -rf "$TEMP_DIR"
