#!/usr/bin/env python3
"""
Rebuild Wallet pass with correct zip structure (files at root, not in subdirectory)
"""

import os
import shutil
import subprocess
import tempfile
import json
import hashlib
import zipfile

PASS_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.dirname(PASS_DIR)
CERT_PATH = os.path.expanduser("~/Documents/cardfixed.p12")
WWDR_PATH = os.path.expanduser("~/.questcard-certs/wwdr.pem")

def get_sha1(filepath):
    """Calculate SHA1 hash of file"""
    with open(filepath, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()

def main():
    print("🔨 Rebuilding Wallet Pass with correct structure...")
    print("")
    
    # Create temp directory
    temp_dir = tempfile.mkdtemp()
    pass_contents = os.path.join(temp_dir, "pass_contents")
    os.makedirs(pass_contents, exist_ok=True)
    
    try:
        # Copy all pass files (except scripts and docs)
        print("📦 Copying pass files...")
        exclude = {'.sh', '.md', '.py', 'build.sh', 'README.md', 'SETUP.md'}
        for item in os.listdir(PASS_DIR):
            if item.endswith(tuple(exclude)) or item.startswith('.'):
                continue
            src = os.path.join(PASS_DIR, item)
            if os.path.isfile(src):
                shutil.copy2(src, pass_contents)
        
        # Create manifest.json
        print("📝 Creating manifest.json...")
        manifest = {}
        for filename in os.listdir(pass_contents):
            if filename != 'manifest.json':  # Don't hash manifest itself
                filepath = os.path.join(pass_contents, filename)
                manifest[filename] = get_sha1(filepath)
        
        manifest_path = os.path.join(pass_contents, 'manifest.json')
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        
        print(f"   ✅ Manifest created with {len(manifest)} files")
        
        # Sign the manifest
        print("🔐 Signing manifest...")
        key_path = os.path.join(temp_dir, "key.pem")
        cert_path = os.path.join(temp_dir, "cert.pem")
        signature_path = os.path.join(pass_contents, "signature")
        
        # Extract key and cert
        print("   Extracting certificate...")
        result = subprocess.run(
            ['openssl', 'pkcs12', '-legacy', '-in', CERT_PATH, '-nocerts', '-nodes', 
             '-out', key_path, '-passin', 'pass:'],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f"❌ Failed to extract key: {result.stderr}")
            return 1
        
        result = subprocess.run(
            ['openssl', 'pkcs12', '-legacy', '-in', CERT_PATH, '-clcerts', '-nokeys', 
             '-out', cert_path, '-passin', 'pass:'],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f"❌ Failed to extract cert: {result.stderr}")
            return 1
        
        # Sign manifest
        print("   Signing manifest.json...")
        with open(os.path.join(pass_contents, 'manifest.json'), 'rb') as manifest_file:
            result = subprocess.run(
                ['openssl', 'smime', '-binary', '-sign', '-certfile', WWDR_PATH,
                 '-signer', cert_path, '-inkey', key_path,
                 '-in', '/dev/stdin', '-out', signature_path, '-outform', 'DER'],
                stdin=manifest_file,
                capture_output=True, text=True
            )
        
        if result.returncode != 0 or not os.path.exists(signature_path):
            print(f"❌ Failed to create signature: {result.stderr}")
            return 1
        
        print("   ✅ Manifest signed successfully")
        
        # Create .pkpass file (zip with files at ROOT)
        print("📦 Creating .pkpass package...")
        pkpass_path = os.path.join(OUTPUT_DIR, "QuestCard.pkpass")
        
        # Create zip with files at root (cd into pass_contents and zip from there)
        with zipfile.ZipFile(pkpass_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for filename in os.listdir(pass_contents):
                filepath = os.path.join(pass_contents, filename)
                # Add file to zip ROOT (not in subdirectory)
                zf.write(filepath, filename)
        
        print(f"✅ Build complete!")
        print(f"📁 Output: {pkpass_path}")
        print(f"📊 File size: {os.path.getsize(pkpass_path)} bytes")
        
        # Verify structure
        print("\n🔍 Verifying structure...")
        with zipfile.ZipFile(pkpass_path, 'r') as zf:
            files = zf.namelist()
            required = ['manifest.json', 'pass.json', 'signature']
            missing = [f for f in required if f not in files]
            
            if missing:
                print(f"❌ Missing files at root: {missing}")
                return 1
            
            print("✅ All required files at zip root")
            print(f"   Files: {', '.join(files[:5])}{'...' if len(files) > 5 else ''}")
        
        return 0
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == '__main__':
    exit(main())
