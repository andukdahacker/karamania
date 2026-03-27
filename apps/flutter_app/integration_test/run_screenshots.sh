#!/usr/bin/env bash
# Capture screenshots from all app screens and save to docs/screenshots/.
#
# Usage:
#   ./integration_test/run_screenshots.sh           # auto-detect booted simulator
#   ./integration_test/run_screenshots.sh <device>  # specify simulator UDID
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLUTTER_APP_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "$FLUTTER_APP_DIR/../.." && pwd)"
OUTPUT_DIR="$REPO_ROOT/docs/screenshots"

mkdir -p "$OUTPUT_DIR"

# Determine device — must be a booted iOS simulator
DEVICE="${1:-}"
if [ -z "$DEVICE" ]; then
  DEVICE=$(xcrun simctl list devices booted -j 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for runtime, devices in data.get('devices', {}).items():
    for d in devices:
        if d.get('state') == 'Booted':
            print(d['udid'])
            sys.exit(0)
sys.exit(1)
" 2>/dev/null) || { echo "ERROR: No booted simulator found. Boot one first: xcrun simctl boot <UDID>"; exit 1; }
  echo "Auto-detected simulator: $DEVICE"
fi

echo "=== Capturing screenshots on $DEVICE ==="
cd "$FLUTTER_APP_DIR"

# flutter drive runs the test on-device and the driver on the host.
# The driver's onScreenshot callback writes PNGs to docs/screenshots/.
flutter drive \
  --driver=test_driver/integration_test.dart \
  --target=integration_test/screenshot_test.dart \
  -d "$DEVICE" \
  --dart-define="SERVER_URL=http://localhost:9999" \
  2>&1 | tee /tmp/screenshot_test_output.log

COUNT=$(ls -1 "$OUTPUT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
echo "=== $COUNT screenshots saved to $OUTPUT_DIR ==="
ls -la "$OUTPUT_DIR"/*.png 2>/dev/null || echo "WARNING: No screenshots found"
