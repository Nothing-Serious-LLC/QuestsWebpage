# Quest Card - Quick Start Guide

## What We Built

✅ **Apple Wallet Pass** with QR code linking to App Store
✅ **Download page** at `/get-card.html` 
✅ **QR code** that opens App Store when scanned
✅ **AirDrop sharing** capability (via Wallet's "Share Pass" feature)

## How It Works

1. **User downloads pass** → Gets Quest Card in Apple Wallet
2. **User opens card in Wallet** → Sees QR code and app info
3. **Friend scans QR code** → Opens App Store automatically
4. **User shares pass** → Tap (i) icon → "Share Pass" → AirDrop/Messages

## About "Holding Phones Together"

⚠️ **Important:** iOS doesn't automatically share when phones touch. Here's how sharing actually works:

### What DOES Work:
- ✅ **NFC tap** (if you have NFC tag) → Instant open
- ✅ **AirDrop** (manual) → Share Pass from Wallet → Select contact
- ✅ **QR code scan** → Friend scans your phone screen

### What DOESN'T Work:
- ❌ **Touching phones** → No automatic sharing (not a feature)
- ❌ **Automatic AirDrop** → Requires manual selection

### Best User Experience:
1. You show your phone with Wallet pass open
2. Friend scans QR code with their camera
3. Or you share pass via AirDrop (tap (i) → Share Pass → AirDrop)

## Setup Steps

### Step 1: Generate Images (Easy)
```bash
cd QuestCard.pass
./prepare-images.sh
```
This uses your existing `icon.png` to create all required sizes.

### Step 2: Get Pass Signed

**Option A: Online Service (Recommended)**
1. Go to https://www.passsource.com/
2. Upload `pass.json` and all images
3. Sign with Apple Developer account
4. Download `QuestCard.pkpass`

**Option B: Local Build**
1. Get Apple Developer account
2. Create Pass Type ID
3. Download certificates
4. Update `pass.json` with Team ID
5. Run `./build.sh`

### Step 3: Deploy
1. Place `QuestCard.pkpass` in website root
2. Test at `https://thequestsapp.com/get-card.html`
3. Share the link!

## File Structure

```
QuestCard.pass/
├── pass.json              # Pass configuration (QR code, colors, text)
├── icon.png              # Wallet icon (29×29) - generated
├── icon@2x.png           # Wallet icon (58×58) - generated
├── icon@3x.png           # Wallet icon (87×87) - generated
├── logo.png              # Header logo (160×50) - generated
├── logo@2x.png           # Header logo (320×100) - generated
├── logo@3x.png           # Header logo (480×150) - generated
├── prepare-images.sh     # Script to generate images
├── build.sh              # Script to build .pkpass file
├── README.md             # Detailed documentation
├── SETUP.md              # Setup instructions
└── QUICK_START.md        # This file

Website root/
├── get-card.html         # Download page for the pass
└── QuestCard.pkpass      # Final signed pass file (after building)
```

## Testing

### On Your iPhone:
1. Build/sign the pass
2. Email `QuestCard.pkpass` to yourself
3. Open email on iPhone
4. Tap attachment → "Add to Wallet"
5. Open Wallet → Tap Quest Card
6. Verify QR code shows and scans correctly

### Sharing Test:
1. Add pass to Wallet on your iPhone
2. Open pass in Wallet
3. Tap (i) icon in corner
4. Tap "Share Pass"
5. Try AirDrop to another iPhone
6. Recipient adds to Wallet
7. They scan QR code → Should open App Store ✅

## Current Status

- ✅ Pass structure created
- ✅ QR code configured (App Store link)
- ✅ Download page created (`/get-card.html`)
- ✅ Image generation script ready
- ⏳ Need to run `prepare-images.sh`
- ⏳ Need to sign pass
- ⏳ Need to deploy `QuestCard.pkpass` to website

## Next Actions

1. **Run image generation:**
   ```bash
   cd QuestCard.pass
   ./prepare-images.sh
   ```

2. **Review generated images** (especially logo - may need manual adjustment)

3. **Sign the pass** using passsource.com or local build

4. **Test on device** before deploying

5. **Deploy to website** and start sharing!

## Questions?

- See `SETUP.md` for detailed setup
- See `README.md` for pass configuration
- See `/Users/elliottthornburgsmac/Downloads/image_requirements.md` for design guide
