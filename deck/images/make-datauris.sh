#!/usr/bin/env bash
# Converts every generated PNG in deck/images/ to a 1600px-wide JPEG (quality 78) and writes the
# matching deck/assets/<name>.datauri.txt consumed by the nbg-design embed-assets.mjs script (token {{NAME}}).
#
# deck/assets/ also holds the four BikS2013 lockup data URIs copied from the skill's
# BikS2013-Design/assets/, because build.sh passes --assets assets (one assets directory for every token).
set -eu
cd "$(dirname "$0")"
mkdir -p ../assets
for png in *.png; do
  name="${png%.png}"
  jpg="$name.jpeg"
  sips -s format jpeg -s formatOptions 78 --resampleWidth 1600 "$png" --out "$jpg" >/dev/null
  printf 'data:image/jpeg;base64,%s' "$(base64 -i "$jpg" | tr -d '\n')" > "../assets/$name.datauri.txt"
  echo "$name -> $(wc -c < "../assets/$name.datauri.txt") chars"
done
