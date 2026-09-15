#!/usr/bin/env bash
# Refreshes deck/tools/nbg-design/ (the vendored copy of the nbg-design skill's scripts/ folder that
# the GitHub Actions build uses) from the locally installed nbg-design plugin.
# Usage: ./sync-nbg-design.sh [<path to the plugin's skills/nbg-design folder>]
set -euo pipefail
cd "$(dirname "$0")"
SK="${1:-${NBG_DESIGN_SKILL:-}}"
if [ -z "$SK" ]; then
  SK="$(ls -d "$HOME"/.claude/plugins/cache/nbg-design/nbg-design/*/skills/nbg-design 2>/dev/null | sort -V | tail -1)"
fi
[ -n "$SK" ] && [ -d "$SK/scripts" ] || { echo "nbg-design skill not found (pass its skills/nbg-design path or set NBG_DESIGN_SKILL)"; exit 1; }
PLUGIN_JSON="$(cd "$SK/../.." && pwd)/.claude-plugin/plugin.json"
[ -f "$PLUGIN_JSON" ] || { echo "plugin.json not found at $PLUGIN_JSON"; exit 1; }
rm -rf nbg-design/scripts
mkdir -p nbg-design/scripts
cp -R "$SK/scripts/." nbg-design/scripts/
cp "$PLUGIN_JSON" nbg-design/plugin.json
echo "vendored nbg-design scripts from $SK (plugin $(node -p "require('./nbg-design/plugin.json').version"))"
