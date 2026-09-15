#!/bin/bash
# Builds Jumpee.app into ./build.noindex (the .noindex suffix keeps Spotlight from
# indexing the build output, so only /Applications/Jumpee.app shows up in Spotlight).
#
# Signing:
#   - Default (development): ad-hoc signature, so Accessibility permissions
#     persist across local rebuilds.
#   - Release: set CODESIGN_IDENTITY to a "Developer ID Application: ..." identity
#     (see `security find-identity -v -p codesigning`). The bundle is then signed
#     with the hardened runtime and a secure timestamp, as required for notarization.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Jumpee"
VERSION="1.6.0"
BUILD_DIR="$SCRIPT_DIR/build.noindex"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_BUNDLE/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

echo "Building $APP_NAME $VERSION..."

# Clean
rm -rf "$BUILD_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

# Compile
swiftc \
    -O \
    -framework Cocoa \
    -F /System/Library/PrivateFrameworks \
    -o "$MACOS_DIR/$APP_NAME" \
    "$SCRIPT_DIR/Sources/main.swift"

# Create Info.plist
cat > "$CONTENTS_DIR/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>Jumpee</string>
    <key>CFBundleDisplayName</key>
    <string>Jumpee</string>
    <key>CFBundleIdentifier</key>
    <string>com.local.jumpee</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleExecutable</key>
    <string>Jumpee</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

# Code-sign
if [ -n "$CODESIGN_IDENTITY" ]; then
    echo "Signing with: $CODESIGN_IDENTITY (hardened runtime, timestamped)"
    codesign --force --options runtime --timestamp --sign "$CODESIGN_IDENTITY" "$APP_BUNDLE"
else
    echo "Signing ad-hoc (development build; set CODESIGN_IDENTITY for a release build)"
    codesign --force --sign - "$APP_BUNDLE"
fi
codesign --verify --strict --verbose=1 "$APP_BUNDLE"

echo "Build successful: $APP_BUNDLE"
echo ""
echo "To run:  open $APP_BUNDLE"
echo "To install: cp -r $APP_BUNDLE /Applications/"
