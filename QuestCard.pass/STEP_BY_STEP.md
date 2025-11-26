# Step-by-Step Guide: Creating Your Apple Wallet Pass

Follow these steps in order. Each step builds on the previous one.

---

## 📋 STEP 1: Get Your Apple Developer Team ID

1. **Go to**: https://developer.apple.com/account/
2. **Sign in** with your Apple Developer account
3. **Look at the top right corner** - you'll see "Team: [YOUR_TEAM_ID]"
   - Example: `Team: ABC1234DEF`
4. **Copy your Team ID** - you'll need it in Step 3

**✅ When done:** You should have your Team ID (e.g., `ABC1234DEF`)

---

## 📋 STEP 2: Update pass.json with Your Team ID

Open `pass.json` and replace `YOUR_TEAM_ID` with your actual Team ID:

```bash
cd /Users/elliottthornburgsmac/Documents/QuestsWebpage/QuestCard.pass
# Open pass.json and replace YOUR_TEAM_ID with your actual Team ID
```

Or use this command (replace `YOUR_ACTUAL_TEAM_ID`):

```bash
cd /Users/elliottthornburgsmac/Documents/QuestsWebpage/QuestCard.pass
sed -i '' 's/YOUR_TEAM_ID/YOUR_ACTUAL_TEAM_ID/g' pass.json
```

**✅ When done:** `pass.json` should have your real Team ID, not "YOUR_TEAM_ID"

---

## 📋 STEP 3: Create Pass Type ID in Apple Developer Portal

1. **Go to**: https://developer.apple.com/account/resources/identifiers/list
2. **Click the "+" button** (top left, blue button)
3. **Select "Pass Type IDs"**
4. **Click "Continue"**
5. **Fill in:**
   - Description: `Quest Card Pass`
   - Identifier: `pass.com.thequestsapp.questcard`
6. **Click "Continue"**
7. **Click "Register"**

**✅ When done:** You should see "pass.com.thequestsapp.questcard" in your identifiers list

---

## 📋 STEP 4: Create Pass Type ID Certificate

### Part A: Generate Certificate Signing Request (CSR)

1. **Open Keychain Access** (Applications → Utilities → Keychain Access)
2. **Menu**: Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
3. **Fill in the form:**
   - User Email Address: Your email
   - Common Name: `Quest Card Certificate` (or any name)
   - CA Email Address: Leave empty
   - Request is: Select **"Saved to disk"**
4. **Click "Continue"**
5. **Save the file** as `QuestCardCertificateSigningRequest.certSigningRequest`
   - Save it somewhere easy to find (like Desktop or Downloads)

**✅ When done:** You should have a `.certSigningRequest` file saved

### Part B: Create Certificate in Developer Portal

1. **Go to**: https://developer.apple.com/account/resources/identifiers/list
2. **Click on** `pass.com.thequestsapp.questcard` (the one you just created)
3. **Check the box** next to "Pass Type ID Certificate"
4. **Click "Edit"** (top right)
5. **Click "Create Certificate"**
6. **Click "Choose File"** and select your `.certSigningRequest` file
7. **Click "Continue"**
8. **Click "Download"** to download the certificate (`.cer` file)

**✅ When done:** You should have downloaded a `.cer` file

---

## 📋 STEP 5: Export Certificate as .p12 File

1. **Double-click** the downloaded `.cer` file to install it in Keychain
2. **Open Keychain Access** (if not already open)
3. **Search for**: `Pass Type ID: pass.com.thequestsapp.questcard`
   - Make sure you're looking in "login" keychain (not System)
4. **Right-click** on the certificate → **"Export"**
5. **Save as**: `questcard-cert.p12`
   - Save to a location you can find (like Desktop or Downloads)
6. **Set a password** when prompted
   - ⚠️ **REMEMBER THIS PASSWORD** - you'll need it later!
   - Save the password somewhere safe
