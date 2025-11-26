# Pass Validation Steps

## Online Validator

Test your pass file at: https://pkpassvalidator.azurewebsites.net/

Upload your QuestCard.pkpass file and it will tell you exactly what's wrong.

## Common Issues Based on Research

### 1. Pass Structure
✅ We have:
- formatVersion
- passTypeIdentifier  
- serialNumber
- teamIdentifier
- organizationName
- description
- generic pass type with primaryFields
- barcode

### 2. Certificate Issues
- ✅ Using G4 WWDR certificate (correct)
- ✅ Certificate has valid dates (expires 2030)
- ⚠️ Certificate shows "not trusted" in Keychain (normal for dev certs)

### 3. Signature Issues
The signature must:
- ✅ Be in PKCS7 DER format
- ✅ Include WWDR certificate in chain
- ✅ Sign the manifest.json file
- ✅ Include our Pass Type ID certificate

## Testing Steps

1. **Test via Email**: Email the .pkpass file to yourself
   - If email works → Website serving issue
   - If email fails → Pass signing/structure issue

2. **Use Online Validator**: https://pkpassvalidator.azurewebsites.net/
   - Upload QuestCard.pkpass
   - It will show exact errors

3. **Check Console Logs** (if you have Xcode):
   - Connect iPhone to Mac
   - Open Console app
   - Filter for "pass" or "wallet"
   - Try to install pass
   - Look for error messages

## Most Likely Issues

Based on research, the most common causes are:

1. **Invalid signature** - Certificate chain not properly included
2. **Missing required fields** - Pass structure incomplete
3. **Certificate expiration** - But ours expires 2026, so this shouldn't be it
4. **WWDR certificate** - But we're using G4 which is correct

## Next Steps

1. Upload to pkpassvalidator.azurewebsites.net
2. Check the exact error message
3. Fix based on validator feedback
