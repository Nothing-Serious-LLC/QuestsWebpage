#!/bin/bash

# Quick rebuild script with fixed zip structure

cd "$(dirname "$0")"

export CERT_PATH="$HOME/Documents/cardfixed.p12"
export CERT_PASSWORD=""
export WWDR_PATH="$HOME/.questcard-certs/wwdr.pem"

echo "🔨 Rebuilding pass with FIXED zip structure..."
echo ""

./build-proper.sh

echo ""
echo "✅ Rebuild complete! Files should now be at zip root (not in pass/ subdirectory)"
echo ""
echo "Test the new pass at: https://pkpassvalidator.azurewebsites.net/"
