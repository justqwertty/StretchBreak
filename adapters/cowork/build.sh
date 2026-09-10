#!/usr/bin/env bash
# Assembles the Cowork plugin: vendors core/ and packs/ into plugin/vendor/ and zips a .plugin file.
# Usage: adapters/cowork/build.sh [out-dir]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="${1:-$HERE/dist}"
PLUGIN="$HERE/plugin"

rm -rf "$PLUGIN/vendor"
mkdir -p "$PLUGIN/vendor/core" "$PLUGIN/vendor/packs"
cp "$ROOT/core/scheduler.js" "$ROOT/core/cli.js" "$PLUGIN/vendor/core/"
cp -R "$ROOT/packs/default" "$PLUGIN/vendor/packs/default"
node "$ROOT/scripts/validate.js" "$PLUGIN/vendor/packs/default"

NAME="$(node -e "process.stdout.write(require('$PLUGIN/.claude-plugin/plugin.json').name)")"
mkdir -p "$OUT"
rm -f "$OUT/$NAME.plugin"
( cd "$PLUGIN" && zip -qr "$OUT/$NAME.plugin" . -x "*.DS_Store" )
echo "built $OUT/$NAME.plugin"
