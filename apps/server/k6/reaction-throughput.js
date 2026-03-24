import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import http from 'k6/http';
import ws from 'k6/ws';
import { guestAuth } from './helpers/auth.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
var SERVER_URL = __ENV.SERVER_URL || 'http://localhost:3000';
var PARTY_CODE = __ENV.PARTY_CODE;
var WS_BASE    = SERVER_URL.replace(/^http/, 'ws');

if (!PARTY_CODE) {
  throw new Error('PARTY_CODE env var is required. Run with: k6 run k6/reaction-throughput.js -e PARTY_CODE=ABC123');
}

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
var reactionsSent       = new Counter('reactions_sent');
var reactionsBroadcast  = new Counter('reactions_broadcast');
var broadcastLatency    = new Trend('broadcast_latency_ms');
var rateLimited         = new Counter('rate_limited_count');
var wsErrors            = new Counter('ws_errors');
var throughput          = new Rate('reaction_success_rate');

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export var options = {
  scenarios: {
    reaction_stress: {
      executor: 'constant-vus',
      vus: 12,
      duration: '2m',
    },
  },
  thresholds: {
    'broadcast_latency_ms':    ['p(95)<200'],   // p95 broadcast latency < 200ms
    'reaction_success_rate':   ['rate>0.5'],     // at least 50% reactions succeed (rate limiter will throttle)
    'ws_errors':               ['count<50'],     // fewer than 50 WS errors total
  },
};

// ---------------------------------------------------------------------------
// Socket.io EIO4 helpers (same as party-load.js)
// ---------------------------------------------------------------------------

function parseSid(body) {
  var match = body.match(/0(\{.*\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]).sid;
  } catch (_) {
    return null;
  }
}

function encodeEvent(eventName, data) {
  return '42' + JSON.stringify([eventName, data]);
}

function decodeFrame(msg) {
  if (!msg || msg.length === 0) return null;

  if (msg === '2')      return { type: 'ping' };
  if (msg === '3')      return { type: 'pong' };
  if (msg === '3probe') return { type: 'pong-probe' };

  if (msg.startsWith('0'))  return { type: 'open' };
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
  var displayName = 'StressBot-' + vuId;

  // 1. Authenticate via REST
  var auth = guestAuth(SERVER_URL, PARTY_CODE, displayName);
  if (!auth) {
    console.error('VU ' + vuId + ': auth failed, skipping iteration');
    sleep(5);
    return;
  }

  // 2. Socket.io polling handshake
  var pollUrl = SERVER_URL + '/socket.io/?EIO=4&transport=polling';
  var handshakeRes = http.get(pollUrl);

  if (handshakeRes.status !== 200) {
    console.error('VU ' + vuId + ': polling handshake failed: ' + handshakeRes.status);
    sleep(5);
    return;
  }

  var sid = parseSid(handshakeRes.body);
  if (!sid) {
    console.error('VU ' + vuId + ': could not parse sid');
    sleep(5);
    return;
  }

  // 3. Upgrade to WebSocket
  var wsUrl = WS_BASE + '/socket.io/?EIO=4&transport=websocket&sid=' + sid;

  var emojis = ['\uD83C\uDFA4', '\uD83D\uDD25', '\u2764\uFE0F', '\uD83D\uDE0D',
                '\uD83C\uDFB6', '\uD83D\uDC4F', '\uD83D\uDE4C', '\uD83D\uDC83'];

  // Track pending reactions with a simple ring buffer approach
  var sendTimes = [];     // array of { id, ts }
  var nextId = 0;

  var res = ws.connect(wsUrl, {}, function (socket) {
    var connected = false;

    socket.on('open', function () {
      socket.send('2probe');
    });

    socket.on('message', function (msg) {
      var frame = decodeFrame(msg);
      if (!frame) return;

      if (frame.type === 'pong-probe') {
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
        return;
      }

      if (frame.type === 'event') {
        if (frame.eventName === 'reaction:broadcast') {
          reactionsBroadcast.add(1);
          throughput.add(true);

          // Measure latency from oldest pending send
          if (sendTimes.length > 0) {
            var entry = sendTimes.shift();
            broadcastLatency.add(Date.now() - entry.ts);
          }
        } else if (frame.eventName === 'party:ended') {
          socket.close();
        }
      }

      if (frame.type === 'disconnect') {
        wsErrors.add(1);
      }
    });

    socket.on('error', function (e) {
      wsErrors.add(1);
      console.error('VU ' + vuId + ' WS error: ' + e);
    });

    // Blast reactions every 100ms
    socket.setInterval(function () {
      if (!connected) return;
      var emoji = emojis[Math.floor(Math.random() * emojis.length)];
      var id = nextId++;
      var ts = Date.now();

      sendTimes.push({ id: id, ts: ts });
      // Cap the pending queue to avoid memory growth
      if (sendTimes.length > 200) {
        sendTimes.shift();
        rateLimited.add(1);
      }

      socket.send(encodeEvent('reaction:sent', { emoji: emoji }));
      reactionsSent.add(1);
    }, 100);

    // Run for ~115s (just under 2 min scenario)
    socket.setTimeout(function () {
      socket.close();
    }, 115000);
  });

  check(res, {
    'WebSocket status is 101': function (r) { return r && r.status === 101; },
  });
}
