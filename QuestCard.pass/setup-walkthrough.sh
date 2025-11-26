#!/bin/bash

# Interactive Walkthrough Script for Apple Wallet Pass Setup

echo "═══════════════════════════════════════════════════════════════"
echo "  Apple Wallet Pass - Step-by-Step Setup Guide"
echo "═══════════════════════════════════════════════════════════════"
echo ""

PASS_DIR="$(cd "$(dirname "$0")" && pwd)"

# Step 1: Check Apple Developer Account
echo "📋 STEP 1: Apple Developer Account"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Do you have an Apple Developer account? (y/n)"
read -r has_account

if [ "$has_account" != "y" ]; then
    echo ""
    echo "❌ You need an Apple Developer account to create signed passes."
    echo "   Sign up at: https://developer.apple.com/programs/"
    echo "   Cost: \$99/year"
    exit 1
fi

echo ""
echo "✅ Good! Let's continue..."
echo ""

# Step 2: Get Team ID
echo "📋 STEP 2: Get Your Team ID"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Your Team ID is shown in your Apple Developer account."
echo ""
echo "To find it:"
echo "  1. Go to: https://developer.apple.com/account/"
echo "  2. Look at the top right corner for 'Team: [TEAM_ID]'"
echo "     (It looks like: ABC1234DEF)"
echo ""
echo "Enter your Team ID:"
read -r TEAM_ID

if [ -z "$TEAM_ID" ]; then
    echo "❌ Team ID is required!"
    exit 1
fi

echo ""
echo "✅ Team ID captured: $TEAM_ID"
echo ""

# Step 3: Update pass.json
echo "📋 STEP 3: Update pass.json with Team ID"
echo "───────────────────────────────────────────────────────────────"
echo ""

# Update pass.json with Team ID
if [ -f "$PASS_DIR/pass.json" ]; then
    # Use sed to replace YOUR_TEAM_ID (works on macOS)
    sed -i '' "s/YOUR_TEAM_ID/$TEAM_ID/g" "$PASS_DIR/pass.json"
    echo "✅ Updated pass.json with Team ID: $TEAM_ID"
else
    echo "❌ pass.json not found!"
    exit 1
fi

echo ""

# Step 4: Create Pass Type ID
echo "📋 STEP 4: Create Pass Type ID"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Now we need to create a Pass Type ID in Apple Developer portal."
echo ""
echo "1. Open this URL: https://developer.apple.com/account/resources/identifiers/list"
echo "2. Click the '+' button (top left)"
echo "3. Select 'Pass Type IDs'"
echo "4. Click 'Continue'"
echo "5. Description: 'Quest Card Pass'"
echo "6. Identifier: 'pass.com.thequestsapp.questcard'"
echo "7. Click 'Continue' and then 'Register'"
echo ""
echo "Have you created the Pass Type ID? (y/n)"
read -r created_pass_type

if [ "$created_pass_type" != "y" ]; then
    echo ""
    echo "⏸️  Please create the Pass Type ID first, then run this script again."
    exit 0
fi

echo ""
echo "✅ Pass Type ID should be created!"
echo ""

# Step 5: Create Certificate
echo "📋 STEP 5: Create Pass Type ID Certificate"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Now we need to create a certificate for the Pass Type ID."
echo ""
echo "1. Go to: https://developer.apple.com/account/resources/identifiers/list"
echo "2. Click on your Pass Type ID: pass.com.thequestsapp.questcard"
echo "3. Check 'Pass Type ID Certificate'"
echo "4. Click 'Edit' (top right)"
echo "5. Click 'Create Certificate'"
echo "6. Follow these steps:"
echo "   a. Open 'Keychain Access' app (in Applications/Utilities)"
echo "   b. Menu: Keychain Access → Certificate Assistant → Request a Certificate"
echo "   c. User Email: Your email"
echo "   d. Common Name: Quest Card Certificate (or any name)"
echo "   e. CA Email: Leave empty"
echo "   f. Request is: 'Saved to disk'"
echo "   g. Click 'Continue' and save the .certSigningRequest file"
echo "7. Back in browser: Upload the .certSigningRequest file"
echo "8. Click 'Continue'"
echo "9. Download the certificate (.cer file)"
echo ""
echo "Have you downloaded the certificate? (y/n)"
read -r downloaded_cert

