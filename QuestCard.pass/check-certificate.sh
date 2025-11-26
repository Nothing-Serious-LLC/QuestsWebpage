#!/bin/bash

# Diagnostic script to check certificate and password

CERT_PATH="${1:-$HOME/Documents/questcard-cert.p12}"

if [ ! -f "$CERT_PATH" ]; then
    echo "❌ Certificate file not found: $CERT_PATH"
    exit 1
fi

echo "🔍 Checking certificate: $CERT_PATH"
echo ""

# Check if file is readable
echo "📁 File info:"
ls -lh "$CERT_PATH"
echo ""

# Try to read certificate info (without password)
echo "📋 Certificate information (public):"
openssl pkcs12 -in "$CERT_PATH" -nokeys -passin pass: 2>&1 | head -10 || echo "   (Requires password to view details)"
echo ""

# Check if password is needed
echo "🔐 Testing certificate access..."
echo "   Enter the password you set when exporting the certificate:"
read -rs CERT_PASSWORD
echo ""

TEMP_DIR=$(mktemp -d)
KEY_PATH="$TEMP_DIR/key.pem"
CERT_PEM="$TEMP_DIR/cert.pem"

echo "Testing password..."
KEY_OUTPUT=$(openssl pkcs12 -in "$CERT_PATH" -nocerts -nodes -out "$KEY_PATH" -password "pass:$CERT_PASSWORD" 2>&1)
KEY_EXIT=$?

if [ $KEY_EXIT -eq 0 ]; then
    echo "✅ Password is correct! Private key extracted successfully."
    echo ""
    
    # Try to extract certificate
    CERT_OUTPUT=$(openssl pkcs12 -in "$CERT_PATH" -clcerts -nokeys -out "$CERT_PEM" -password "pass:$CERT_PASSWORD" 2>&1)
    CERT_EXIT=$?
    
    if [ $CERT_EXIT -eq 0 ]; then
        echo "✅ Certificate extracted successfully!"
        echo ""
        echo "Certificate details:"
        openssl x509 -in "$CERT_PEM" -noout -subject -issuer 2>/dev/null | sed 's/^/   /'
        echo ""
        echo "✅ Your certificate is valid and ready to use!"
    else
        echo "❌ Failed to extract certificate:"
        echo "$CERT_OUTPUT"
    fi
else
    echo "❌ Password is incorrect or certificate has issues:"
    echo ""
    echo "$KEY_OUTPUT" | grep -i "error\|mac verify\|bad decrypt" || echo "$KEY_OUTPUT"
    echo ""
    echo "Common issues:"
    echo "  • Wrong password - make sure you're using the password you set"
    echo "  • Certificate might not have private key exported"
    echo "  • Try re-exporting from Keychain Access"
fi

# Cleanup
rm -rf "$TEMP_DIR"
