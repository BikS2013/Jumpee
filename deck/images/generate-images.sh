#!/usr/bin/env bash
# Generates the photorealistic image set for the Jumpee deck with image-tool (Azure OpenAI gpt-image-2).
# Re-run to regenerate; existing files are skipped, so delete a PNG to regenerate just that one.
#
# Subjects are literal to the product — workspaces and displays — because the deck is a product tour.
# The style brief is lifted verbatim from the theme's own candidate generator
# (nbg-design-skill-dev/docs/nbg-design-docs/biks2013-theme/candidates/gen.mjs), so these photographs
# sit in the same visual family as the BikS2013 candidate set awaiting review.
set -u
cd "$(dirname "$0")"

STYLE='Editorial personal-brand photography for the presentation design system of an independent software engineer ("BikS2013" — a bicycle is the brand mark). Photorealistic, shot on a full-frame camera with a 35mm or 50mm lens, natural light, shallow depth of field. Colour palette: warm paper off-white (#F6F3EC), ink black (#1B1D21) and copper (#C8623A) as the dominant accent, a touch of amber; muted and restrained, no neon, no blue sci-fi glow. Clean composition with generous negative space so a headline can be placed over the emptier side. Absolutely no text, no letters, no logos, no watermarks, no user-interface labels. Calm, crafted, personal, precise.'

gen() { # name size prompt
  local name="$1" size="$2" prompt="$3"
  if [ -f "$name.png" ]; then echo "skip $name"; return; fi
  echo "gen  $name"
  image-tool --json generate -p "$prompt $STYLE" -s "$size" --quality high --collision overwrite -o "$name.png" \
    >/dev/null 2>"$name.err" && rm -f "$name.err" || echo "FAILED $name (see $name.err)"
}

# ---- cover -----------------------------------------------------------------
# Portrait: the cover places it in a tall panel on the right, copy on the left.
gen cover-workspace 1024x1536 "A calm home-office desk at dusk: an open laptop beside a large external display on a walnut desk, both screens showing a soft dark unreadable interface, a warm copper desk lamp glowing on the right, a cream notebook and a stoneware cup, deep charcoal shadows, a warm pool of light falling from the left."

# ---- divider 01 · What it does ---------------------------------------------
gen divider-everyday-desk 1024x1536 "One person's ordered everyday working desk: an open laptop next to a single large external display, both screens dark with a calm blurred unreadable interface, a cream notebook, a copper pen, a small potted plant, warm afternoon window light raking across a charcoal wall."

# ---- divider 02 · More than one display ------------------------------------
gen divider-two-displays 1024x1536 "Two large external displays standing side by side on a walnut desk in a warm evening room, both screens dark with a soft warm glow, a slim keyboard and a copper desk lamp in front of them, charcoal wall behind, shallow depth of field, a balanced symmetrical composition."

# ---- divider 03 · Installing it --------------------------------------------
gen divider-unboxing 1024x1536 "A newly unboxed laptop resting on cream linen beside its opened cardboard box and folded paper wrapping, a small brass screwdriver and a neatly folded cloth, warm morning window light from the left, a charcoal background falling into deep shadow, still and deliberate."

# ---- divider 04 · Settings and configuration -------------------------------
# Square: this one fills a square panel in the corner of the bright divider.
gen divider-controls 1024x1024 "Extreme macro photograph of precision controls: brushed brass and copper-anodised dials and knurled knobs set into a dark charcoal aluminium panel, one knob catching a warm rim light, very shallow depth of field, muted and exact."

# ---- divider 05 · Where it fits --------------------------------------------
gen divider-home-office 1024x1536 "A person seen from behind, softly out of focus, working at a desk with a laptop and two monitors in a warm-lit room at dusk, a warm copper glow from the screens, a plant and a bookshelf out of focus behind them, charcoal shadows."

echo "done"
