# Quest Card - Apple Wallet Pass

This is an Apple Wallet pass that allows users to easily download the Quests app via QR code scan.

## Image Requirements

Place the following images in this folder:

### Required Images:
- `icon.png` (29×29px) - Small icon shown on the pass
- `icon@2x.png` (58×58px)
- `icon@3x.png` (87×87px)
- `logo.png` (160×50px) - Logo banner at top
- `logo@2x.png` (320×100px)
- `logo@3x.png` (480×150px)

### Optional but Recommended:
- `strip.png` (375×123px) - Hero image on pass
- `strip@2x.png` (750×246px)
- `strip@3x.png` (1125×369px)

See `/Users/elliottthornburgsmac/Downloads/image_requirements.md` for full design guidelines.

## How to Build

1. **Add your images** to this folder following the naming convention above
2. **Update `pass.json`**:
   - Replace `YOUR_TEAM_ID` with your Apple Developer Team ID
   - Update `passTypeIdentifier` if needed (format: `pass.com.yourdomain.passname`)
3. **Sign and build** using the build script (requires Apple Developer certificate)

## Testing

For testing without full signing, you can:
1. Use PassSource or similar online tools
2. Use Xcode with Pass Type ID configured
3. Use a third-party service like PassKit Pro

## Sharing

Once the pass is installed:
- Users can tap the pass to view QR code
- Scan QR code → Opens App Store
- Tap (i) icon in Wallet → "Share Pass" → AirDrop/Messages/Email

## Notes

- The pass includes a QR code that links directly to the App Store
- AirDrop sharing requires users to manually use "Share Pass" from Wallet
- For automatic tap-to-share, you'll need physical NFC tags (separate solution)
