/**
 * Mock API server for external service dependencies.
 *
 * Simulates:
 *   - YouTube Lounge API (TV pairing & playback control)
 *   - YouTube Data API v3 (playlist items, video details, search)
 *   - Spotify Web API (client credentials auth, playlist tracks)
 *
 * Usage:
 *   npx tsx scripts/mock-api-server.ts --port 3001
 *   npx tsx scripts/mock-api-server.ts --port 3001 --delay 200
 *
 * Then configure your .env.local with:
 *   YOUTUBE_LOUNGE_URL=http://localhost:3001/lounge
 *   YOUTUBE_DATA_URL=http://localhost:3001/youtube
 *   SPOTIFY_API_URL=http://localhost:3001/spotify
 */

import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const { values: cliArgs } = parseArgs({
  options: {
    port: { type: 'string', default: '3001' },
    delay: { type: 'string', default: '0' },
  },
  strict: false,
});

const PORT = Number(cliArgs.port) || 3001;
const DELAY_MS = Number(cliArgs.delay) || 0;

// ---------------------------------------------------------------------------
// Fixture data — realistic karaoke songs
// ---------------------------------------------------------------------------

const FIXTURE_SONGS = [
  { videoId: 'dQw4w9WgXcQ', title: 'Rick Astley - Never Gonna Give You Up (Karaoke Version)', artist: 'Rick Astley', channelTitle: 'Karaoke Hits', duration: 'PT3M33S' },
  { videoId: 'fJ9rUzIMcZQ', title: 'Queen - Bohemian Rhapsody (Karaoke Version)', artist: 'Queen', channelTitle: 'SingKing Karaoke', duration: 'PT5M55S' },
  { videoId: '1w7OgIMMRc4', title: 'Journey - Don\'t Stop Believin\' (Karaoke Version)', artist: 'Journey', channelTitle: 'Karaoke Hits', duration: 'PT4M11S' },
  { videoId: 'hTWKbfoikeg', title: 'Adele - Rolling in the Deep (Karaoke Version)', artist: 'Adele', channelTitle: 'SingKing Karaoke', duration: 'PT3M48S' },
  { videoId: 'kJQP7kiw5Fk', title: 'Luis Fonsi - Despacito (Karaoke Version)', artist: 'Luis Fonsi', channelTitle: 'Karaoke Hits', duration: 'PT4M41S' },
  { videoId: 'CevxZvSJLk8', title: 'The Killers - Mr. Brightside (Karaoke Version)', artist: 'The Killers', channelTitle: 'Stingray Karaoke', duration: 'PT3M42S' },
  { videoId: 'RgKAFK5djSk', title: 'Whitney Houston - I Will Always Love You (Karaoke Version)', artist: 'Whitney Houston', channelTitle: 'SingKing Karaoke', duration: 'PT4M31S' },
  { videoId: 'YQHsXMglC9A', title: 'Backstreet Boys - I Want It That Way (Karaoke Version)', artist: 'Backstreet Boys', channelTitle: 'Karaoke Hits', duration: 'PT3M33S' },
  { videoId: 'hT_nvWreIhg', title: 'ABBA - Dancing Queen (Karaoke Version)', artist: 'ABBA', channelTitle: 'SingKing Karaoke', duration: 'PT3M51S' },
  { videoId: 'djV11Xbc914', title: 'Bon Jovi - Livin\' on a Prayer (Karaoke Version)', artist: 'Bon Jovi', channelTitle: 'Stingray Karaoke', duration: 'PT4M09S' },
  { videoId: 'btPJPFnesV4', title: 'Ed Sheeran - Shape of You (Karaoke Version)', artist: 'Ed Sheeran', channelTitle: 'Karaoke Hits', duration: 'PT3M53S' },
  { videoId: 'rYEDA3JcQqw', title: 'Dolly Parton - Jolene (Karaoke Version)', artist: 'Dolly Parton', channelTitle: 'Stingray Karaoke', duration: 'PT2M42S' },
];

