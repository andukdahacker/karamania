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

interface PlaylistPageItem {
  snippet: {
    title: string;
    resourceId: { videoId: string };
    videoOwnerChannelTitle?: string;
  };
}

async function fetchPlaylistPage(
  playlistId: string,
  apiKey: string,
  pageToken?: string,
): Promise<{ items: PlaylistPageItem[]; nextPageToken?: string }> {
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
      return response.json() as Promise<{ items: PlaylistPageItem[]; nextPageToken?: string }>;
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

export interface VideoDetails {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: string; // ISO 8601 duration, e.g., "PT3M45S"
}

interface VideoListResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      channelTitle: string;
      thumbnails: { medium: { url: string } };
    };
    contentDetails: { duration: string };
  }>;
}

export async function fetchVideoDetails(
  videoIds: string[],
  apiKey: string,
): Promise<Map<string, VideoDetails>> {
  if (videoIds.length === 0) {
    return new Map();
  }

  if (videoIds.length > 50) {
    throw new Error(`fetchVideoDetails accepts at most 50 video IDs per call, got ${videoIds.length}`);
  }

  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    id: videoIds.join(','),
    key: apiKey,
  });

  const url = `${YOUTUBE_API_BASE}/videos?${params.toString()}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (response.ok) {
      const data = (await response.json()) as VideoListResponse;
      const result = new Map<string, VideoDetails>();
      for (const item of data.items) {
        result.set(item.id, {
          videoId: item.id,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.medium?.url ?? '',
          duration: item.contentDetails.duration,
        });
      }
      return result;
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
      if (parsed) {
        tracks.push({
          songTitle: parsed.songTitle,
          artist: parsed.artist,
          youtubeVideoId: item.snippet.resourceId.videoId,
        });
      } else if (item.snippet.videoOwnerChannelTitle) {
        // Fallback: use video title as song title and channel as artist
        // Strip " - Topic" suffix that YouTube Music auto-generated channels use
        const artist = item.snippet.videoOwnerChannelTitle.replace(/\s*-\s*Topic$/, '');
        tracks.push({
          songTitle: item.snippet.title.trim(),
          artist,
          youtubeVideoId: item.snippet.resourceId.videoId,
        });
      } else {
        unparseable++;
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return { tracks, unparseable, totalFetched };
}
