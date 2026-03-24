import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import http from 'k6/http';
import ws from 'k6/ws';
import { guestAuth } from './helpers/auth.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const SERVER_URL = __ENV.SERVER_URL || 'http://localhost:3000';
const PARTY_CODE = __ENV.PARTY_CODE;
const WS_BASE    = SERVER_URL.replace(/^http/, 'ws');

if (!PARTY_CODE) {
  throw new Error('PARTY_CODE env var is required. Run with: k6 run k6/party-load.js -e PARTY_CODE=ABC123');
}

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const reactionRoundTrip      = new Trend('reaction_round_trip_ms');
const djStateSyncLatency     = new Trend('dj_state_sync_ms');
const wsMessagesReceived     = new Counter('ws_messages_received');
const wsMessagesSent         = new Counter('ws_messages_sent');
const reactionBroadcasts     = new Counter('reaction_broadcasts');
const connectionsEstablished = new Counter('connections_established');

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export const options = {
  scenarios: {
    party: {
      executor: 'constant-vus',
      vus: 12,
      duration: '5m',
    },
  },
  thresholds: {
    'ws_connecting':          ['p(95)<1000'],  // WebSocket connect p95 < 1s
    'http_req_duration':      ['p(95)<500'],   // REST auth p95 < 500ms
    'reaction_round_trip_ms': ['p(95)<200'],   // reaction RTT p95 < 200ms
    'dj_state_sync_ms':       ['p(95)<200'],   // DJ sync p95 < 200ms
  },
};

// ---------------------------------------------------------------------------
// Socket.io EIO4 helpers
// ---------------------------------------------------------------------------

/**
 * Parse a Socket.io polling response to extract the sid.
 * Response format: "0{"sid":"xxx","upgrades":["websocket"],...}"
 * May be length-prefixed like "96:0{...}"
 */
function parseSid(body) {
  const match = body.match(/0(\{.*\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]).sid;
  } catch (_) {
    return null;
  }
}

/** Encode a Socket.io EVENT frame (type 42). */
function encodeEvent(eventName, data) {
  return '42' + JSON.stringify([eventName, data]);
}

/** Decode an incoming Socket.io / Engine.io frame. */
function decodeFrame(msg) {
  if (!msg || msg.length === 0) return null;

  if (msg === '2')      return { type: 'ping' };
  if (msg === '3')      return { type: 'pong' };
  if (msg === '3probe') return { type: 'pong-probe' };

  if (msg.startsWith('0')) return { type: 'open' };
  if (msg.startsWith('40')) return { type: 'connect' };
  if (msg.startsWith('41')) return { type: 'disconnect' };

  if (msg.startsWith('42')) {
    try {
      var arr = JSON.parse(msg.substring(2));
      return { type: 'event', eventName: arr[0], data: arr[1] };
    } catch (_) {
      return { type: 'unknown', raw: msg };
    }
  }

  return { type: 'unknown', raw: msg };
}

// ---------------------------------------------------------------------------
// Main VU function
// ---------------------------------------------------------------------------
export default function () {
  var vuId = __VU;
  var displayName = 'LoadBot-' + vuId;

  // 1. Authenticate via REST
  var auth = guestAuth(SERVER_URL, PARTY_CODE, displayName);
  if (!auth) {
    console.error('VU ' + vuId + ': auth failed, skipping iteration');
    sleep(5);
    return;
  }

  // 2. Socket.io handshake — polling transport to get EIO session ID
  var pollUrl = SERVER_URL + '/socket.io/?EIO=4&transport=polling';
  var handshakeRes = http.get(pollUrl);

  if (handshakeRes.status !== 200) {
    console.error('VU ' + vuId + ': polling handshake failed: ' + handshakeRes.status);
    sleep(5);
    return;
  }

  var sid = parseSid(handshakeRes.body);
  if (!sid) {
    console.error('VU ' + vuId + ': could not parse sid from: ' + handshakeRes.body);
    sleep(5);
    return;
  }

  // 3. Upgrade to WebSocket
  var wsUrl = WS_BASE + '/socket.io/?EIO=4&transport=websocket&sid=' + sid;

  var emojis = ['\uD83C\uDFA4', '\uD83D\uDD25', '\u2764\uFE0F', '\uD83D\uDE0D',
                '\uD83C\uDFB6', '\uD83D\uDC4F', '\uD83D\uDE4C', '\uD83D\uDC83'];
  var pendingTs = 0; // timestamp of last sent reaction (for RTT)

  var res = ws.connect(wsUrl, {}, function (socket) {
    var connected = false;

    socket.on('open', function () {
      // Send EIO upgrade probe
      socket.send('2probe');
    });

    socket.on('message', function (msg) {
      wsMessagesReceived.add(1);
      var frame = decodeFrame(msg);
      if (!frame) return;

      if (frame.type === 'pong-probe') {
        // Complete the upgrade: send "5" then Socket.io CONNECT with auth
        socket.send('5');
        socket.send('40' + JSON.stringify({
          token: auth.token,
          sessionId: auth.sessionId,
          displayName: displayName,
        }));
        return;
      }

      if (frame.type === 'ping') {
        socket.send('3');
        return;
      }

      if (frame.type === 'connect') {
        connected = true;
        connectionsEstablished.add(1);
        return;
      }

      if (frame.type === 'event') {
        if (frame.eventName === 'reaction:broadcast') {
          reactionBroadcasts.add(1);
          if (pendingTs > 0) {
            reactionRoundTrip.add(Date.now() - pendingTs);
            pendingTs = 0;
          }
        } else if (frame.eventName === 'dj:stateChanged') {
          if (frame.data && frame.data._serverTs) {
            djStateSyncLatency.add(Date.now() - frame.data._serverTs);
          }
        } else if (frame.eventName === 'party:ended') {
          socket.close();
        }
      }
    });

    // Send reactions every ~2 seconds
    socket.setInterval(function () {
      if (!connected) return;
      var emoji = emojis[Math.floor(Math.random() * emojis.length)];
      pendingTs = Date.now();
      socket.send(encodeEvent('reaction:sent', { emoji: emoji }));
      wsMessagesSent.add(1);
    }, 2000);

    // Keep alive for ~290s (just under 5 min scenario duration)
    socket.setTimeout(function () {
      socket.close();
    }, 290000);
  });

  check(res, {
    'WebSocket status is 101': function (r) { return r && r.status === 101; },
  });
}
