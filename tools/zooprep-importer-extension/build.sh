#!/usr/bin/env bash
# Package the extension into a distributable zip (load-unpacked or Web Store).
# Also copies it to the frontend public dir so the in-app "Get the extension"
# button (/extension/zooprep-importer.zip) serves it.
set -euo pipefail
cd "$(dirname "$0")"

OUT="zooprep-importer.zip"
rm -f "$OUT"

# Validate manifest is parseable before packaging.
python3 -c "import json; json.load(open('manifest.json'))"

zip -r -q "$OUT" \
  manifest.json background.js content-bridge.js page-hook.js zooprep-connect.js \
  popup.html popup.css popup.js options.html options.js \
  icons README.md PRIVACY.md \
  -x '*.DS_Store'

echo "Built $OUT ($(du -h "$OUT" | cut -f1))"

# Publish to the frontend so it's downloadable in-app (best-effort).
PUB="../../frontend/public/extension"
if [ -d "../../frontend/public" ]; then
  mkdir -p "$PUB"
  cp "$OUT" "$PUB/zooprep-importer.zip"
  echo "Copied to $PUB/zooprep-importer.zip"
fi
