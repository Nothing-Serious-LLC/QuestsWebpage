#!/bin/bash

# Build pass by extracting certificate directly from Keychain (bypasses .p12 password issues)

cd "$(dirname "$0")"

PASS_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS_NAME="QuestCard"
OUTPUT_DIR="$PASS_DIR/../"
TEMP_DIR=$(mktemp -d)
PASS_CONTENTS="$TEMP_DIR/pass"

echo "🔨 Building Apple Wallet Pass (Direct from Keychain)"
echo ""

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
WWDR_PATH="${WWDR_PATH:-$HOME/.questcard-certs/wwdr.pem}"

# Download WWDR if needed
if [ ! -f "$WWDR_PATH" ]; then
    echo "📥 Downloading WWDR certificate..."
    mkdir -p "$(dirname "$WWDR_PATH")"
    curl -o "$(dirname "$WWDR_PATH")/AppleWWDRCAG4.cer" "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer" 2>/dev/null
    openssl x509 -inform DER -in "$(dirname "$WWDR_PATH")/AppleWWDRCAG4.cer" -out "$WWDR_PATH" 2>/dev/null
fi

CERT_NAME="Pass Type ID: pass.com.thequestsapp.questcard"

echo "🔐 Extracting certificate from Keychain..."
echo "   (This will prompt for your Mac password to access Keychain)"
echo ""

# Extract certificate and key directly from Keychain using security command
# This bypasses the .p12 password issue
security find-certificate -c "$CERT_NAME" -p > "$CERT_PEM" 2>&1

if [ $? -ne 0 ] || [ ! -s "$CERT_PEM" ]; then
    echo "❌ Failed to extract certificate from Keychain"
    echo "   Make sure the certificate is in your login keychain"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "✅ Certificate extracted from Keychain"

# Extract private key from Keychain
echo "🔐 Extracting private key from Keychain..."
security find-generic-password -a "$(whoami)" -s "$CERT_NAME" -w 2>/dev/null > /dev/null

# Try to find and export the private key
# This is trickier - we might need to use the certificate we already have
# and get the key separately

# For now, let's try a workaround: use openssl to extract from the cert in Keychain
# We'll need to get the keypair somehow

# Alternative: Export just the key from Keychain
echo "   Attempting to extract private key..."

# Use security to export the key
security find-generic-password -a "$(whoami)" -s "$CERT_NAME" -w 2>/dev/null

# If that doesn't work, try exporting the certificate again but this time
# we'll use a different method

# Actually, the best approach might be to create a temporary keychain and import/export
TEMP_KEYCHAIN="$TEMP_DIR/temp.keychain-db"
TEMP_PASS="temp$(date +%s)"

echo "   Creating temporary keychain for extraction..."
security create-keychain -p "$TEMP_PASS" "$TEMP_KEYCHAIN" 2>&1 | grep -v "already exists"

if [ -f "$HOME/Documents/questcard.p12" ]; then
    echo "   Importing .p12 to temporary keychain (will prompt for password)..."
    security import "$HOME/Documents/questcard.p12" -k "$TEMP_KEYCHAIN" -P "" -T /usr/bin/security 2>&1
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Imported to temporary keychain"
        
        # Now extract from temporary keychain
        security find-certificate -c "$CERT_NAME" -k "$TEMP_KEYCHAIN" -p > "$CERT_PEM" 2>&1
        
        # Try to get the key - this is complex, so let's use openssl on the imported cert
        # Actually, we can try to export again from the temp keychain without password issues
        
        # For now, let's just try the openssl method but tell user to try with empty password
        echo ""
        echo "   Trying to extract private key (password might be empty or your Mac password)..."
        
        # Try empty password first (sometimes Keychain exports don't need it if accessed directly)
        openssl pkcs12 -in "$HOME/Documents/questcard.p12" -nocerts -nodes -out "$KEY_PATH" -passin pass: 2>&1 | head -5
        
        if [ -f "$KEY_PATH" ] && [ -s "$KEY_PATH" ]; then
            echo "   ✅ Extracted with empty password!"
        else
            # Try with Mac password (sometimes Keychain uses this)
            echo "   Please enter your Mac login password (sometimes Keychain uses this):"
            read -rs MAC_PASSWORD
            echo ""
            
            openssl pkcs12 -in "$HOME/Documents/questcard.p12" -nocerts -nodes -out "$KEY_PATH" -passin "pass:$MAC_PASSWORD" 2>&1 | head -5
            
            if [ ! -f "$KEY_PATH" ] || [ ! -s "$KEY_PATH" ]; then
                echo ""
                echo "❌ Still having issues. Let's try one more thing..."
                echo ""
                echo "The .p12 file might need to be re-exported with a specific method."
                echo ""
                echo "Try this in Keychain Access:"
                echo "  1. Select the certificate"
                echo "  2. Right-click → 'Export'"
                echo "  3. Format: '.p12'"
                echo "  4. UNCHECK 'Include extended attributes'"
                echo "  5. Leave password EMPTY (just press Enter)"
                echo "  6. Save and try again"
                echo ""
                security delete-keychain "$TEMP_KEYCHAIN" 2>/dev/null
                rm -rf "$TEMP_DIR"
                exit 1
            fi
        fi
    fi
fi

security delete-keychain "$TEMP_KEYCHAIN" 2>/dev/null

if [ ! -f "$KEY_PATH" ] || [ ! -s "$KEY_PATH" ]; then
    echo "❌ Could not extract private key"
    echo "   The certificate export might have an issue"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "✅ Private key extracted!"

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
