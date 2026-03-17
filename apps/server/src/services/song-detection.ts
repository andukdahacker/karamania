import { findByYoutubeVideoId } from '../persistence/catalog-repository.js';
import { fetchVideoDetails } from '../integrations/youtube-data.js';
import { parseKaraokeTitle } from '../shared/title-parser.js';
import { config } from '../config.js';

export interface DetectedSong {
  videoId: string;
  songTitle: string;
  artist: string;
  channel: string | null;
  thumbnail: string | null;
  source: 'catalog' | 'api-parsed' | 'api-raw';
}

// Global cache — videoIds are universal across sessions
const detectionCache = new Map<string, DetectedSong>();

export async function detectSong(videoId: string): Promise<DetectedSong | null> {
  // Tier 1: Cache
  const cached = detectionCache.get(videoId);
  if (cached) {
    return cached;
  }

  // Tier 2: Catalog lookup (zero API quota)
  try {
    const catalogTrack = await findByYoutubeVideoId(videoId);
    if (catalogTrack) {
      const detected: DetectedSong = {
        videoId,
        songTitle: catalogTrack.song_title,
        artist: catalogTrack.artist,
        channel: catalogTrack.channel,
        thumbnail: null,
        source: 'catalog',
      };
      detectionCache.set(videoId, detected);
      return detected;
    }
  } catch {
    // Catalog lookup failed, continue to Tier 3
  }

  // Tier 3: YouTube API + title parsing
  try {
    const details = await fetchVideoDetails([videoId], config.YOUTUBE_API_KEY);
    const videoDetail = details.get(videoId);
    if (!videoDetail) {
      return null;
    }

    const parsed = parseKaraokeTitle(videoDetail.title);
    let detected: DetectedSong;

    if (parsed) {
      detected = {
        videoId,
        songTitle: parsed.songTitle,
        artist: parsed.artist,
        channel: videoDetail.channelTitle,
        thumbnail: videoDetail.thumbnail,
        source: 'api-parsed',
      };
    } else {
      detected = {
        videoId,
        songTitle: videoDetail.title,
        artist: videoDetail.channelTitle,
        channel: videoDetail.channelTitle,
        thumbnail: videoDetail.thumbnail,
        source: 'api-raw',
      };
    }

    detectionCache.set(videoId, detected);
    return detected;
  } catch {
    return null;
  }
}

export function getCachedDetection(videoId: string): DetectedSong | undefined {
  return detectionCache.get(videoId);
}

export function resetDetectionCache(): void {
  detectionCache.clear();
}
