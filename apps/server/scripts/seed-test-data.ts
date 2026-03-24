import 'dotenv/config';
import { db } from '../src/db/connection.js';


// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const shouldClean = process.argv.includes('--clean');

// ---------------------------------------------------------------------------
// Deterministic IDs so the script is idempotent
// ---------------------------------------------------------------------------
const USER_IDS = {
  host: '00000000-0000-4000-a000-000000000001',
  guest1: '00000000-0000-4000-a000-000000000002',
  guest2: '00000000-0000-4000-a000-000000000003',
  guest3: '00000000-0000-4000-a000-000000000004',
  guest4: '00000000-0000-4000-a000-000000000005',
} as const;

const SESSION_IDS = {
  vibe: '10000000-0000-4000-a000-000000000001',
  kpop: '10000000-0000-4000-a000-000000000002',
  rock: '10000000-0000-4000-a000-000000000003',
} as const;

// ---------------------------------------------------------------------------
// Test users
// ---------------------------------------------------------------------------
const TEST_USERS = [
  { id: USER_IDS.host, firebase_uid: 'seed-fb-host', display_name: 'DJ Master', avatar_url: null },
  { id: USER_IDS.guest1, firebase_uid: 'seed-fb-guest1', display_name: 'Party Queen', avatar_url: null },
  { id: USER_IDS.guest2, firebase_uid: 'seed-fb-guest2', display_name: 'Mic Slayer', avatar_url: null },
  { id: USER_IDS.guest3, firebase_uid: 'seed-fb-guest3', display_name: 'Vibe Check', avatar_url: null },
  { id: USER_IDS.guest4, firebase_uid: 'seed-fb-guest4', display_name: 'Bass Drop', avatar_url: null },
];

