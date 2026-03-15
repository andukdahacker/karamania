import 'dotenv/config';
import { db } from '../src/db/connection.js';
import * as catalogRepository from '../src/persistence/catalog-repository.js';
import { CLASSIC_KARAOKE_SONGS } from './data/classic-karaoke-songs.js';

async function main() {
  console.log(`Seeding ${CLASSIC_KARAOKE_SONGS.length} classic karaoke songs...\n`);

  const tracks = CLASSIC_KARAOKE_SONGS.map((song) => ({
    song_title: song.song_title,
    artist: song.artist,
    youtube_video_id: song.youtube_video_id,
    channel: 'classics',
    is_classic: true,
  }));

  await catalogRepository.upsertBatch(tracks);

  const count = await catalogRepository.getCount();
  const classics = await catalogRepository.findClassics();

  console.log(`✅ Seeded ${classics.length} classic tracks`);
  console.log(`📊 Total catalog size: ${count}`);

  await db.destroy();
  console.log('\nDone.');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  db.destroy().finally(() => process.exit(1));
});
