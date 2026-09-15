#!/usr/bin/env bash
# Builds deck/jumpee-deck.html from deck/src/*.html, embeds the BikS2013 logo lockups,
# inlines the right-click deck menu (BikS2013 theme), verifies the deck, writes its rebuild
# script and exports the PDF.
# Usage: ./build.sh [--no-pdf]
#
# deck/assets/ holds one assets directory for every token: the generated photographs (from images/,
# via make-datauris.sh) and the four BikS2013 lockup data URIs copied from the skill's
# BikS2013-Design/assets/. Hence --assets assets below.
set -euo pipefail
cd "$(dirname "$0")"
SK="${NBG_DESIGN_SKILL:-$HOME/.claude/plugins/cache/nbg-design/nbg-design/1.20.0/skills/nbg-design}"
[ -d "$SK/scripts" ] || { echo "nbg-design skill not found at $SK (set NBG_DESIGN_SKILL)"; exit 1; }

cat src/shell-head.html src/slides.html src/shell-tail.html > jumpee-deck.src.html
node "$SK/scripts/embed-assets.mjs" jumpee-deck.src.html -o jumpee-deck.html --theme biks2013 --assets assets
node "$SK/scripts/add-deck-menu.mjs" jumpee-deck.html --theme biks2013
node "$SK/scripts/verify-deck.mjs" jumpee-deck.html --strict
if [ "${1:-}" = "--no-pdf" ]; then
  node "$SK/scripts/write-rebuild-script.mjs" jumpee-deck.html --no-pdf
else
  node "$SK/scripts/write-rebuild-script.mjs" jumpee-deck.html
  node "$SK/scripts/export-pdf.mjs" jumpee-deck.html -o jumpee-deck.pdf
fi