const SPOTIFY_FIXTURE_TRACKS = [
  { name: 'Bohemian Rhapsody', artist: 'Queen', spotifyUrl: 'https://open.spotify.com/track/3z8h0TU7ReDPLIbEnYhWZb' },
  { name: 'Don\'t Stop Believin\'', artist: 'Journey', spotifyUrl: 'https://open.spotify.com/track/4bHsxqR3GMrXTxEPLuK5ue' },
  { name: 'Sweet Caroline', artist: 'Neil Diamond', spotifyUrl: 'https://open.spotify.com/track/62AuGbAkt8Ox2IrFFb8GKe' },
  { name: 'Livin\' on a Prayer', artist: 'Bon Jovi', spotifyUrl: 'https://open.spotify.com/track/37ZJ0p5Jm13JPevGcx4SkF' },
  { name: 'I Will Always Love You', artist: 'Whitney Houston', spotifyUrl: 'https://open.spotify.com/track/4eHbdreAnSOrDDsFfc4Fpm' },
  { name: 'Mr. Brightside', artist: 'The Killers', spotifyUrl: 'https://open.spotify.com/track/003vvx7Niy0yvhvHt4a68B' },
  { name: 'Dancing Queen', artist: 'ABBA', spotifyUrl: 'https://open.spotify.com/track/0GjEhVFGZW8afUYGChu3Rr' },
  { name: 'Rolling in the Deep', artist: 'Adele', spotifyUrl: 'https://open.spotify.com/track/1c8gk2PeTE04A1pIDH9YMk' },
  { name: 'Shape of You', artist: 'Ed Sheeran', spotifyUrl: 'https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3' },
  { name: 'Jolene', artist: 'Dolly Parton', spotifyUrl: 'https://open.spotify.com/track/5A4OlVeyBPbqIcgRmEeTG5' },
];

// ---------------------------------------------------------------------------
// Lounge session state (in-memory)
// ---------------------------------------------------------------------------

