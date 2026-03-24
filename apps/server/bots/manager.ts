#!/usr/bin/env node
// Bot Manager CLI — spawns N bot participants for local dev/testing
//
// Usage:
//   npx tsx bots/manager.ts --bots 5 --party ABCD
//   npx tsx bots/manager.ts --bots 5 --party AUTO
//   npx tsx bots/manager.ts --bots 3 --party AUTO --behavior chaos --server http://localhost:3000

import { io as socketIOClient, type Socket } from 'socket.io-client';
import { attachBehavior, scheduleChaosDisconnects, type BehaviorType, type BotHandle } from './bot-behaviors.js';

// ── Arg parsing (no external deps) ──

interface CliArgs {
  bots: number;
  party: string;
  behavior: BehaviorType;
  server: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--') && i + 1 < args.length) {
      opts[arg.slice(2)] = args[i + 1]!;
      i++;
    }
  }

  const bots = parseInt(opts['bots'] ?? '3', 10);
  const party = opts['party'] ?? '';
  const behavior = (opts['behavior'] ?? 'active') as BehaviorType;
  const server = opts['server'] ?? 'http://localhost:3000';

  if (!party) {
    console.error('Usage: npx tsx bots/manager.ts --bots N --party CODE|AUTO [--behavior passive|active|chaos|spectator] [--server URL]');
    process.exit(1);
  }

  if (!['passive', 'active', 'chaos', 'spectator'].includes(behavior)) {
    console.error(`Invalid behavior "${behavior}". Must be: passive, active, chaos, spectator`);
    process.exit(1);
  }

  if (isNaN(bots) || bots < 1) {
    console.error('--bots must be a positive integer');
    process.exit(1);
  }

  return { bots, party, behavior, server };
}

// ── Helpers ──

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

function log(msg: string): void {
  console.log(`[${ts()}] [manager] ${msg}`);
}

const BOT_NAMES = [
  'DJ_Roomba', 'KaraoKing', 'MicDrop', 'TuneTiger', 'BeatBot',
  'VocalViper', 'SingStar', 'RhythmRex', 'GrooveGuru', 'PitchPerfect',
  'MelodyMaker', 'HarmonyHero', 'BassBoost', 'ChorusChamp', 'EchoElf',
  'SonicSam', 'WaveWalker', 'NoteNinja', 'TempoTitan', 'LyricLion',
];

// ── Guest auth (standalone, no test-helper imports) ──

interface GuestAuthResult {
  token: string;
  guestId: string;
  sessionId: string;
}

async function createGuestAuth(
  serverUrl: string,
  partyCode: string,
  displayName: string,
): Promise<GuestAuthResult> {
  const response = await fetch(`${serverUrl}/api/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partyCode, displayName }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Guest auth failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as {
    data: { token: string; guestId: string; sessionId: string };
  };

  // Create user row so session_participants FK constraint is satisfied
  // (POST /api/auth/guest returns a guestId but doesn't create a users row)
  try {
    const { db } = await import('../src/db/connection.js');
    await db
      .insertInto('users')
      .values({
        id: json.data.guestId,
        firebase_uid: null,
        display_name: displayName,
        avatar_url: null,
        created_at: new Date(),
      })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();
  } catch {
    // Non-fatal: server may handle user creation differently
  }

  return json.data;
}

// ── Socket connect (standalone, mirrors tests/helpers/bot-client.ts pattern) ──

interface ConnectedBot {
  socket: Socket;
  name: string;
  behaviorHandle: BotHandle;
  chaosHandle?: BotHandle;
}

async function connectBot(
  serverUrl: string,
  token: string,
  sessionId: string,
  displayName: string,
): Promise<Socket> {
  const socket = socketIOClient(serverUrl, {
    auth: { token, sessionId, displayName },
    transports: ['websocket'],
    forceNew: true,
  });

  // Wait for connection + join confirmation (party:participants)
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Bot "${displayName}" connection timed out (10s)`));
    }, 10_000);

    socket.on('connect_error', (err: Error) => {
      clearTimeout(timeout);
      reject(new Error(`Bot "${displayName}" connect error: ${err.message}`));
    });

    socket.on('party:participants', () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  return socket;
}

// ── Auto-detect party code ──

async function findActivePartyCode(): Promise<string> {
  // Try querying the DB directly (works when running on same machine as server)
  try {
    // Dynamic import so we don't fail at parse time if DB isn't available
    const { db } = await import('../src/db/connection.js');
    const session = await db
      .selectFrom('sessions')
      .select(['party_code', 'status'])
      .where('status', '!=', 'ended')
      .orderBy('created_at', 'desc')
      .executeTakeFirst();

    if (session?.party_code) {
      log(`AUTO: found party ${session.party_code} (status: ${session.status})`);
      return session.party_code;
    }
  } catch (err) {
    log(`AUTO: DB query failed (${(err as Error).message}), trying REST fallback...`);
  }

  // Fallback: try a health/status endpoint or just fail
  throw new Error(
    'AUTO: no active party found. Start a party first, or specify --party CODE.',
  );
}

// ── Main ──

async function main(): Promise<void> {
  const args = parseArgs();

  log(`Starting ${args.bots} bot(s) | behavior=${args.behavior} | server=${args.server}`);

  // Resolve party code
  let partyCode = args.party;
  if (partyCode.toUpperCase() === 'AUTO') {
    partyCode = await findActivePartyCode();
  }
  log(`Party code: ${partyCode}`);

  // Spawn bots
  const bots: ConnectedBot[] = [];

  for (let i = 0; i < args.bots; i++) {
    const name = BOT_NAMES[i % BOT_NAMES.length]!;
    const displayName = args.bots > BOT_NAMES.length ? `${name}_${i}` : name;

    try {
      log(`Spawning bot ${i + 1}/${args.bots}: ${displayName}`);

      const auth = await createGuestAuth(args.server, partyCode, displayName);
      const socket = await connectBot(args.server, auth.token, auth.sessionId, displayName);

      log(`Bot "${displayName}" connected (guestId=${auth.guestId})`);

      const behaviorHandle = attachBehavior(socket, displayName, args.behavior);
      let chaosHandle: BotHandle | undefined;

      if (args.behavior === 'chaos') {
        chaosHandle = scheduleChaosDisconnects(socket, displayName);
      }

      bots.push({ socket, name: displayName, behaviorHandle, chaosHandle });
    } catch (err) {
      log(`Failed to spawn bot "${displayName}": ${(err as Error).message}`);
    }

    // Small stagger between bot spawns to avoid hammering the server
    if (i < args.bots - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  if (bots.length === 0) {
    log('No bots connected. Exiting.');
    process.exit(1);
  }

  log(`${bots.length}/${args.bots} bot(s) connected. Press Ctrl+C to shut down.`);

  // ── Graceful shutdown ──
  let shuttingDown = false;

  async function shutdown(): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    log('Shutting down...');
    for (const bot of bots) {
      bot.behaviorHandle.stop();
      bot.chaosHandle?.stop();
      bot.socket.removeAllListeners();
      bot.socket.disconnect();
      log(`Disconnected ${bot.name}`);
    }
    log('All bots disconnected. Goodbye.');

    // Give sockets a moment to close cleanly
    setTimeout(() => process.exit(0), 500);
  }

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error(`Fatal: ${(err as Error).message}`);
  process.exit(1);
});
