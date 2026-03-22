#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Jumpee"
VERSION="${1:-1.0.0}"
BUILD_DIR="$SCRIPT_DIR/build"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
DIST_DIR="$SCRIPT_DIR/dist"
ZIP_FILE="$DIST_DIR/${APP_NAME}-${VERSION}.zip"

echo "=== Packaging $APP_NAME v$VERSION ==="

# Step 1: Build
echo "Building..."
bash "$SCRIPT_DIR/build.sh"

# Step 2: Create dist directory
mkdir -p "$DIST_DIR"

# Step 3: Create zip
echo "Creating $ZIP_FILE..."
cd "$BUILD_DIR"
zip -r "$ZIP_FILE" "$APP_NAME.app"

# Step 4: Calculate SHA256
SHA256=$(shasum -a 256 "$ZIP_FILE" | awk '{print $1}')

echo ""
echo "=== Package complete ==="
echo "File: $ZIP_FILE"
echo "SHA256: $SHA256"
echo "Size: $(du -h "$ZIP_FILE" | awk '{print $1}')"
echo ""
echo "To create a GitHub release:"
echo "  1. Push this project to GitHub"
echo "  2. Create a release tag: git tag v$VERSION && git push --tags"
echo "  3. Upload $ZIP_FILE to the release"
echo "  4. Update the Homebrew cask with the download URL and SHA256"
echo ""
echo "For local install without Homebrew:"
echo "  cp -r $APP_BUNDLE /Applications/"
