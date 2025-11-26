# Quick Fix for Certificate Export Issue

The most common problem is how the certificate is exported from Keychain Access.

## ✅ CORRECT Export Steps:

1. **Open Keychain Access** (Applications → Utilities)
2. **Click "My Certificates"** in the left sidebar (NOT "Certificates" - this is important!)
3. **Find**: `Pass Type ID: pass.com.thequestsapp.questcard`
4. **Right-click** → **"Export..."**
5. **Save as**: `questcard-cert-fixed.p12`
6. **IMPORTANT SETTINGS:**
   - File Format: **"Personal Information Exchange (.p12)"**
   - ⚠️ **UNCHECK** "Include extended attributes" ← This is critical!
   - Use a **simple password** (letters and numbers only, no special characters)
7. **Click "Allow"** when asked for Keychain access
8. **Enter your Mac password** when prompted

## Then rebuild:

```bash
cd /Users/elliottthornburgsmac/Documents/QuestsWebpage/QuestCard.pass
export CERT_PATH="$HOME/Documents/questcard-cert-fixed.p12"
export WWDR_PATH="$HOME/.questcard-certs/wwdr.pem"
# Enter password when prompted
./build-with-password.sh
```

## Why it fails:

- ✅ **"My Certificates"** has the private key (needed)
- ❌ **"Certificates"** only has the public certificate (won't work)
- ✅ **Unchecked "Include extended attributes"** = works
- ❌ **Checked "Include extended attributes"** = causes issues
- ✅ **Simple password** = works reliably
- ❌ **Special characters in password** = can cause problems

