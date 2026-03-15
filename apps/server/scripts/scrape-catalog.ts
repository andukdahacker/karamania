import 'dotenv/config';
import { db } from '../src/db/connection.js';
import * as catalogRepository from '../src/persistence/catalog-repository.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const MAX_RESULTS_PER_PAGE = 50;
const MAX_RETRIES = 3;

const KARAOKE_PLAYLISTS: Array<{ name: string; playlistId: string }> = [
  // Dev should look up actual playlist IDs from these channels
  { name: 'Sing King Karaoke', playlistId: 'PLACEHOLDER_SING_KING' },
  { name: 'Stingray Karaoke', playlistId: 'PLACEHOLDER_STINGRAY' },
  { name: 'Karaoke Version', playlistId: 'PLACEHOLDER_KARAOKE_VERSION' },
  { name: 'KaraFun', playlistId: 'PLACEHOLDER_KARAFUN' },
];

export function parseKaraokeTitle(title: string): { songTitle: string; artist: string } | null {
  // Strip common karaoke suffixes first
  let cleaned = title
    .replace(/\s*\|\s*Karaoke\s*(Version|With Lyrics|Instrumental)?\s*/gi, '')
    .replace(/\s*\(Karaoke\s*(Version)?\)\s*/gi, '')
    .replace(/\s*\(Instrumental\)\s*/gi, '')
    .replace(/\s*\(With Lyrics\)\s*/gi, '')
    .replace(/\s*\(Sing Along\)\s*/gi, '')
    .replace(/\s*-\s*Karaoke\s*(Version)?\s*$/gi, '')
    .trim();

  // Pattern 1: "Artist - Song"
  let match = cleaned.match(/^(.+?)\s*-\s*(.+)$/);
  if (match) {
    const part1 = match[1]!.trim();
    const part2 = match[2]!.trim();
    if (part1 && part2) {
      return { artist: part1, songTitle: part2 };
    }
  }

  return null;
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
    const response = await fetch(url);

    if (response.ok) {
      return response.json() as Promise<{ items: Array<{ snippet: { title: string; resourceId: { videoId: string } } }>; nextPageToken?: string }>;
    }

    if (response.status === 429 || response.status >= 500) {
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
  }

  throw new Error(`Failed after ${MAX_RETRIES} retries`);
}

async function scrapePlaylist(playlistId: string, channelName: string, apiKey: string, dryRun: boolean) {
  let pageToken: string | undefined;
  let totalProcessed = 0;
  let newOrUpdated = 0;
  let parseErrors = 0;

  do {
    const data = await fetchPlaylistPage(playlistId, apiKey, pageToken);

    const tracks: Array<{
      song_title: string;
      artist: string;
      youtube_video_id: string;
      channel: string;
    }> = [];

    for (const item of data.items) {
      totalProcessed++;
      const parsed = parseKaraokeTitle(item.snippet.title);
      if (!parsed) {
        parseErrors++;
        console.warn(`  Could not parse: "${item.snippet.title}"`);
        continue;
      }

      tracks.push({
        song_title: parsed.songTitle,
        artist: parsed.artist,
        youtube_video_id: item.snippet.resourceId.videoId,
        channel: channelName,
      });
    }

    if (tracks.length > 0 && !dryRun) {
      await catalogRepository.upsertBatch(tracks);
      newOrUpdated += tracks.length;
    } else if (dryRun) {
      newOrUpdated += tracks.length;
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return { totalProcessed, newOrUpdated, parseErrors };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const apiKey = process.env['YOUTUBE_API_KEY'];

  if (!apiKey) {
    console.error('YOUTUBE_API_KEY environment variable is required');
    process.exit(1);
  }

  if (dryRun) {
    console.log('🏃 DRY RUN MODE - no database writes will be performed\n');
  }

  console.log(`Scraping ${KARAOKE_PLAYLISTS.length} playlists...\n`);

  let grandTotalProcessed = 0;
  let grandTotalUpserted = 0;
  let grandTotalErrors = 0;

  for (const playlist of KARAOKE_PLAYLISTS) {
    console.log(`📋 ${playlist.name} (${playlist.playlistId})`);

    try {
      const result = await scrapePlaylist(playlist.playlistId, playlist.name, apiKey, dryRun);
      grandTotalProcessed += result.totalProcessed;
      grandTotalUpserted += result.newOrUpdated;
      grandTotalErrors += result.parseErrors;

      console.log(`   ✅ Processed: ${result.totalProcessed}, Upserted: ${result.newOrUpdated}, Parse errors: ${result.parseErrors}\n`);
    } catch (error) {
      console.error(`   ❌ Error scraping ${playlist.name}:`, error);
      grandTotalErrors++;
    }
  }

  console.log('='.repeat(50));
  console.log(`Total processed: ${grandTotalProcessed}`);
  console.log(`Total upserted: ${grandTotalUpserted}`);
  console.log(`Total errors: ${grandTotalErrors}`);

  await db.destroy();
  console.log('\nDone.');
}

if (!process.env['VITEST']) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    db.destroy().finally(() => process.exit(1));
  });
}
