import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './types.js';
import { config } from '../config.js';

const dialect = new PostgresDialect({
  pool: new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
  }),
});

export const db = new Kysely<Database>({ dialect });
