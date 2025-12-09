# Troubleshooting: Wallet Pass "Add Button" Won't Click

## Problem
Pass validates correctly online, shows "Add" button when shared via email/text, but the button is grayed out or won't click.

## Common Causes & Solutions

### 1. Certificate Trust Issue (Most Common)

**Symptom:** Works when downloaded directly to your device, but fails when shared to another device.

**Cause:** The receiving device doesn't trust your Pass Type ID certificate. This is normal - iOS needs to verify the certificate.

**Solutions:**
- ✅ **Install on same device first** - Test by downloading directly from your website
- ✅ **Use HTTPS** - Pass must be served over HTTPS (GitHub Pages does this automatically)
- ✅ **Wait a few seconds** - Sometimes iOS needs time to verify the certificate
- ⚠️ **Certificate must be valid** - Check expiration date in Keychain Access

**If still doesn't work:**
1. Check certificate expiration:
   - Open Keychain Access
   - Find "Pass Type ID: pass.com.thequestsapp.questcard"
   - Check expiration date (must be in future)
2. Re-export certificate from Keychain (uncheck "Include extended attributes")

### 2. Missing or Corrupted Images

**Symptom:** Pass shows in preview but "Add" button is disabled.

**Solution:**
```bash
cd QuestCard.pass
./prepare-images.sh
./build-enhanced.sh
```

**Required images:**
- `icon.png`, `icon@2x.png`, `icon@3x.png`
- `logo.png`, `logo@2x.png`, `logo@3x.png`

All must be valid PNG files and included in the pass.

### 3. Pass Structure Issues

**Check pass.json:**
- Must have `primaryFields` (at least one)
- Must have `barcode` or `barcodes` array
- Must have `logoText` or `logo` reference
- All required top-level fields present

### 4. Sharing Method Issues

**Email:**
- ✅ Works best when attachment is direct `.pkpass` file
- ✅ MIME type should be `application/vnd.apple.pkpass`
- ✅ Attachment size should be reasonable (< 500KB)

**Text Messages:**
- ✅ Works if sent as attachment
- ⚠️ May not work if sent as link (depends on MIME type serving)

**Website Download:**
- ✅ Must be HTTPS
- ✅ Direct link to `.pkpass` file
- ✅ Correct MIME type headers (see `.htaccess` or `_headers`)

### 5. Device-Specific Issues

**Try:**
1. Update iOS to latest version
2. Restart iPhone
3. Clear Safari cache
4. Try on different iPhone
5. Check Settings → General → VPN & Device Management (shouldn't block Wallet)

## Quick Diagnostic Steps

1. **Check pass contents:**
   ```bash
   ./check-pass-contents.sh
   ```

2. **Rebuild with enhanced script:**
   ```bash
   cd QuestCard.pass
   export CERT_PATH="$HOME/Documents/cardfixed.p12"
   export CERT_PASSWORD=""
   export WWDR_PATH="$HOME/.questcard-certs/wwdr.pem"
   ./build-enhanced.sh
   ```

3. **Test on same device:**
   - Download directly from: https://thequestsapp.com/get-card.html
   - If works here → Certificate trust issue when sharing
   - If fails here → Pass structure/certificate issue

4. **Validate online:**
   - Upload to: https://pkpassvalidator.azurewebsites.net/
   - Fix any errors shown

## Expected Behavior

### ✅ Working Correctly:
- Pass downloads from website
- Tap "Add to Apple Wallet" button
- Wallet opens automatically
- Pass appears in Wallet
- Can share pass via Wallet's "Share Pass" feature

### ❌ Not Working:
- "Add" button grayed out
- "Cannot be installed" error
- Pass downloads but Wallet doesn't open
- Certificate warning appears

## Still Not Working?

1. Verify certificate is valid (not expired)
2. Rebuild pass from scratch using enhanced build script
3. Test on multiple devices
4. Check Apple Developer account status
5. Verify Pass Type ID is correctly configured

## Notes

- **Certificate trust is device-specific** - A pass that works on your device may not work on another until iOS verifies the certificate
- **First installation may take longer** - iOS needs to verify certificate chain
- **Some restrictions may apply** - Enterprise/managed devices may have restrictions

