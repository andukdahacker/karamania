#!/usr/bin/env bash
# Run Flutter integration tests with a real server + bot participants.
#
# Usage:
#   ./integration_test/run_integration_tests.sh
#
# What it does:
#   1. Starts the server on a random port
#   2. Seeds test data
#   3. Creates an active party with 3 bot participants (meets 3-player minimum)
#   4. Passes party code + server URL to Flutter via --dart-define
#   5. Runs flutter test integration_test/
#   6. Tears everything down on exit

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLUTTER_APP_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$(dirname "$FLUTTER_APP_DIR")/server"

# --- Cleanup trap ---
SERVER_PID=""
BOT_PID=""

cleanup() {
  echo ""
  echo "=== Tearing down ==="
  [ -n "$BOT_PID" ] && kill "$BOT_PID" 2>/dev/null && echo "Stopped bots (PID $BOT_PID)"
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null && echo "Stopped server (PID $SERVER_PID)"
  wait 2>/dev/null
  echo "Done."
}
trap cleanup EXIT

# --- 1. Start the server ---
echo "=== Starting server ==="
cd "$SERVER_DIR"
PORT=3333
PORT=$PORT npx tsx src/index.ts &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to be ready
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then
    echo "Server ready on port $PORT"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Server failed to start within 30s"
    exit 1
  fi
  sleep 1
done

# --- 2. Create a party ---
echo "=== Creating party ==="
PARTY_RESPONSE=$(curl -sf "http://localhost:$PORT/api/sessions" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"displayName":"IntegrationHost","vibe":"general"}')

PARTY_CODE=$(echo "$PARTY_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['partyCode'])")
HOST_TOKEN=$(echo "$PARTY_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
echo "Party code: $PARTY_CODE"

# --- 3. Spawn 2 bots (host already counts as 1, need 3 total for START) ---
echo "=== Spawning bots ==="
npx tsx bots/manager.ts --bots 2 --party "$PARTY_CODE" --behavior spectator --server "http://localhost:$PORT" &
BOT_PID=$!
sleep 3
echo "Bots running (PID: $BOT_PID)"

# --- 4. Run Flutter integration tests ---
echo "=== Running Flutter integration tests ==="
cd "$FLUTTER_APP_DIR"

flutter test integration_test/ \
  --dart-define="SERVER_URL=http://localhost:$PORT" \
  --dart-define="PARTY_CODE=$PARTY_CODE" \
  --dart-define="HOST_TOKEN=$HOST_TOKEN"

echo ""
echo "=== Integration tests complete ==="
