import type { PlaylistTrack, PlaylistResult } from './youtube-data.js';

const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const MAX_RETRIES = 3;
const MAX_PAGES = 5; // 500 tracks max (100 per page) for NFR29 5-second compliance
const ITEMS_PER_PAGE = 100;
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export function resetTokenCache(): void {
  cachedToken = null;
}

export function extractPlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');

    if (hostname !== 'open.spotify.com' && hostname !== 'spotify.com') {
      return null;
    }

    const match = parsed.pathname.match(/^\/playlist\/([a-zA-Z0-9]+)/);
    if (!match) {
      return null;
    }

    return match[1]!;
  } catch {
    return null;
  }
}

export async function getClientCredentialsToken(
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(SPOTIFY_ACCOUNTS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Spotify auth error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { access_token: string; token_type: string; expires_in: number };

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken;
}

interface SpotifyTrackItem {
  track: {
    name: string;
    artists: Array<{ name: string }>;
    external_urls: { spotify: string };
    is_local: boolean;
  } | null;
}

interface SpotifyPlaylistResponse {
  items: SpotifyTrackItem[];
  next: string | null;
  total: number;
}

async function fetchWithRetry(url: string, accessToken: string): Promise<SpotifyPlaylistResponse> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (response.ok) {
      return response.json() as Promise<SpotifyPlaylistResponse>;
    }

    if (response.status === 403) {
      throw new Error('This Spotify playlist is private. Make it public in your Spotify app and try again.');
    }

    if (response.status === 404) {
      throw new Error('Spotify playlist not found');
    }

    if (response.status === 429 || response.status >= 500) {
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
  }

  throw new Error(`Failed after ${MAX_RETRIES} retries`);
}

export async function fetchPlaylistTracks(
  playlistId: string,
  clientId: string,
  clientSecret: string,
): Promise<PlaylistResult> {
  const token = await getClientCredentialsToken(clientId, clientSecret);
  const tracks: PlaylistTrack[] = [];
  let totalFetched = 0;
  let pageCount = 0;

  const fields = 'items(track(name,artists(name),external_urls(spotify),is_local)),next,total';
  let url: string | null = `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?fields=${encodeURIComponent(fields)}&limit=${ITEMS_PER_PAGE}`;

  while (url && pageCount < MAX_PAGES) {
    const data = await fetchWithRetry(url, token.accessToken);

    if (pageCount === 0) {
      totalFetched = data.total;
    }

    for (const item of data.items) {
      if (!item.track) continue;
      if (item.track.is_local) continue;

      tracks.push({
        songTitle: item.track.name,
        artist: item.track.artists[0]?.name ?? '',
        youtubeVideoId: '',
      });
    }

    url = data.next;
    pageCount++;
  }

  return { tracks, unparseable: 0, totalFetched };
}
