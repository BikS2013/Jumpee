#!/usr/bin/env bash
# Converts every captured PNG in deck/screenshots/ to a JPEG and writes the matching
# deck/assets/<name>.datauri.txt consumed by the nbg-design embed-assets.mjs script (token {{SHOT_<NAME>}}).
#
# The captures come from the running app with `screencapture` at the display's native 2x, so they are
# kept at that size: the deck's artboard is 1920x1080 and quality 85 keeps the UI text crisp.
set -eu
cd "$(dirname "$0")"
mkdir -p ../assets
for png in *.png; do
  name="${png%.png}"
  jpg="$name.jpeg"
  sips -s format jpeg -s formatOptions 85 "$png" --out "$jpg" >/dev/null
  printf 'data:image/jpeg;base64,%s' "$(base64 -i "$jpg" | tr -d '\n')" > "../assets/shot-$name.datauri.txt"
  echo "shot-$name -> $(wc -c < "../assets/shot-$name.datauri.txt") chars  ($(sips -g pixelWidth -g pixelHeight "$png" | tail -2 | tr -d '\n' | tr -s ' '))"
done