if [ "$downloaded_cert" != "y" ]; then
    echo ""
    echo "⏸️  Please download the certificate first, then run this script again."
    exit 0
fi

echo ""
echo "Now we need to convert the certificate to .p12 format:"
echo ""
echo "1. Double-click the downloaded .cer file to install in Keychain"
echo "2. Open Keychain Access"
echo "3. Search for 'Pass Type ID: pass.com.thequestsapp.questcard'"
echo "4. Right-click on it → 'Export'"
echo "5. Save as: 'questcard-cert.p12'"
echo "6. Set a password (REMEMBER THIS PASSWORD!)"
echo "7. Choose a location to save (like Downloads folder)"
echo ""
echo "Enter the full path to your .p12 certificate file:"
read -r CERT_PATH

if [ ! -f "$CERT_PATH" ]; then
    echo "❌ File not found: $CERT_PATH"
    echo "   Please check the path and try again."
    exit 1
fi

echo ""
echo "✅ Certificate found: $CERT_PATH"
echo ""
echo "Enter the password you set when exporting the .p12 file:"
read -rs CERT_PASSWORD

echo ""

# Step 6: Download WWDR Certificate
echo "📋 STEP 6: Download Apple WWDR Certificate"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "We need Apple's WWDR (Worldwide Developer Relations) certificate."
echo ""

WWDR_DIR="$HOME/.questcard-certs"
mkdir -p "$WWDR_DIR"
WWDR_CER="$WWDR_DIR/AppleWWDRCAG4.cer"
WWDR_PEM="$WWDR_DIR/wwdr.pem"

if [ ! -f "$WWDR_PEM" ]; then
    echo "Downloading WWDR certificate..."
    
    # Download WWDR certificate
    curl -o "$WWDR_CER" "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Downloaded WWDR certificate"
        
        # Convert to PEM
        openssl x509 -inform DER -in "$WWDR_CER" -out "$WWDR_PEM" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "✅ Converted to PEM format"
        else
            echo "❌ Failed to convert certificate"
            exit 1
        fi
    else
        echo "❌ Failed to download WWDR certificate"
        echo "   You can download manually from:"
        echo "   https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer"
        exit 1
    fi
else
    echo "✅ WWDR certificate already exists: $WWDR_PEM"
fi

echo ""

# Step 7: Build the Pass
echo "📋 STEP 7: Build and Sign the Pass"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Now we'll build and sign your pass with all the certificates!"
echo ""

# Set environment variables
export CERT_PATH
export CERT_PASSWORD
export WWDR_PATH="$WWDR_PEM"

# Run the build script
cd "$PASS_DIR"
./build-proper.sh

BUILD_STATUS=$?

if [ $BUILD_STATUS -eq 0 ]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  ✅ SUCCESS! Your pass is ready!"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "📁 Your signed pass is at:"
    echo "   $(dirname "$PASS_DIR")/QuestCard.pkpass"
    echo ""
    echo "📱 Next steps to test:"
    echo "   1. Transfer the .pkpass file to your iPhone:"
    echo "      - Email it to yourself"
    echo "      - AirDrop it"
    echo "      - Host it on your website"
    echo "   2. Tap the file on iPhone"
    echo "   3. Tap 'Add to Apple Wallet'"
    echo "   4. Open Wallet app to see your pass!"
    echo ""
    echo "🎉 You're done! The pass is signed and ready to use."
else
    echo ""
    echo "❌ Build failed. Check the error messages above."
    exit 1
fi
