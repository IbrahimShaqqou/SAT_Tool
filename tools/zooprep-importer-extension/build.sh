#!/usr/bin/env bash
# Package the extension into a distributable zip.
#
#   ./build.sh           Dev build (manifest.json — includes localhost hosts).
#                        Copied to frontend/public/extension for the in-app
#                        "Get the extension" download.
#   ./build.sh --prod    Web Store build (manifest.prod.json — pinned prod hosts,
#                        no localhost). Produces zooprep-importer-prod.zip; this
#                        is the artifact you upload to the Chrome Web Store.
set -euo pipefail
cd "$(dirname "$0")"

MODE="dev"
[ "${1:-}" = "--prod" ] && MODE="prod"

SHARED=(background.js content-bridge.js page-hook.js zooprep-connect.js \
        popup.html popup.css popup.js options.html options.js \
        icons README.md PRIVACY.md)

if [ "$MODE" = "prod" ]; then
  OUT="zooprep-importer-prod.zip"
  MANIFEST_SRC="manifest.prod.json"
else
  OUT="zooprep-importer.zip"
  MANIFEST_SRC="manifest.json"
fi

# Validate the manifest parses before packaging.
python3 -c "import json; json.load(open('$MANIFEST_SRC'))"

rm -f "$OUT"

# The zip must contain a file literally named manifest.json. For the prod build
# we stage the prod manifest under that name in a temp dir.
if [ "$MODE" = "prod" ]; then
  TMP="$(mktemp -d)"
  cp "$MANIFEST_SRC" "$TMP/manifest.json"
  cp -R "${SHARED[@]}" "$TMP/"
  ( cd "$TMP" && zip -r -q "manifest-bundle.zip" . -x '*.DS_Store' )
  mv "$TMP/manifest-bundle.zip" "$OUT"
  rm -rf "$TMP"
else
  zip -r -q "$OUT" manifest.json "${SHARED[@]}" -x '*.DS_Store'
fi

echo "Built $OUT ($(du -h "$OUT" | cut -f1)) [${MODE}]"

# Dev build is also published to the frontend for in-app download.
if [ "$MODE" = "dev" ]; then
  PUB="../../frontend/public/extension"
  if [ -d "../../frontend/public" ]; then
    mkdir -p "$PUB"
    cp "$OUT" "$PUB/zooprep-importer.zip"
    echo "Copied to $PUB/zooprep-importer.zip"
  fi
fi
