import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { up, down } from '../../migrations/001-initial-schema.js';

const TEST_DB_URL = process.env['DATABASE_URL_TEST'];

const EXPECTED_TABLES = [
  'users',
  'sessions',
  'session_participants',
  'media_captures',
  'karaoke_catalog',
];

describe('001-initial-schema migration', () => {
  it('exports up and down functions', () => {
    expect(typeof up).toBe('function');
    expect(typeof down).toBe('function');
  });

  describe.skipIf(!TEST_DB_URL)('integration (requires DATABASE_URL_TEST)', () => {
    let db: Kysely<unknown>;

    beforeAll(() => {
      db = new Kysely<unknown>({
        dialect: new PostgresDialect({
          pool: new pg.Pool({ connectionString: TEST_DB_URL }),
        }),
      });
    });

    afterAll(async () => {
      try {
        await down(db);
      } catch {
        // Tables may already be dropped
      }
      await db.destroy();
    });

    it('up() creates all 5 MVP tables', async () => {
      // Ensure clean state in case tables already exist from a previous run
      try { await down(db); } catch { /* tables may not exist yet */ }
      await up(db);

      const result = await sql<{ table_name: string }>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `.execute(db);

      const tableNames = result.rows.map((r) => r.table_name);
      for (const table of EXPECTED_TABLES) {
        expect(tableNames).toContain(table);
      }
    });

    it('down() removes all tables', async () => {
      await down(db);

      const result = await sql<{ table_name: string }>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `.execute(db);

      const tableNames = result.rows.map((r) => r.table_name);
      for (const table of EXPECTED_TABLES) {
        expect(tableNames).not.toContain(table);
      }
    });
  });
});