// ---------------------------------------------------------------------------
// 100 catalog tracks — mix of popular karaoke songs
// ---------------------------------------------------------------------------
const CATALOG_TRACKS: Array<{
  song_title: string;
  artist: string;
  youtube_video_id: string;
  channel: string;
  is_classic: boolean;
}> = [
  // Pop classics
  { song_title: "Don't Stop Believin'", artist: 'Journey', youtube_video_id: 'seed-yt-001', channel: 'pop', is_classic: true },
  { song_title: 'Bohemian Rhapsody', artist: 'Queen', youtube_video_id: 'seed-yt-002', channel: 'rock', is_classic: true },
  { song_title: 'Sweet Caroline', artist: 'Neil Diamond', youtube_video_id: 'seed-yt-003', channel: 'pop', is_classic: true },
  { song_title: 'Livin on a Prayer', artist: 'Bon Jovi', youtube_video_id: 'seed-yt-004', channel: 'rock', is_classic: true },
  { song_title: 'I Will Survive', artist: 'Gloria Gaynor', youtube_video_id: 'seed-yt-005', channel: 'pop', is_classic: true },
  { song_title: 'Dancing Queen', artist: 'ABBA', youtube_video_id: 'seed-yt-006', channel: 'pop', is_classic: true },
  { song_title: 'Mr. Brightside', artist: 'The Killers', youtube_video_id: 'seed-yt-007', channel: 'rock', is_classic: false },
  { song_title: 'Total Eclipse of the Heart', artist: 'Bonnie Tyler', youtube_video_id: 'seed-yt-008', channel: 'pop', is_classic: true },
  { song_title: 'Take Me Home, Country Roads', artist: 'John Denver', youtube_video_id: 'seed-yt-009', channel: 'pop', is_classic: true },
  { song_title: 'Hotel California', artist: 'Eagles', youtube_video_id: 'seed-yt-010', channel: 'rock', is_classic: true },
  // Modern pop
  { song_title: 'Levitating', artist: 'Dua Lipa', youtube_video_id: 'seed-yt-011', channel: 'pop', is_classic: false },
  { song_title: 'Blinding Lights', artist: 'The Weeknd', youtube_video_id: 'seed-yt-012', channel: 'pop', is_classic: false },
  { song_title: 'Watermelon Sugar', artist: 'Harry Styles', youtube_video_id: 'seed-yt-013', channel: 'pop', is_classic: false },
  { song_title: 'drivers license', artist: 'Olivia Rodrigo', youtube_video_id: 'seed-yt-014', channel: 'pop', is_classic: false },
  { song_title: 'Stay', artist: 'The Kid LAROI & Justin Bieber', youtube_video_id: 'seed-yt-015', channel: 'pop', is_classic: false },
  { song_title: 'good 4 u', artist: 'Olivia Rodrigo', youtube_video_id: 'seed-yt-016', channel: 'pop', is_classic: false },
  { song_title: 'Peaches', artist: 'Justin Bieber', youtube_video_id: 'seed-yt-017', channel: 'pop', is_classic: false },
  { song_title: 'Montero', artist: 'Lil Nas X', youtube_video_id: 'seed-yt-018', channel: 'pop', is_classic: false },
  { song_title: 'Kiss Me More', artist: 'Doja Cat ft. SZA', youtube_video_id: 'seed-yt-019', channel: 'pop', is_classic: false },
  { song_title: 'Save Your Tears', artist: 'The Weeknd', youtube_video_id: 'seed-yt-020', channel: 'pop', is_classic: false },
  // Hip-hop / R&B
  { song_title: 'Lose Yourself', artist: 'Eminem', youtube_video_id: 'seed-yt-021', channel: 'hiphop', is_classic: true },
  { song_title: 'HUMBLE.', artist: 'Kendrick Lamar', youtube_video_id: 'seed-yt-022', channel: 'hiphop', is_classic: false },
  { song_title: 'Hotline Bling', artist: 'Drake', youtube_video_id: 'seed-yt-023', channel: 'hiphop', is_classic: false },
  { song_title: 'Sicko Mode', artist: 'Travis Scott', youtube_video_id: 'seed-yt-024', channel: 'hiphop', is_classic: false },
  { song_title: 'Old Town Road', artist: 'Lil Nas X', youtube_video_id: 'seed-yt-025', channel: 'hiphop', is_classic: false },
  { song_title: 'Alright', artist: 'Kendrick Lamar', youtube_video_id: 'seed-yt-026', channel: 'hiphop', is_classic: false },
  { song_title: "Juicy", artist: 'The Notorious B.I.G.', youtube_video_id: 'seed-yt-027', channel: 'hiphop', is_classic: true },
  { song_title: 'In Da Club', artist: '50 Cent', youtube_video_id: 'seed-yt-028', channel: 'hiphop', is_classic: true },
  { song_title: 'Rappers Delight', artist: 'Sugarhill Gang', youtube_video_id: 'seed-yt-029', channel: 'hiphop', is_classic: true },
  { song_title: 'Gold Digger', artist: 'Kanye West', youtube_video_id: 'seed-yt-030', channel: 'hiphop', is_classic: false },
  // K-pop
  { song_title: 'Dynamite', artist: 'BTS', youtube_video_id: 'seed-yt-031', channel: 'kpop', is_classic: false },
  { song_title: 'How You Like That', artist: 'BLACKPINK', youtube_video_id: 'seed-yt-032', channel: 'kpop', is_classic: false },
  { song_title: 'Butter', artist: 'BTS', youtube_video_id: 'seed-yt-033', channel: 'kpop', is_classic: false },
  { song_title: 'Lovesick Girls', artist: 'BLACKPINK', youtube_video_id: 'seed-yt-034', channel: 'kpop', is_classic: false },
  { song_title: 'Next Level', artist: 'aespa', youtube_video_id: 'seed-yt-035', channel: 'kpop', is_classic: false },
  { song_title: 'Gangnam Style', artist: 'PSY', youtube_video_id: 'seed-yt-036', channel: 'kpop', is_classic: true },
  { song_title: 'Fantastic Baby', artist: 'BIGBANG', youtube_video_id: 'seed-yt-037', channel: 'kpop', is_classic: true },
  { song_title: 'TT', artist: 'TWICE', youtube_video_id: 'seed-yt-038', channel: 'kpop', is_classic: false },
  { song_title: 'Love Dive', artist: 'IVE', youtube_video_id: 'seed-yt-039', channel: 'kpop', is_classic: false },
  { song_title: 'Super Shy', artist: 'NewJeans', youtube_video_id: 'seed-yt-040', channel: 'kpop', is_classic: false },
  // Rock
  { song_title: 'Smells Like Teen Spirit', artist: 'Nirvana', youtube_video_id: 'seed-yt-041', channel: 'rock', is_classic: true },
  { song_title: 'Back in Black', artist: 'AC/DC', youtube_video_id: 'seed-yt-042', channel: 'rock', is_classic: true },
  { song_title: 'Sweet Child O Mine', artist: "Guns N' Roses", youtube_video_id: 'seed-yt-043', channel: 'rock', is_classic: true },
  { song_title: 'Stairway to Heaven', artist: 'Led Zeppelin', youtube_video_id: 'seed-yt-044', channel: 'rock', is_classic: true },
  { song_title: 'Wonderwall', artist: 'Oasis', youtube_video_id: 'seed-yt-045', channel: 'rock', is_classic: true },
  { song_title: 'Under the Bridge', artist: 'Red Hot Chili Peppers', youtube_video_id: 'seed-yt-046', channel: 'rock', is_classic: true },
  { song_title: 'Creep', artist: 'Radiohead', youtube_video_id: 'seed-yt-047', channel: 'rock', is_classic: true },
  { song_title: 'Yellow', artist: 'Coldplay', youtube_video_id: 'seed-yt-048', channel: 'rock', is_classic: false },
  { song_title: 'Iris', artist: 'Goo Goo Dolls', youtube_video_id: 'seed-yt-049', channel: 'rock', is_classic: false },
  { song_title: 'Basket Case', artist: 'Green Day', youtube_video_id: 'seed-yt-050', channel: 'rock', is_classic: false },
  // R&B / Soul
  { song_title: 'Respect', artist: 'Aretha Franklin', youtube_video_id: 'seed-yt-051', channel: 'rnb', is_classic: true },
  { song_title: 'Superstition', artist: 'Stevie Wonder', youtube_video_id: 'seed-yt-052', channel: 'rnb', is_classic: true },
  { song_title: "Ain't No Sunshine", artist: 'Bill Withers', youtube_video_id: 'seed-yt-053', channel: 'rnb', is_classic: true },
  { song_title: 'No Scrubs', artist: 'TLC', youtube_video_id: 'seed-yt-054', channel: 'rnb', is_classic: true },
  { song_title: 'Crazy in Love', artist: 'Beyonce', youtube_video_id: 'seed-yt-055', channel: 'rnb', is_classic: false },
  { song_title: 'Single Ladies', artist: 'Beyonce', youtube_video_id: 'seed-yt-056', channel: 'rnb', is_classic: false },
  { song_title: 'Halo', artist: 'Beyonce', youtube_video_id: 'seed-yt-057', channel: 'rnb', is_classic: false },
  { song_title: 'Uptown Funk', artist: 'Bruno Mars', youtube_video_id: 'seed-yt-058', channel: 'rnb', is_classic: false },
  { song_title: 'Just the Way You Are', artist: 'Bruno Mars', youtube_video_id: 'seed-yt-059', channel: 'rnb', is_classic: false },
  { song_title: 'Umbrella', artist: 'Rihanna', youtube_video_id: 'seed-yt-060', channel: 'rnb', is_classic: false },
  // Country
  { song_title: 'Friends in Low Places', artist: 'Garth Brooks', youtube_video_id: 'seed-yt-061', channel: 'country', is_classic: true },
  { song_title: 'Jolene', artist: 'Dolly Parton', youtube_video_id: 'seed-yt-062', channel: 'country', is_classic: true },
  { song_title: 'Ring of Fire', artist: 'Johnny Cash', youtube_video_id: 'seed-yt-063', channel: 'country', is_classic: true },
  { song_title: 'Before He Cheats', artist: 'Carrie Underwood', youtube_video_id: 'seed-yt-064', channel: 'country', is_classic: false },
  { song_title: 'Wagon Wheel', artist: 'Darius Rucker', youtube_video_id: 'seed-yt-065', channel: 'country', is_classic: false },
  // 80s / 90s dance
  { song_title: 'Girls Just Want to Have Fun', artist: 'Cyndi Lauper', youtube_video_id: 'seed-yt-066', channel: 'pop', is_classic: true },
  { song_title: 'Like a Prayer', artist: 'Madonna', youtube_video_id: 'seed-yt-067', channel: 'pop', is_classic: true },
  { song_title: "I Wanna Dance with Somebody", artist: 'Whitney Houston', youtube_video_id: 'seed-yt-068', channel: 'pop', is_classic: true },
  { song_title: 'Billie Jean', artist: 'Michael Jackson', youtube_video_id: 'seed-yt-069', channel: 'pop', is_classic: true },
  { song_title: 'Thriller', artist: 'Michael Jackson', youtube_video_id: 'seed-yt-070', channel: 'pop', is_classic: true },
  { song_title: "Livin' La Vida Loca", artist: 'Ricky Martin', youtube_video_id: 'seed-yt-071', channel: 'pop', is_classic: true },
  { song_title: 'Wannabe', artist: 'Spice Girls', youtube_video_id: 'seed-yt-072', channel: 'pop', is_classic: true },
  { song_title: 'Everybody (Backstreets Back)', artist: 'Backstreet Boys', youtube_video_id: 'seed-yt-073', channel: 'pop', is_classic: true },
  { song_title: 'MMMBop', artist: 'Hanson', youtube_video_id: 'seed-yt-074', channel: 'pop', is_classic: false },
  { song_title: 'Bye Bye Bye', artist: 'NSYNC', youtube_video_id: 'seed-yt-075', channel: 'pop', is_classic: false },
  // 2000s hits
  { song_title: 'Since U Been Gone', artist: 'Kelly Clarkson', youtube_video_id: 'seed-yt-076', channel: 'pop', is_classic: false },
  { song_title: 'Toxic', artist: 'Britney Spears', youtube_video_id: 'seed-yt-077', channel: 'pop', is_classic: false },
  { song_title: 'Hey Ya!', artist: 'OutKast', youtube_video_id: 'seed-yt-078', channel: 'hiphop', is_classic: false },
  { song_title: 'Crazy', artist: 'Gnarls Barkley', youtube_video_id: 'seed-yt-079', channel: 'pop', is_classic: false },
  { song_title: 'Rehab', artist: 'Amy Winehouse', youtube_video_id: 'seed-yt-080', channel: 'pop', is_classic: false },
  // Ballads
  { song_title: 'My Heart Will Go On', artist: 'Celine Dion', youtube_video_id: 'seed-yt-081', channel: 'pop', is_classic: true },
  { song_title: "I Will Always Love You", artist: 'Whitney Houston', youtube_video_id: 'seed-yt-082', channel: 'pop', is_classic: true },
  { song_title: 'Someone Like You', artist: 'Adele', youtube_video_id: 'seed-yt-083', channel: 'pop', is_classic: false },
  { song_title: 'Rolling in the Deep', artist: 'Adele', youtube_video_id: 'seed-yt-084', channel: 'pop', is_classic: false },
  { song_title: 'All of Me', artist: 'John Legend', youtube_video_id: 'seed-yt-085', channel: 'pop', is_classic: false },
  // Duets / group songs
  { song_title: 'Summer Nights', artist: 'Grease Cast', youtube_video_id: 'seed-yt-086', channel: 'pop', is_classic: true },
  { song_title: "You're the One That I Want", artist: 'Grease Cast', youtube_video_id: 'seed-yt-087', channel: 'pop', is_classic: true },
  { song_title: "Don't Go Breaking My Heart", artist: 'Elton John & Kiki Dee', youtube_video_id: 'seed-yt-088', channel: 'pop', is_classic: true },
  { song_title: 'Shallow', artist: 'Lady Gaga & Bradley Cooper', youtube_video_id: 'seed-yt-089', channel: 'pop', is_classic: false },
  { song_title: 'A Whole New World', artist: 'Aladdin Soundtrack', youtube_video_id: 'seed-yt-090', channel: 'pop', is_classic: true },
  // Party anthems
  { song_title: 'Shut Up and Dance', artist: 'WALK THE MOON', youtube_video_id: 'seed-yt-091', channel: 'pop', is_classic: false },
  { song_title: 'Shake It Off', artist: 'Taylor Swift', youtube_video_id: 'seed-yt-092', channel: 'pop', is_classic: false },
  { song_title: 'Happy', artist: 'Pharrell Williams', youtube_video_id: 'seed-yt-093', channel: 'pop', is_classic: false },
  { song_title: 'Party in the U.S.A.', artist: 'Miley Cyrus', youtube_video_id: 'seed-yt-094', channel: 'pop', is_classic: false },
  { song_title: 'Celebration', artist: 'Kool & The Gang', youtube_video_id: 'seed-yt-095', channel: 'pop', is_classic: true },
  { song_title: 'September', artist: 'Earth, Wind & Fire', youtube_video_id: 'seed-yt-096', channel: 'pop', is_classic: true },
  { song_title: "I Gotta Feeling", artist: 'Black Eyed Peas', youtube_video_id: 'seed-yt-097', channel: 'pop', is_classic: false },
  { song_title: 'Poker Face', artist: 'Lady Gaga', youtube_video_id: 'seed-yt-098', channel: 'pop', is_classic: false },
  { song_title: 'Bad Romance', artist: 'Lady Gaga', youtube_video_id: 'seed-yt-099', channel: 'pop', is_classic: false },
  { song_title: 'Firework', artist: 'Katy Perry', youtube_video_id: 'seed-yt-100', channel: 'pop', is_classic: false },
];

