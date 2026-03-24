# k6 Performance / Load Tests for Karamania Server

## Prerequisites

Install k6:

```bash
brew install grafana/k6/k6
# or
brew install k6
```

The Karamania server must be running on `http://localhost:3000` (or set `SERVER_URL`).

You also need an **active party** with a known party code. Create one via the app or
the REST API before running tests.

## Running Tests

### Full party load test (12 participants, 5 minutes)

```bash
k6 run k6/party-load.js -e PARTY_CODE=ABC123
```

### Reaction throughput stress test (12 VUs, 2 minutes)

```bash
k6 run k6/reaction-throughput.js -e PARTY_CODE=ABC123
```

### Environment variables

| Variable     | Default                 | Description                          |
|-------------|-------------------------|--------------------------------------|
| `SERVER_URL` | `http://localhost:3000` | Base URL of the Karamania server     |
| `PARTY_CODE` | *(required)*            | Party code to join                   |

## What the tests measure

- **party-load.js** — Simulates a realistic full party: 12 concurrent guests connect
  via WebSocket, listen for DJ state changes and reaction broadcasts, and send
  periodic reactions. Measures connection time, HTTP auth latency, WebSocket message
  round-trip, and overall stability over 5 minutes.

- **reaction-throughput.js** — Stress tests the reaction pipeline: 12 VUs blast
  reactions every 100ms to find the throughput ceiling and verify rate limiting
  works. Measures reactions/sec, broadcast latency, and checks for errors.

## Notes

- k6 scripts are plain JavaScript (not TypeScript, not Node.js modules).
- Socket.io protocol is implemented manually since k6 does not ship a Socket.io
  client. The scripts handle the EIO4 polling handshake then upgrade to WebSocket.
- The reaction tests require the DJ to be in `song` state (reactions are gated by
  server-side state guards). Either start a song before running, or use
  `party-load.js` which tolerates silent broadcast periods.
