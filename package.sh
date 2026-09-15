#!/bin/bash
# Builds, signs, (optionally) notarizes, and packages Jumpee for a GitHub release
# as both a zip archive and a drag-to-Applications disk image (.dmg).
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
# Usage: bash package.sh [--dmg-only]
#   --dmg-only   Skip the build, app signing, zip and app notarization; reuse the
#                existing (already signed and stapled) build.noindex/Jumpee.app and only
#                produce the disk image.
# The version comes from build.sh (VERSION=...), which also stamps Info.plist.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Jumpee"
VERSION="$(sed -n 's/^VERSION="\(.*\)"$/\1/p' "$SCRIPT_DIR/build.sh")"
BUILD_DIR="$SCRIPT_DIR/build.noindex"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
DIST_DIR="$SCRIPT_DIR/dist"
ZIP_FILE="$DIST_DIR/${APP_NAME}-${VERSION}.zip"
DMG_FILE="$DIST_DIR/${APP_NAME}-${VERSION}.dmg"
DMG_ONLY=0

for arg in "$@"; do
    case "$arg" in
        --dmg-only) DMG_ONLY=1 ;;
        *) echo "ERROR: unknown argument: $arg" >&2; exit 1 ;;
    esac
done

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

if [ "$DMG_ONLY" -eq 1 ]; then
    echo "--dmg-only: reusing existing $APP_BUNDLE"
    [ -d "$APP_BUNDLE" ] || { echo "ERROR: $APP_BUNDLE not found; run without --dmg-only first" >&2; exit 1; }
    codesign --verify --deep --strict "$APP_BUNDLE"
    if [ -n "$NOTARY_PROFILE" ]; then
        xcrun stapler validate "$APP_BUNDLE" || { echo "ERROR: app is not stapled; run a full package first" >&2; exit 1; }
        NOTARIZED="yes (existing stapled app)"
    else
        NOTARIZED="no (NOTARY_PROFILE not set)"
    fi
else
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
fi

# Step 6: Disk image (drag-to-Applications)
echo "Creating $DMG_FILE..."
DMG_STAGE="$BUILD_DIR/dmg-root"
rm -rf "$DMG_STAGE" "$DMG_FILE"
mkdir -p "$DMG_STAGE" "$DIST_DIR"
ditto "$APP_BUNDLE" "$DMG_STAGE/$APP_NAME.app"
ln -s /Applications "$DMG_STAGE/Applications"
hdiutil create -volname "$APP_NAME" -srcfolder "$DMG_STAGE" -ov -format UDZO -quiet "$DMG_FILE"
rm -rf "$DMG_STAGE"
codesign --force --timestamp --sign "$CODESIGN_IDENTITY" "$DMG_FILE"
codesign --verify --verbose=1 "$DMG_FILE"
if [ -n "$NOTARY_PROFILE" ]; then
    echo "Submitting disk image to Apple notary service..."
    xcrun notarytool submit "$DMG_FILE" --keychain-profile "$NOTARY_PROFILE" --wait
    xcrun stapler staple "$DMG_FILE"
    xcrun stapler validate "$DMG_FILE"
fi
echo "Gatekeeper assessment (disk image):"
spctl --assess --type open --context context:primary-signature --verbose=2 "$DMG_FILE" 2>&1 || true

# Step 7: SHA256
[ -f "$ZIP_FILE" ] || { echo "ERROR: $ZIP_FILE missing; run a full package first" >&2; exit 1; }
SHA256=$(shasum -a 256 "$ZIP_FILE" | awk '{print $1}')
DMG_SHA256=$(shasum -a 256 "$DMG_FILE" | awk '{print $1}')

echo ""
echo "=== Package complete ==="
echo "Version:    $VERSION"
echo "Signed:     $CODESIGN_IDENTITY"
echo "Notarized:  $NOTARIZED"
echo "Zip:        $ZIP_FILE ($(du -h "$ZIP_FILE" | awk '{print $1}'))"
echo "Zip SHA256: $SHA256"
echo "DMG:        $DMG_FILE ($(du -h "$DMG_FILE" | awk '{print $1}'))"
echo "DMG SHA256: $DMG_SHA256"
echo ""
echo "To publish:"
echo "  gh release create v$VERSION \"$ZIP_FILE\" \"$DMG_FILE\" --title \"Jumpee v$VERSION\" --notes-file <notes.md>"
echo "  Then update the Homebrew cask (BikS2013/homebrew-jumpee) with version $VERSION and the SHA256 above."