// ---------------------------------------------------------------------------
// Historical sessions
// ---------------------------------------------------------------------------
const SESSIONS = [
  {
    id: SESSION_IDS.vibe,
    host_user_id: USER_IDS.host,
    party_code: 'VIBE',
    status: 'ended' as const,
    vibe: 'general',
    venue_name: 'The Living Room',
    created_at: new Date('2026-03-01T20:00:00Z'),
    ended_at: new Date('2026-03-01T23:30:00Z'),
    participants: [
      { user_id: USER_IDS.host, participation_score: 850, top_award: 'Party Starter' },
      { user_id: USER_IDS.guest1, participation_score: 920, top_award: 'Crowd Favorite' },
      { user_id: USER_IDS.guest2, participation_score: 780, top_award: null },
      { user_id: USER_IDS.guest3, participation_score: 650, top_award: null },
    ],
  },
  {
    id: SESSION_IDS.kpop,
    host_user_id: USER_IDS.guest1,
    party_code: 'KPOP',
    status: 'ended' as const,
    vibe: 'kpop',
    venue_name: 'Noraebang Room 7',
    created_at: new Date('2026-03-10T19:00:00Z'),
    ended_at: new Date('2026-03-10T22:00:00Z'),
    participants: [
      { user_id: USER_IDS.guest1, participation_score: 990, top_award: 'K-Pop Queen' },
      { user_id: USER_IDS.host, participation_score: 720, top_award: null },
      { user_id: USER_IDS.guest3, participation_score: 880, top_award: 'Dance Machine' },
      { user_id: USER_IDS.guest4, participation_score: 810, top_award: 'Hype Master' },
      { user_id: USER_IDS.guest2, participation_score: 750, top_award: null },
    ],
  },
  {
    id: SESSION_IDS.rock,
    host_user_id: USER_IDS.guest2,
    party_code: 'ROCK',
    status: 'ended' as const,
    vibe: 'hiphop',
    venue_name: 'Basement Studio',
    created_at: new Date('2026-03-18T21:00:00Z'),
    ended_at: new Date('2026-03-19T01:00:00Z'),
    participants: [
      { user_id: USER_IDS.guest2, participation_score: 950, top_award: 'Mic Drop' },
      { user_id: USER_IDS.host, participation_score: 870, top_award: 'Beat Master' },
      { user_id: USER_IDS.guest4, participation_score: 830, top_award: null },
    ],
  },
];