let loungeSessionCounter = 0;
const activeSessions = new Map<string, { screenId: string; loungeToken: string; sid: string; gsessionid: string }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLoungeChunkedResponse(entries: Array<[number, unknown[]]>): string {
  const json = JSON.stringify(entries);
  return `${json.length}\n${json}\n`;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const app = Fastify({ logger: false });

// Parse body as text for Lounge endpoints (form-urlencoded)
app.addContentTypeParser(
  'application/x-www-form-urlencoded',
  { parseAs: 'string' },
  (_req, body, done) => {
    done(null, body);
  },
);

// Request logger
app.addHook('onRequest', async (request) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${request.method} ${request.url}`);
});

// Delay hook
if (DELAY_MS > 0) {
  app.addHook('onRequest', async () => {
    await sleep(DELAY_MS);
  });
}

// Health check
app.get('/health', async () => ({ status: 'ok', mock: true }));

// ==========================================================================
// YOUTUBE LOUNGE API — /lounge/*
// ==========================================================================

// POST /lounge/pairing/get_screen
// Body: pairing_code=<code>  (form-urlencoded)
// Response: { screen: { screenId, loungeToken } }
app.post('/lounge/pairing/get_screen', async (request, reply) => {
  const body = request.body as string;
  const params = new URLSearchParams(body);
  const pairingCode = params.get('pairing_code');

  console.log(`  [lounge] get_screen pairing_code=${pairingCode}`);

  if (!pairingCode || pairingCode.length < 4) {
    return reply.status(400).send({ error: 'Invalid pairing code' });
  }

  const screenId = `mock-screen-${randomUUID().slice(0, 8)}`;
  const loungeToken = `mock-lounge-token-${randomUUID()}`;

  return {
    screen: { screenId, loungeToken },
  };
});

// POST /lounge/pairing/get_lounge_token_batch
// Body: screen_ids=<screenId>  (form-urlencoded)
// Response: { screens: [{ loungeToken }] }
app.post('/lounge/pairing/get_lounge_token_batch', async (request) => {
  const body = request.body as string;
  const params = new URLSearchParams(body);
  const screenIds = params.get('screen_ids');

  console.log(`  [lounge] get_lounge_token_batch screen_ids=${screenIds}`);

  return {
    screens: [{ loungeToken: `mock-lounge-token-refreshed-${randomUUID()}` }],
  };
});

// POST /lounge/bc/bind — initial bind (creates session) or command dispatch
// Body (bind): loungeIdToken, device, id, VER, CVER, zx
// Body (command): SID, gsessionid, RID, req0__sc, req0_videoId, count
// Response: length-prefixed chunked format with [idx, ["c", SID], ["S", gsessionid]]
app.post('/lounge/bc/bind', async (request, reply) => {
  const body = request.body as string;
  const params = new URLSearchParams(body);

  // Command dispatch (has SID)
  if (params.has('SID')) {
    const command = params.get('req0__sc');
    const videoId = params.get('req0_videoId');
    console.log(`  [lounge] command: ${command} videoId=${videoId}`);

    reply.header('content-type', 'text/plain');
    loungeSessionCounter++;
    const responseEntries: Array<[number, unknown[]]> = [
      [loungeSessionCounter, ['ack']],
    ];
    return makeLoungeChunkedResponse(responseEntries);
  }

  // Initial bind
  const loungeToken = params.get('loungeIdToken') ?? 'unknown';
  console.log(`  [lounge] bind loungeIdToken=${loungeToken.slice(0, 30)}...`);

  const sid = `mock-sid-${randomUUID().slice(0, 12)}`;
  const gsessionid = `mock-gsession-${randomUUID().slice(0, 12)}`;
  const screenId = `mock-screen-${randomUUID().slice(0, 8)}`;

  activeSessions.set(sid, { screenId, loungeToken, sid, gsessionid });

  reply.header('content-type', 'text/plain');
  const responseEntries: Array<[number, unknown[]]> = [
    [0, ['c', sid, '', 8]],
    [1, ['S', gsessionid]],
  ];
  return makeLoungeChunkedResponse(responseEntries);
});

// GET /lounge/bc/bind — long-poll for events
// Query: SID, gsessionid, RID=rpc, CI, TYPE=xmlhttp, AID
app.get('/lounge/bc/bind', async (request, reply) => {
  const query = request.query as Record<string, string>;
  const sid = query['SID'] ?? '';
  const aid = Number(query['AID'] ?? '0');

  console.log(`  [lounge] long-poll SID=${sid.slice(0, 20)}... AID=${aid}`);

  // Simulate a small delay for long-poll then return a nowPlaying event
  await sleep(Math.max(1000, DELAY_MS));

  const song = FIXTURE_SONGS[aid % FIXTURE_SONGS.length]!;

  reply.header('content-type', 'text/plain');
  const responseEntries: Array<[number, unknown[]]> = [
    [aid, ['nowPlaying', { videoId: song.videoId, title: song.title, state: '1' }]],
  ];
  return makeLoungeChunkedResponse(responseEntries);
});

// ==========================================================================
// YOUTUBE DATA API v3 — /youtube/v3/*
// ==========================================================================

// GET /youtube/v3/playlistItems
// Query: part, playlistId, maxResults, key, pageToken?
// Response: { items: [{ snippet: { title, resourceId: { videoId }, videoOwnerChannelTitle } }], nextPageToken? }
app.get('/youtube/v3/playlistItems', async (request, reply) => {
  const query = request.query as Record<string, string>;
  const playlistId = query['playlistId'];
  const maxResults = Math.min(Number(query['maxResults'] ?? '50'), 50);
  const pageToken = query['pageToken'];

  console.log(`  [youtube] playlistItems playlistId=${playlistId} maxResults=${maxResults} pageToken=${pageToken ?? 'none'}`);

  if (!playlistId) {
    return reply.status(400).send({ error: { code: 400, message: 'Missing playlistId' } });
  }

  // Simulate pagination: first page returns items 0..maxResults-1, no second page for simplicity
  const startIndex = pageToken === 'page2' ? 6 : 0;
  const endIndex = Math.min(startIndex + maxResults, FIXTURE_SONGS.length);
  const hasNextPage = !pageToken && endIndex < FIXTURE_SONGS.length;

  const items = FIXTURE_SONGS.slice(startIndex, endIndex).map((song) => ({
    snippet: {
      title: song.title,
      resourceId: { videoId: song.videoId },
      videoOwnerChannelTitle: song.channelTitle,
    },
  }));

  return {
    kind: 'youtube#playlistItemListResponse',
    pageInfo: { totalResults: FIXTURE_SONGS.length, resultsPerPage: maxResults },
    items,
    ...(hasNextPage ? { nextPageToken: 'page2' } : {}),
  };
});

// GET /youtube/v3/videos
// Query: part (snippet,contentDetails), id (comma-separated videoIds), key
// Response: { items: [{ id, snippet: { title, channelTitle, thumbnails: { medium: { url } } }, contentDetails: { duration } }] }
app.get('/youtube/v3/videos', async (request, reply) => {
  const query = request.query as Record<string, string>;
  const ids = (query['id'] ?? '').split(',').filter(Boolean);

  console.log(`  [youtube] videos ids=${ids.join(',')}`);

  if (ids.length === 0) {
    return reply.status(400).send({ error: { code: 400, message: 'Missing id parameter' } });
  }

  const songMap = new Map(FIXTURE_SONGS.map((s) => [s.videoId, s]));

  const items = ids.map((id) => {
    const song = songMap.get(id);
    if (song) {
      return {
        id: song.videoId,
        snippet: {
          title: song.title,
          channelTitle: song.channelTitle,
          thumbnails: { medium: { url: `https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg` } },
        },
        contentDetails: { duration: song.duration },
      };
    }
    // Return a plausible item for unknown IDs
    return {
      id,
      snippet: {
        title: `Mock Song (${id})`,
        channelTitle: 'Mock Karaoke Channel',
        thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } },
      },
      contentDetails: { duration: 'PT3M30S' },
    };
  });

  return {
    kind: 'youtube#videoListResponse',
    pageInfo: { totalResults: items.length, resultsPerPage: items.length },
    items,
  };
});

// GET /youtube/v3/search
// Query: part, q, type, maxResults, key, pageToken?
// Response: { items: [{ id: { videoId }, snippet: { title, channelTitle, thumbnails } }], nextPageToken? }
app.get('/youtube/v3/search', async (request) => {
  const query = request.query as Record<string, string>;
  const q = query['q'] ?? '';
  const maxResults = Math.min(Number(query['maxResults'] ?? '5'), 50);

  console.log(`  [youtube] search q="${q}" maxResults=${maxResults}`);

  // Filter songs by search term (case-insensitive substring match)
  const lowerQ = q.toLowerCase();
  let results = FIXTURE_SONGS.filter(
    (s) => s.title.toLowerCase().includes(lowerQ) || s.artist.toLowerCase().includes(lowerQ),
  );

  // If no matches, return all songs (simulates broad results)
  if (results.length === 0) {
    results = FIXTURE_SONGS;
  }

  const items = results.slice(0, maxResults).map((song) => ({
    id: { kind: 'youtube#video', videoId: song.videoId },
    snippet: {
      title: song.title,
      channelTitle: song.channelTitle,
      thumbnails: { medium: { url: `https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg` } },
    },
  }));

  return {
    kind: 'youtube#searchListResponse',
    pageInfo: { totalResults: results.length, resultsPerPage: maxResults },
    items,
  };
});

// ==========================================================================
// SPOTIFY WEB API — /spotify/*
// ==========================================================================

// POST /spotify/api/token
// Body: grant_type=client_credentials (form-urlencoded)
// Headers: Authorization: Basic <base64(client_id:client_secret)>
// Response: { access_token, token_type, expires_in }
app.post('/spotify/api/token', async (request) => {
  const authHeader = (request.headers['authorization'] ?? '') as string;
  console.log(`  [spotify] token auth=${authHeader.slice(0, 20)}...`);

  return {
    access_token: `mock-spotify-token-${randomUUID()}`,
    token_type: 'Bearer',
    expires_in: 3600,
  };
});

// GET /spotify/v1/playlists/:id/tracks
// Headers: Authorization: Bearer <token>
// Query: fields, limit, offset
// Response: { items: [{ track: { name, artists, external_urls, is_local } }], next, total }
app.get<{ Params: { id: string } }>('/spotify/v1/playlists/:id/tracks', async (request) => {
  const playlistId = request.params.id;
  const query = request.query as Record<string, string>;
  const limit = Math.min(Number(query['limit'] ?? '100'), 100);
  const offset = Number(query['offset'] ?? '0');

  console.log(`  [spotify] playlist tracks id=${playlistId} limit=${limit} offset=${offset}`);

  const sliced = SPOTIFY_FIXTURE_TRACKS.slice(offset, offset + limit);
  const hasMore = offset + limit < SPOTIFY_FIXTURE_TRACKS.length;

  const items = sliced.map((track) => ({
    track: {
      name: track.name,
      artists: [{ name: track.artist }],
      external_urls: { spotify: track.spotifyUrl },
      is_local: false,
    },
  }));

  return {
    items,
    next: hasMore
      ? `http://localhost:${PORT}/spotify/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset + limit}`
      : null,
    total: SPOTIFY_FIXTURE_TRACKS.length,
  };
});

// ==========================================================================
// Start server
// ==========================================================================

async function start(): Promise<void> {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log('');
    console.log(`Mock API server listening on http://localhost:${PORT}`);
    console.log(`  Delay: ${DELAY_MS}ms`);
    console.log('');
    console.log('Endpoints:');
    console.log(`  YouTube Lounge: http://localhost:${PORT}/lounge`);
    console.log(`  YouTube Data:   http://localhost:${PORT}/youtube`);
    console.log(`  Spotify:        http://localhost:${PORT}/spotify`);
    console.log('');
    console.log('Configure .env.local:');
    console.log(`  YOUTUBE_LOUNGE_URL=http://localhost:${PORT}/lounge`);
    console.log(`  YOUTUBE_DATA_URL=http://localhost:${PORT}/youtube`);
    console.log(`  SPOTIFY_API_URL=http://localhost:${PORT}/spotify`);
    console.log('');
    console.log('Press Ctrl+C to stop.');
    console.log('');
  } catch (err) {
    console.error('Failed to start mock server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
function shutdown(): void {
  console.log('\nShutting down mock API server...');
  app.close().then(() => {
    console.log('Mock API server stopped.');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
