# Fixed Build Instructions

## The Problem

The validator showed ALL checks failed because the zip file had files in a `pass/` subdirectory, but Wallet passes require files at the ROOT of the zip file.

**Wrong structure:**
```
QuestCard.pkpass (zip)
└── pass/
    ├── manifest.json
    ├── pass.json
    ├── signature
    └── ...
```

**Correct structure:**
```
QuestCard.pkpass (zip)
├── manifest.json
├── pass.json
├── signature
└── ...
```

## Fix Applied

Updated `build-proper.sh` to zip files from inside the pass directory, putting them at the root.

## Rebuild the Pass

Run this command:

```bash
cd /Users/elliottthornburgsmac/Documents/QuestsWebpage/QuestCard.pass
export CERT_PATH="$HOME/Documents/cardfixed.p12"
export CERT_PASSWORD=""
export WWDR_PATH="$HOME/.questcard-certs/wwdr.pem"
./build-proper.sh
```

Or use the helper script:

```bash
cd /Users/elliottthornburgsmac/Documents/QuestsWebpage/QuestCard.pass
./rebuild-fixed.sh
```

## Verify

After rebuilding, verify the structure:

```bash
cd /Users/elliottthornburgsmac/Documents/QuestsWebpage
unzip -l QuestCard.pkpass
```

You should see files like:
- `manifest.json` (not `pass/manifest.json`)
- `pass.json` (not `pass/pass.json`)
- `signature` (not `pass/signature`)

Then test again at: https://pkpassvalidator.azurewebsites.net/

The validator should now pass all structure checks!
