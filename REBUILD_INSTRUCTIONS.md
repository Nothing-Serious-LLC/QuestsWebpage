# Rebuild Instructions - Run These Commands

The pass file needs to be rebuilt with files at the zip root (not in a subdirectory).

## Quick Rebuild:

```bash
cd /Users/elliottthornburgsmac/Documents/QuestsWebpage/QuestCard.pass

export CERT_PATH="$HOME/Documents/cardfixed.p12"
export CERT_PASSWORD=""
export WWDR_PATH="$HOME/.questcard-certs/wwdr.pem"

./build-proper.sh
```

## Or Use Python Script:

```bash
cd /Users/elliottthornburgsmac/Documents/QuestsWebpage
python3 fix-and-rebuild-pass.py
```

## After Rebuilding:

1. Verify structure:
```bash
cd /Users/elliottthornburgsmac/Documents/QuestsWebpage
unzip -l QuestCard.pkpass
```
You should see files like `manifest.json`, `pass.json`, `signature` (NOT `pass/manifest.json`)

2. Commit and push:
```bash
git add QuestCard.pkpass
git commit -m "Rebuild Wallet pass with correct zip structure"
git push origin main
```

3. Test at: https://pkpassvalidator.azurewebsites.net/

The validator should now pass!
