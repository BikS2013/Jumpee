#!/bin/bash
# Builds, signs, (optionally) notarizes, and zips Jumpee for a GitHub release.
#
# Required environment:
#   CODESIGN_IDENTITY  "Developer ID Application: ..." identity used to sign the app.
#                      List available identities: security find-identity -v -p codesigning
#
# Optional environment:
#   NOTARY_PROFILE     Name of a notarytool keychain profile. When set, the zip is
#                      submitted to Apple's notary service, and on success the
#                      ticket is stapled to the app and the zip is rebuilt.
#                      Create a profile once with:
#                        xcrun notarytool store-credentials <profile-name> \
#                          --apple-id <apple-id> --team-id <team-id> --password <app-specific-password>
#
# Usage: bash package.sh
# The version comes from build.sh (VERSION=...), which also stamps Info.plist.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Jumpee"
VERSION="$(sed -n 's/^VERSION="\(.*\)"$/\1/p' "$SCRIPT_DIR/build.sh")"
BUILD_DIR="$SCRIPT_DIR/build"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
DIST_DIR="$SCRIPT_DIR/dist"
ZIP_FILE="$DIST_DIR/${APP_NAME}-${VERSION}.zip"

if [ -z "$VERSION" ]; then
    echo "ERROR: could not read VERSION from build.sh" >&2
    exit 1
fi
if [ -z "$CODESIGN_IDENTITY" ]; then
    echo "ERROR: CODESIGN_IDENTITY is not set. A release package must be signed with a" >&2
    echo "       Developer ID Application identity. See the header of this script." >&2
    exit 1
fi

echo "=== Packaging $APP_NAME v$VERSION ==="

# Step 1: Build + sign (build.sh honours CODESIGN_IDENTITY)
bash "$SCRIPT_DIR/build.sh"

# Step 2: Verify the signature is a Developer ID signature with the hardened runtime
echo "Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"
codesign -dvv "$APP_BUNDLE" 2>&1 | grep -q "Authority=Developer ID Application" \
    || { echo "ERROR: bundle is not signed with a Developer ID Application identity" >&2; exit 1; }
codesign -d --verbose=2 "$APP_BUNDLE" 2>&1 | grep -q "flags=.*runtime" \
    || { echo "ERROR: hardened runtime is not enabled" >&2; exit 1; }

make_zip() {
    rm -f "$ZIP_FILE"
    mkdir -p "$DIST_DIR"
    # ditto preserves bundle metadata and is the archive format Apple recommends for notarization
    ditto -c -k --norsrc --keepParent "$APP_BUNDLE" "$ZIP_FILE"
}

# Step 3: Zip
echo "Creating $ZIP_FILE..."
make_zip

# Step 4: Notarize + staple (optional)
if [ -n "$NOTARY_PROFILE" ]; then
    echo "Submitting to Apple notary service (profile: $NOTARY_PROFILE)..."
    xcrun notarytool submit "$ZIP_FILE" --keychain-profile "$NOTARY_PROFILE" --wait
    echo "Stapling ticket..."
    xcrun stapler staple "$APP_BUNDLE"
    xcrun stapler validate "$APP_BUNDLE"
    echo "Rebuilding zip with stapled app..."
    make_zip
    NOTARIZED="yes"
else
    NOTARIZED="no (NOTARY_PROFILE not set)"
fi

# Step 5: Gatekeeper assessment (informational: un-notarized apps are rejected on macOS 10.15+)
echo "Gatekeeper assessment:"
spctl --assess --type execute --verbose=2 "$APP_BUNDLE" 2>&1 || true

# Step 6: SHA256
SHA256=$(shasum -a 256 "$ZIP_FILE" | awk '{print $1}')

echo ""
echo "=== Package complete ==="
echo "File:      $ZIP_FILE"
echo "Version:   $VERSION"
echo "Signed:    $CODESIGN_IDENTITY"
echo "Notarized: $NOTARIZED"
echo "SHA256:    $SHA256"
echo "Size:      $(du -h "$ZIP_FILE" | awk '{print $1}')"
echo ""
echo "To publish:"
echo "  gh release create v$VERSION \"$ZIP_FILE\" --title \"Jumpee v$VERSION\" --notes-file <notes.md>"
echo "  Then update the Homebrew cask (BikS2013/homebrew-jumpee) with version $VERSION and the SHA256 above."