7. **Click "OK"** and enter your Mac password if prompted

**✅ When done:** You should have a `.p12` file saved, and you know the password

---

## 📋 STEP 6: Download Apple WWDR Certificate

Run these commands in Terminal:

```bash
# Create a directory for certificates
mkdir -p ~/.questcard-certs
cd ~/.questcard-certs

# Download Apple's WWDR certificate
curl -O https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer

# Convert to PEM format
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem

# Verify it worked
ls -lh wwdr.pem
```

You should see `wwdr.pem` file created.

**✅ When done:** You should have `wwdr.pem` in `~/.questcard-certs/`

---

## 📋 STEP 7: Build and Sign Your Pass

Now you have everything you need! Build the pass:

```bash
cd /Users/elliottthornburgsmac/Documents/QuestsWebpage/QuestCard.pass

# Set your certificate paths (replace with your actual paths!)
export CERT_PATH="/path/to/your/questcard-cert.p12"  # ← Change this!
export CERT_PASSWORD="your_certificate_password"      # ← Change this!
export WWDR_PATH="$HOME/.questcard-certs/wwdr.pem"

# Build the pass
./build-proper.sh
```

**Example** (if your .p12 is in Downloads):
```bash
export CERT_PATH="$HOME/Downloads/questcard-cert.p12"
export CERT_PASSWORD="MySecurePassword123"
export WWDR_PATH="$HOME/.questcard-certs/wwdr.pem"
./build-proper.sh
```

**✅ When done:** You should see:
```
✅ Build complete!
📁 Output: /Users/.../QuestCard.pkpass
```

---

## 📋 STEP 8: Test Your Pass

1. **Find your pass file**: `QuestCard.pkpass` in the QuestsWebpage directory
2. **Transfer to iPhone** (choose one):
   - **Email**: Email it to yourself, open on iPhone
   - **AirDrop**: AirDrop from Mac to iPhone
   - **Website**: Upload to your website and download via Safari on iPhone
3. **On iPhone**: Tap the `.pkpass` file
4. **Tap**: "Add to Apple Wallet"
5. **Open Wallet app** - your Quest Card should be there!

**✅ When done:** Pass should appear in Wallet app with QR code

---

## 🔧 Quick Reference: File Locations

After completing all steps, you should have:

- ✅ `pass.json` - Updated with your Team ID
- ✅ `questcard-cert.p12` - Your Pass Type ID certificate (with password)
- ✅ `~/.questcard-certs/wwdr.pem` - Apple WWDR certificate
- ✅ `QuestCard.pkpass` - Your final signed pass!

---

## ❌ Troubleshooting

### "Pass is invalid" error
- ✅ Check Team ID in pass.json matches your Developer account
- ✅ Verify Pass Type ID is correct: `pass.com.thequestsapp.questcard`
- ✅ Make sure certificate wasn't revoked in Developer portal

### "Certificate not found" error
- ✅ Check the path to your `.p12` file is correct
- ✅ Make sure the file exists: `ls -lh "$CERT_PATH"`

### "Wrong password" error
- ✅ Double-check the password you set when exporting .p12
- ✅ Make sure there are no extra spaces

### Build script fails
- ✅ Make sure you ran all commands in the QuestCard.pass directory
- ✅ Verify openssl is installed: `which openssl`
- ✅ Check file permissions: `ls -la build-proper.sh`

---

## 🚀 Alternative: Use the Interactive Script

Instead of doing it manually, you can run the interactive walkthrough:

```bash
cd /Users/elliottthornburgsmac/Documents/QuestsWebpage/QuestCard.pass
./setup-walkthrough.sh
```

This script will guide you through each step interactively!

---

## ✅ You're Done!

Once your pass is built and tested, you can:
1. Upload `QuestCard.pkpass` to your website
2. Link to it from `/get-card.html`
3. Share it with users!

🎉 Congratulations - you've created your Apple Wallet pass!