// ---------------------------------------------------------------------------
// Clean helper
// ---------------------------------------------------------------------------
async function cleanSeedData(): Promise<void> {
  console.log('Cleaning existing seed data...');

  const allSessionIds = Object.values(SESSION_IDS);
  const allUserIds = Object.values(USER_IDS);

  // Delete in FK order
  await db.deleteFrom('media_captures').where('session_id', 'in', allSessionIds).execute();
  await db.deleteFrom('session_participants').where('session_id', 'in', allSessionIds).execute();
  await db.deleteFrom('sessions').where('id', 'in', allSessionIds).execute();
  await db.deleteFrom('users').where('id', 'in', allUserIds).execute();

  // Delete seed catalog tracks by their deterministic youtube IDs
  const ytIds = CATALOG_TRACKS.map((t) => t.youtube_video_id);
  await db.deleteFrom('karaoke_catalog').where('youtube_video_id', 'in', ytIds).execute();

  console.log('  Cleaned users, sessions, participants, and catalog tracks.\n');
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------
async function seedUsers(): Promise<number> {
  let created = 0;
  for (const user of TEST_USERS) {
    const result = await db
      .insertInto('users')
      .values({
        id: user.id,
        firebase_uid: user.firebase_uid,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        created_at: new Date(),
      })
      .onConflict((oc) => oc.column('id').doNothing())
      .executeTakeFirst();

    if (result.numInsertedOrUpdatedRows && result.numInsertedOrUpdatedRows > 0n) {
      created++;
    }
  }
  return created;
}

async function seedCatalog(): Promise<number> {
  let created = 0;
  const now = new Date();
  for (const track of CATALOG_TRACKS) {
    const result = await db
      .insertInto('karaoke_catalog')
      .values({
        id: crypto.randomUUID(),
        song_title: track.song_title,
        artist: track.artist,
        youtube_video_id: track.youtube_video_id,
        channel: track.channel,
        is_classic: track.is_classic,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) => oc.column('youtube_video_id').doNothing())
      .executeTakeFirst();

    if (result.numInsertedOrUpdatedRows && result.numInsertedOrUpdatedRows > 0n) {
      created++;
    }
  }
  return created;
}

async function seedSessions(): Promise<{ sessions: number; participants: number }> {
  let sessionsCreated = 0;
  let participantsCreated = 0;

  for (const session of SESSIONS) {
    const sessionResult = await db
      .insertInto('sessions')
      .values({
        id: session.id,
        host_user_id: session.host_user_id,
        party_code: session.party_code,
        status: session.status,
        dj_state: null,
        event_stream: null,
        summary: null,
        vibe: session.vibe,
        venue_name: session.venue_name,
        created_at: session.created_at,
        ended_at: session.ended_at,
      })
      .onConflict((oc) => oc.column('id').doNothing())
      .executeTakeFirst();

    if (sessionResult.numInsertedOrUpdatedRows && sessionResult.numInsertedOrUpdatedRows > 0n) {
      sessionsCreated++;
    }

    // Seed participants for this session
    for (const participant of session.participants) {
      // Use a deterministic ID based on session + user to enable idempotent re-runs
      const participantId = deterministicUuid(session.id, participant.user_id);

      const pResult = await db
        .insertInto('session_participants')
        .values({
          id: participantId,
          session_id: session.id,
          user_id: participant.user_id,
          guest_name: null,
          participation_score: participant.participation_score,
          top_award: participant.top_award,
          feedback_score: Math.floor(Math.random() * 3) + 3, // 3-5
          joined_at: session.created_at,
        })
        .onConflict((oc) => oc.column('id').doNothing())
        .executeTakeFirst();

      if (pResult.numInsertedOrUpdatedRows && pResult.numInsertedOrUpdatedRows > 0n) {
        participantsCreated++;
      }
    }
  }

  return { sessions: sessionsCreated, participants: participantsCreated };
}

/**
 * Produce a deterministic UUID v4-like string from two UUID inputs.
 * This ensures participant IDs are stable across runs.
 */
function deterministicUuid(a: string, b: string): string {
  // Simple hash: XOR the hex digits of the two UUIDs
  const aHex = a.replace(/-/g, '');
  const bHex = b.replace(/-/g, '');
  let result = '';
  for (let i = 0; i < 32; i++) {
    const xor = (parseInt(aHex[i]!, 16) ^ parseInt(bHex[i]!, 16)).toString(16);
    result += xor;
  }
  // Format as UUID and set version/variant bits
  const uuid = [
    result.slice(0, 8),
    result.slice(8, 12),
    '4' + result.slice(13, 16), // version 4
    ((parseInt(result[16]!, 16) & 0x3) | 0x8).toString(16) + result.slice(17, 20), // variant
    result.slice(20, 32),
  ].join('-');
  return uuid;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('=== Karamania Dev Seed Script ===\n');

  if (shouldClean) {
    await cleanSeedData();
  }

  // 1. Users
  const usersCreated = await seedUsers();
  console.log(`Users:        ${usersCreated} created (${TEST_USERS.length} total)`);

  // 2. Catalog
  const catalogCreated = await seedCatalog();
  console.log(`Catalog:      ${catalogCreated} created (${CATALOG_TRACKS.length} total)`);

  // 3. Sessions + participants
  const { sessions, participants } = await seedSessions();
  console.log(`Sessions:     ${sessions} created (${SESSIONS.length} total)`);
  console.log(`Participants: ${participants} created`);

  // Summary
  console.log('\n--- Party codes ---');
  for (const s of SESSIONS) {
    console.log(`  ${s.party_code}  ->  ${s.vibe} @ ${s.venue_name} (${s.status})`);
  }

  console.log('\n--- Test users ---');
  for (const u of TEST_USERS) {
    console.log(`  ${u.display_name.padEnd(14)} firebase_uid=${u.firebase_uid}`);
  }

  console.log('\nDone.');
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
