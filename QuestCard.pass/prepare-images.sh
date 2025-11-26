#!/bin/bash

# Script to prepare Wallet pass images from existing assets
# Requires ImageMagick (install: brew install imagemagick)

PASS_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_ROOT="$(cd "$PASS_DIR/.." && pwd)"

echo "🖼️  Preparing Wallet Pass Images"
echo ""

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found. Install with: brew install imagemagick"
    exit 1
fi

# Check if source images exist
if [ ! -f "$WEB_ROOT/icon.png" ]; then
    echo "❌ Error: icon.png not found in $WEB_ROOT"
    exit 1
fi

echo "📐 Resizing images for Wallet pass..."
echo ""

# Create icon sizes
echo "Creating icons..."
magick "$WEB_ROOT/icon.png" -resize 29x29 "$PASS_DIR/icon.png"
magick "$WEB_ROOT/icon.png" -resize 58x58 "$PASS_DIR/icon@2x.png"
magick "$WEB_ROOT/icon.png" -resize 87x87 "$PASS_DIR/icon@3x.png"

# Create logo sizes (using logo-glyph or icon)
SOURCE_LOGO="$WEB_ROOT/logo-glyph.png"
if [ ! -f "$SOURCE_LOGO" ]; then
    SOURCE_LOGO="$WEB_ROOT/icon.png"
fi

echo "Creating logos..."
# Logo should be 160x50, 320x100, 480x150
# We'll create a centered logo with padding
magick "$SOURCE_LOGO" -resize 120x120 -gravity center -background transparent -extent 160x50 "$PASS_DIR/logo.png"
magick "$SOURCE_LOGO" -resize 240x240 -gravity center -background transparent -extent 320x100 "$PASS_DIR/logo@2x.png"
magick "$SOURCE_LOGO" -resize 360x360 -gravity center -background transparent -extent 480x150 "$PASS_DIR/logo@3x.png"

echo ""
echo "✅ Images prepared!"
echo ""
echo "Created:"
echo "  - icon.png (29×29)"
echo "  - icon@2x.png (58×58)"
echo "  - icon@3x.png (87×87)"
echo "  - logo.png (160×50)"
echo "  - logo@2x.png (320×100)"
echo "  - logo@3x.png (480×150)"
echo ""
echo "📝 Next steps:"
echo "  1. Review the generated images"
echo "  2. Optionally create strip.png for hero image (see image_requirements.md)"
echo "  3. Sign the pass using build.sh or an online service"
echo ""
