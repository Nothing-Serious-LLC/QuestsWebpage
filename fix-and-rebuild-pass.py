#!/usr/bin/env python3
"""Fix and rebuild Wallet pass with correct structure"""

import os
import json
import hashlib
import zipfile
import subprocess
import tempfile
import shutil

# Paths
PASS_DIR = "QuestCard.pass"
OUTPUT_FILE = "QuestCard.pkpass"
CERT_PATH = os.path.expanduser("~/Documents/cardfixed.p12")
WWDR_PATH = os.path.expanduser("~/.questcard-certs/wwdr.pem")

def sha1_hash(filepath):
    with open(filepath, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()

print("🔨 Rebuilding Wallet Pass...")
print("")

# Step 1: Copy files to temp directory
temp_dir = tempfile.mkdtemp()
pass_dir = os.path.join(temp_dir, "pass")

try:
    # Copy pass files
    print("📦 Preparing pass files...")
    os.makedirs(pass_dir)
    
    # Copy JSON and PNG files from QuestCard.pass directory
    for item in os.listdir(PASS_DIR):
        if item.endswith(('.json', '.png')):
            src = os.path.join(PASS_DIR, item)
            if os.path.isfile(src):
                shutil.copy2(src, pass_dir)
                print(f"   ✓ {item}")
    
    # Step 2: Create manifest.json
    print("\n📝 Creating manifest.json...")
    manifest = {}
    
    for filename in os.listdir(pass_dir):
        if filename != 'manifest.json':
            filepath = os.path.join(pass_dir, filename)
            manifest[filename] = sha1_hash(filepath)
    
    manifest_path = os.path.join(pass_dir, 'manifest.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"   ✅ Manifest with {len(manifest)} files")
    
    # Step 3: Sign the manifest
    print("\n🔐 Signing manifest...")
    
    key_path = os.path.join(temp_dir, "key.pem")
    cert_path = os.path.join(temp_dir, "cert.pem")
    sig_path = os.path.join(pass_dir, "signature")
    
    # Extract key
    print("   Extracting private key...")
    result = subprocess.run([
        'openssl', 'pkcs12', '-legacy', '-in', CERT_PATH,
        '-nocerts', '-nodes', '-out', key_path, '-passin', 'pass:'
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"   ❌ Error: {result.stderr}")
        exit(1)
    
    # Extract cert
    print("   Extracting certificate...")
    result = subprocess.run([
        'openssl', 'pkcs12', '-legacy', '-in', CERT_PATH,
        '-clcerts', '-nokeys', '-out', cert_path, '-passin', 'pass:'
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"   ❌ Error: {result.stderr}")
        exit(1)
    
    # Sign manifest
    print("   Signing manifest.json...")
    with open(manifest_path, 'rb') as mf:
        result = subprocess.run([
            'openssl', 'smime', '-binary', '-sign',
            '-certfile', WWDR_PATH,
            '-signer', cert_path,
            '-inkey', key_path,
            '-in', '/dev/stdin',
            '-out', sig_path,
            '-outform', 'DER'
        ], stdin=mf, capture_output=True, text=True)
    
    if result.returncode != 0 or not os.path.exists(sig_path):
        print(f"   ❌ Signature failed: {result.stderr}")
        exit(1)
    
    print("   ✅ Manifest signed")
    
    # Step 4: Create .pkpass (zip with files at ROOT)
    print("\n📦 Creating .pkpass file...")
    print("   (Files at zip root, not in subdirectory)")
    
    pkpass_path = os.path.join(os.getcwd(), OUTPUT_FILE)
    
    with zipfile.ZipFile(pkpass_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for filename in os.listdir(pass_dir):
            filepath = os.path.join(pass_dir, filename)
            # Add to root of zip (not in subdirectory)
            zf.write(filepath, filename)
            print(f"   ✓ Added {filename}")
    
    print(f"\n✅ Pass rebuilt successfully!")
    print(f"📁 Location: {pkpass_path}")
    print(f"📊 Size: {os.path.getsize(pkpass_path)} bytes")
    
    # Verify structure
    print("\n🔍 Verifying structure...")
    with zipfile.ZipFile(pkpass_path, 'r') as zf:
        files = zf.namelist()
        required = ['manifest.json', 'pass.json', 'signature', 'icon.png', 'logo.png']
        
        # Check files are at root (no 'pass/' prefix)
        has_subdir = any('/' in f for f in files if f.count('/') > 0)
        if has_subdir:
            print("   ⚠️  Warning: Some files are in subdirectories")
        
        missing = [f for f in required if f not in files]
        if missing:
            print(f"   ❌ Missing: {missing}")
        else:
            print("   ✅ All required files at root level")
            print(f"   Files: {', '.join(sorted(files)[:8])}")
    
    print("\n🎉 Done! Test at: https://pkpassvalidator.azurewebsites.net/")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
finally:
    shutil.rmtree(temp_dir, ignore_errors=True)
