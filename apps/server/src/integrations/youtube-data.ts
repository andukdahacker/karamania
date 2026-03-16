import { parseKaraokeTitle } from '../shared/title-parser.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const MAX_RESULTS_PER_PAGE = 50;
const MAX_RETRIES = 3;

export interface PlaylistTrack {
  songTitle: string;
  artist: string;
  youtubeVideoId: string;
}

export interface PlaylistResult {
  tracks: PlaylistTrack[];
  unparseable: number;
  totalFetched: number;
}

export function extractPlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');

    if (hostname !== 'music.youtube.com' && hostname !== 'youtube.com') {
      return null;
    }

    if (!parsed.pathname.startsWith('/playlist')) {
      return null;
    }

    const listId = parsed.searchParams.get('list');
    if (!listId) {
      return null;
    }

    return listId;
  } catch {
    return null;
  }
}

async function fetchPlaylistPage(
  playlistId: string,
  apiKey: string,
  pageToken?: string,
): Promise<{ items: Array<{ snippet: { title: string; resourceId: { videoId: string } } }>; nextPageToken?: string }> {
  const params = new URLSearchParams({
    part: 'snippet',
    playlistId,
    maxResults: String(MAX_RESULTS_PER_PAGE),
    key: apiKey,
  });
  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const url = `${YOUTUBE_API_BASE}/playlistItems?${params.toString()}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (response.ok) {
      return response.json() as Promise<{ items: Array<{ snippet: { title: string; resourceId: { videoId: string } } }>; nextPageToken?: string }>;
    }

    if (response.status === 404) {
      throw new Error('Playlist not found or is private');
    }

    if (response.status === 429 || response.status >= 500) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
  }

  throw new Error(`Failed after ${MAX_RETRIES} retries`);
}

export async function fetchPlaylistTracks(playlistId: string, apiKey: string): Promise<PlaylistResult> {
  const tracks: PlaylistTrack[] = [];
  let unparseable = 0;
  let totalFetched = 0;
  let pageToken: string | undefined;

  do {
    const data = await fetchPlaylistPage(playlistId, apiKey, pageToken);

    for (const item of data.items) {
      totalFetched++;
      const parsed = parseKaraokeTitle(item.snippet.title);
      if (!parsed) {
        unparseable++;
        continue;
      }

      tracks.push({
        songTitle: parsed.songTitle,
        artist: parsed.artist,
        youtubeVideoId: item.snippet.resourceId.videoId,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return { tracks, unparseable, totalFetched };
}
