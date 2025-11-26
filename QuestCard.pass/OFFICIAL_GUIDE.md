# Official Apple Wallet Pass Creation Guide

This guide explains how to create and sign Apple Wallet passes using **only Apple's official methods** and open-source tools.

## Prerequisites

1. **Apple Developer Account** ($99/year)
   - Sign up at: https://developer.apple.com/programs/
   
2. **Command-line tools** (already on macOS):
   - `openssl` (for signing)
   - `shasum` (for creating manifest)
   - `zip` (for packaging)
   - `python3` (for JSON formatting)

## Step-by-Step Process

### Step 1: Register Pass Type Identifier

1. Go to: https://developer.apple.com/account/resources/identifiers/list
2. Click the **"+"** button
3. Select **"Pass Type IDs"**
4. Enter identifier: `pass.com.thequestsapp.questcard`
5. Click **"Continue"** and **"Register"**

### Step 2: Create Pass Type ID Certificate

1. In the Pass Type IDs list, click on your newly created identifier
2. Check **"Pass Type ID Certificate"**
3. Click **"Edit"**
4. Click **"Create Certificate"**
5. Follow instructions to:
   - Create a Certificate Signing Request (CSR) using Keychain Access
   - Upload the CSR
   - Download the certificate
6. Double-click the downloaded `.cer` file to install in Keychain
7. Export as `.p12`:
   - Open Keychain Access
   - Find "Pass Type ID: pass.com.thequestsapp.questcard"
   - Right-click → Export → Save as `.p12`
   - **Remember the password you set!**

### Step 3: Download Apple WWDR Certificate

1. Download from: https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
2. Convert to PEM format:
   ```bash
   openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
   ```
3. Save `wwdr.pem` somewhere safe

### Step 4: Prepare Your Pass Files

Your pass directory should contain:
- `pass.json` - Pass configuration (already created)
- `icon.png`, `icon@2x.png`, `icon@3x.png` - Wallet icons
- `logo.png`, `logo@2x.png`, `logo@3x.png` - Header logos
- Any other images

Run the image generation script:
```bash
cd QuestCard.pass
./prepare-images.sh
```

### Step 5: Update pass.json

Edit `pass.json` and replace:
- `YOUR_TEAM_ID` → Your Apple Team ID (found in Developer portal)

### Step 6: Build and Sign the Pass

Use the official build script:

```bash
cd QuestCard.pass

# Set certificate paths
export CERT_PATH="/path/to/your/passcertificate.p12"
export CERT_PASSWORD="your_certificate_password"
export WWDR_PATH="/path/to/wwdr.pem"

# Build and sign
./build-proper.sh
```

This will:
1. ✅ Create `manifest.json` with SHA1 hashes of all files
2. ✅ Sign the manifest using your certificate
3. ✅ Package everything into `QuestCard.pkpass`

### Step 7: Test the Pass

1. Transfer `QuestCard.pkpass` to your iPhone:
   - Email it to yourself
   - AirDrop it
   - Host it on your website and download via Safari
   
2. Tap the file on iPhone → "Add to Apple Wallet"

3. Verify:
   - Pass displays correctly
   - QR code scans and opens App Store
   - No "unsigned" warnings

## How the Signing Process Works

### 1. Manifest Creation
The `manifest.json` file contains SHA1 hashes of every file in the pass:
```json
{
  "pass.json": "abc123...",
  "icon.png": "def456...",
  "logo.png": "ghi789..."
}
```

### 2. Signing the Manifest
The manifest is signed using:
- Your Pass Type ID certificate (private key)
- Apple's WWDR (Worldwide Developer Relations) certificate

The signature is created in PKCS7/DER format and saved as `signature`.

### 3. Packaging
The `.pkpass` file is simply a ZIP archive containing:
- `pass.json`
- `manifest.json`
- `signature`
- All image files

### 4. Verification
When a user adds the pass to Wallet, iOS:
1. Verifies the signature against Apple's WWDR certificate
2. Checks that file hashes match the manifest
3. Validates the Pass Type ID matches your certificate

## Troubleshooting

### "Pass is invalid" error
- ✅ Check certificate is valid and not expired
- ✅ Verify WWDR certificate is correct (G4, not older versions)
- ✅ Ensure `teamIdentifier` in pass.json matches your Team ID
- ✅ Make sure `passTypeIdentifier` matches your registered Pass Type ID

### "Unsigned pass" warning
- ✅ The pass wasn't signed - run `build-proper.sh` with certificates
- ✅ Check certificate password is correct
- ✅ Verify certificate file path is correct

### Signature verification fails
- ✅ Ensure you're using the correct WWDR certificate (G4)
- ✅ Check that certificate wasn't revoked in Developer portal
- ✅ Verify openssl commands ran successfully

## Security Notes

- ⚠️ **Never commit certificates to git**
- ⚠️ **Keep .p12 password secure**
- ⚠️ **Don't share private keys**
- ✅ Store certificates in secure location (Keychain or encrypted storage)
- ✅ Use environment variables for passwords, not hardcoded

## Alternative: Test Without Full Setup

If you just want to test the structure without signing:
```bash
cd QuestCard.pass
# Don't set certificate variables
./build-proper.sh
```

This creates an unsigned `.pkpass` file. It may work for testing, but will show warnings in Wallet and may not function properly.

## Resources

- **Apple PassKit Documentation**: https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/
- **Pass Type ID Setup**: https://developer.apple.com/help/account/capabilities/create-wallet-identifiers-and-certificates/
- **WWDR Certificate**: https://www.apple.com/certificateauthority/

## File Structure

```
QuestCard.pass/
├── pass.json              # Pass configuration
├── manifest.json          # Generated (SHA1 hashes)
├── signature              # Generated (PKCS7 signature)
├── icon.png              # Wallet icons
├── logo.png              # Header logos
├── build-proper.sh       # Official build script
└── prepare-images.sh     # Image generator
```

The final `.pkpass` file contains all of these (except the scripts).
