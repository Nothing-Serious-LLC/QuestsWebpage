#!/bin/bash

# Alternative build method using different password passing techniques

cd "$(dirname "$0")"

CERT_PATH="${CERT_PATH:-$HOME/Documents/questcard.p12}"
WWDR_PATH="${WWDR_PATH:-$HOME/.questcard-certs/wwdr.pem}"

echo "🔨 Building Apple Wallet Pass (Alternative Method)"
echo ""

# Check if certificate exists
if [ ! -f "$CERT_PATH" ]; then
    echo "❌ Certificate not found: $CERT_PATH"
    exit 1
fi

# Check if WWDR exists
if [ ! -f "$WWDR_PATH" ]; then
    echo "⚠️  WWDR certificate not found. Downloading..."
    mkdir -p "$(dirname "$WWDR_PATH")"
    curl -o "$(dirname "$WWDR_PATH")/AppleWWDRCAG4.cer" "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer" 2>/dev/null
    openssl x509 -inform DER -in "$(dirname "$WWDR_PATH")/AppleWWDRCAG4.cer" -out "$WWDR_PATH" 2>/dev/null
fi

# Ask for password
echo "Enter the password you set when exporting the certificate:"
read -rs CERT_PASSWORD
echo ""

PASS_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS_NAME="QuestCard"
OUTPUT_DIR="$PASS_DIR/../"
TEMP_DIR=$(mktemp -d)
PASS_CONTENTS="$TEMP_DIR/pass"

# Copy all pass files
mkdir -p "$PASS_CONTENTS"
find "$PASS_DIR" -maxdepth 1 -type f \
    \( -name "*.json" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) \
    -exec cp {} "$PASS_CONTENTS/" \;

cd "$PASS_CONTENTS"

# Create manifest
echo "📝 Creating manifest.json..."
MANIFEST_ENTRIES=""
for file in *; do
    if [ -f "$file" ]; then
        HASH=$(shasum -a 1 "$file" | awk '{print $1}')
        if [ -z "$MANIFEST_ENTRIES" ]; then
            MANIFEST_ENTRIES="\"$file\": \"$HASH\""
        else
            MANIFEST_ENTRIES="$MANIFEST_ENTRIES,\"$file\": \"$HASH\""
        fi
    fi
done

echo "{ $MANIFEST_ENTRIES }" | python3 -m json.tool > manifest.json

KEY_PATH="$TEMP_DIR/key.pem"
CERT_PEM="$TEMP_DIR/cert.pem"

echo "🔐 Extracting certificate (trying multiple methods)..."
echo ""

# Method 1: Try with stdin
echo "Method 1: Using stdin for password..."
KEY_OUTPUT=$(echo "$CERT_PASSWORD" | openssl pkcs12 -in "$CERT_PATH" -nocerts -nodes -out "$KEY_PATH" -passin stdin 2>&1)
KEY_EXIT=$?

if [ $KEY_EXIT -ne 0 ]; then
    echo "   ❌ Method 1 failed"
    echo "   Trying Method 2: Using pass: prefix..."
    
    # Method 2: Try with pass: prefix (escape any special chars)
    # Escape the password properly
    ESCAPED_PASSWORD=$(printf '%q' "$CERT_PASSWORD")
    KEY_OUTPUT=$(openssl pkcs12 -in "$CERT_PATH" -nocerts -nodes -out "$KEY_PATH" -passin "pass:$CERT_PASSWORD" 2>&1)
    KEY_EXIT=$?
fi

if [ $KEY_EXIT -ne 0 ]; then
    echo "   ❌ Method 2 failed"
    echo "   Trying Method 3: Using file..."
    
    # Method 3: Try with password file
    PASS_FILE="$TEMP_DIR/pass.txt"
    echo -n "$CERT_PASSWORD" > "$PASS_FILE"
    KEY_OUTPUT=$(openssl pkcs12 -in "$CERT_PATH" -nocerts -nodes -out "$KEY_PATH" -passin "file:$PASS_FILE" 2>&1)
    KEY_EXIT=$?
    rm -f "$PASS_FILE"
fi

if [ $KEY_EXIT -ne 0 ]; then
    echo ""
    echo "❌ All methods failed to extract private key"
    echo ""
    echo "Error output:"
    echo "----------------------------------------"
    echo "$KEY_OUTPUT"
    echo "----------------------------------------"
    echo ""
    echo "Possible issues:"
    echo "  1. Password contains characters that confuse openssl"
    echo "  2. Certificate file structure issue"
    echo "  3. macOS Keychain Access added extra encoding"
    echo ""
    echo "Try this:"
    echo "  1. Re-export certificate with a password that is ONLY letters and numbers"
    echo "  2. No spaces, no special characters at all"
    echo "  3. Example: 'MyPassword123' (not 'My Password 123!' or 'MyPass@123')"
    echo ""
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "   ✅ Private key extracted successfully!"

# Extract certificate
echo "$CERT_PASSWORD" | openssl pkcs12 -in "$CERT_PATH" -clcerts -nokeys -out "$CERT_PEM" -passin stdin 2>&1

if [ $? -ne 0 ]; then
    openssl pkcs12 -in "$CERT_PATH" -clcerts -nokeys -out "$CERT_PEM" -passin "pass:$CERT_PASSWORD" 2>&1
fi

# Sign manifest
echo "🔐 Signing manifest..."
openssl smime -binary -sign -certfile "$WWDR_PATH" \
    -signer "$CERT_PEM" -inkey "$KEY_PATH" \
    -in manifest.json -out signature -outform DER

if [ ! -f signature ]; then
    echo "❌ Failed to create signature"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Create .pkpass
cd "$TEMP_DIR"
zip -r "$OUTPUT_DIR/${PASS_NAME}.pkpass" pass > /dev/null

rm -rf "$TEMP_DIR"

echo ""
echo "✅ Build complete!"
echo "📁 Output: ${OUTPUT_DIR}${PASS_NAME}.pkpass"
echo ""
echo "📱 Test by transferring to iPhone and adding to Wallet!"
