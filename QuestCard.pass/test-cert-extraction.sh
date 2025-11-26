#!/bin/bash

# Test script to diagnose certificate extraction issues

CERT_PATH="$HOME/Documents/questcard.p12"
TEMP_DIR=$(mktemp -d)
KEY_PATH="$TEMP_DIR/key.pem"
CERT_PEM="$TEMP_DIR/cert.pem"

echo "🔍 Testing certificate extraction"
echo "Certificate: $CERT_PATH"
echo ""

if [ ! -f "$CERT_PATH" ]; then
    echo "❌ Certificate file not found!"
    exit 1
fi

echo "Enter certificate password:"
read -rs CERT_PASSWORD
echo ""

echo "Testing password..."
echo "----------------------------------------"

# Try to extract key
echo "1. Extracting private key..."
KEY_OUTPUT=$(openssl pkcs12 -in "$CERT_PATH" -nocerts -nodes -out "$KEY_PATH" -password "pass:$CERT_PASSWORD" 2>&1)
KEY_EXIT=$?

if [ $KEY_EXIT -eq 0 ]; then
    echo "   ✅ Private key extracted successfully!"
    ls -lh "$KEY_PATH"
else
    echo "   ❌ Failed to extract private key"
    echo "   Exit code: $KEY_EXIT"
    echo "   Error output:"
    echo "$KEY_OUTPUT" | sed 's/^/   /'
fi

echo ""

# Try to extract certificate
echo "2. Extracting certificate..."
CERT_OUTPUT=$(openssl pkcs12 -in "$CERT_PATH" -clcerts -nokeys -out "$CERT_PEM" -password "pass:$CERT_PASSWORD" 2>&1)
CERT_EXIT=$?

if [ $CERT_EXIT -eq 0 ]; then
    echo "   ✅ Certificate extracted successfully!"
    ls -lh "$CERT_PEM"
    echo ""
    echo "   Certificate info:"
    openssl x509 -in "$CERT_PEM" -noout -subject -issuer 2>/dev/null | sed 's/^/   /'
else
    echo "   ❌ Failed to extract certificate"
    echo "   Exit code: $CERT_EXIT"
    echo "   Error output:"
    echo "$CERT_OUTPUT" | sed 's/^/   /'
fi

echo ""
echo "----------------------------------------"

# Cleanup
rm -rf "$TEMP_DIR"

if [ $KEY_EXIT -eq 0 ] && [ $CERT_EXIT -eq 0 ]; then
    echo "✅ Certificate extraction test PASSED!"
    echo "   Your certificate and password are correct."
    exit 0
else
    echo "❌ Certificate extraction test FAILED"
    echo ""
    echo "Common issues:"
    echo "  1. Wrong password"
    echo "  2. Certificate doesn't have private key"
    echo "  3. Certificate file is corrupted"
    echo ""
    echo "To fix: Re-export from Keychain Access:"
    echo "  1. Open Keychain Access"
    echo "  2. Find your Pass Type ID certificate"
    echo "  3. Right-click → Export"
    echo "  4. File Format: Personal Information Exchange (.p12)"
    echo "  5. UNCHECK 'Include extended attributes'"
    echo "  6. Set a password"
    exit 1
fi

