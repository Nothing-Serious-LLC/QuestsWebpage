#!/bin/bash
cd "$(dirname "$0")"
export CERT_PATH="$HOME/Documents/cardfixed.p12"
export CERT_PASSWORD=""
export WWDR_PATH="$HOME/.questcard-certs/wwdr.pem"
./build-proper.sh
