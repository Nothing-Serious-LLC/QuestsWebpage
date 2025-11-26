# Quest Card Setup Guide

## Quick Start

### Option 1: Use Online Service (Easiest - No Coding)

1. **Go to https://www.passsource.com/** (or similar service)
2. Upload your pass.json file
3. Upload your images (icon, logo, strip)
4. Sign with your Apple Developer account
5. Download the .pkpass file
6. Place `QuestCard.pkpass` in your website root directory
7. Users can download from `https://thequestsapp.com/get-card.html`

### Option 2: Build Locally (Requires Developer Account)

#### Prerequisites:
- Apple Developer account ($99/year)
- Pass Type ID certificate from Apple Developer portal
- WWDR certificate from Apple

#### Steps:

1. **Create Pass Type ID:**
   - Go to https://developer.apple.com/account/resources/identifiers/list
   - Create new Pass Type ID: `pass.com.thequestsapp.questcard`
   - Download certificate and export as .p12

2. **Download WWDR Certificate:**
   - Download from: https://developer.apple.com/certificationauthority/AppleWWDRCA.cer
   - Convert to .pem: `openssl x509 -inform DER -in AppleWWDRCA.cer -out wwdr.pem`

3. **Update pass.json:**
   - Replace `YOUR_TEAM_ID` with your Apple Team ID (found in Developer portal)
   - Verify `passTypeIdentifier` matches your Pass Type ID

4. **Add Images:**
   - Place required images in this folder (see README.md for sizes)
   - Minimum: `icon.png`, `icon@2x.png`, `icon@3x.png`, `logo.png`, `logo@2x.png`, `logo@3x.png`

5. **Build the Pass:**
   ```bash
   cd QuestCard.pass
   ./build.sh
   ```
   Or manually:
   ```bash
   # Create zip with all files
   zip -r QuestCard.pkpass *
   
   # Sign (requires certificates - see Apple documentation)
   ```

6. **Deploy:**
   - Place `QuestCard.pkpass` in website root
   - Serve over HTTPS (required for Wallet passes)
   - Test download from `https://thequestsapp.com/get-card.html`

## Testing

### On iPhone:
1. Email the .pkpass file to yourself
2. Open email on iPhone
3. Tap attachment → "Add to Wallet"
4. Or use AirDrop to send directly to another iPhone

### AirDrop Sharing:
Once someone has the pass in Wallet:
1. Open Wallet app
2. Tap the Quest Card
3. Tap (i) icon in corner
4. Tap "Share Pass"
5. Choose AirDrop contact or other sharing method

## Current Status

✅ Pass structure created
✅ QR code configured (links to App Store)
✅ Download page created
⏳ Waiting for images
⏳ Waiting for signing/setup

## Next Steps

1. **Design images** (use `/Users/elliottthornburgsmac/Downloads/image_requirements.md` as guide)
2. **Get Apple Developer account** (if you don't have one)
3. **Create Pass Type ID** and download certificate
4. **Sign the pass** using online service or local tools
5. **Test on device** before deploying
6. **Deploy to website** and share!

## Troubleshooting

**"Pass is invalid" error:**
- Pass must be signed with valid certificate
- Must be served over HTTPS
- Check that all required files are included

**Images not showing:**
- Verify image sizes are correct
- Check file names match exactly (case-sensitive)
- Ensure PNG format (not JPG)

**QR code not scanning:**
- Verify URL in pass.json barcode.message field
- Test URL manually in browser first
- Check that barcode format is PKBarcodeFormatQR

## Resources

- Apple Wallet Guide: https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/
- Pass Type ID Setup: https://developer.apple.com/documentation/passkit/pkpass
- Online Pass Builder: https://www.passsource.com/
- Testing Tools: https://www.passninja.com/
