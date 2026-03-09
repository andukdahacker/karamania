import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Users table
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('firebase_uid', 'text', (col) => col.unique())
    .addColumn('display_name', 'text', (col) => col.notNull())
    .addColumn('avatar_url', 'text')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Sessions table
  await db.schema
    .createTable('sessions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('host_user_id', 'uuid', (col) =>
      col.notNull().references('users.id')
    )
    .addColumn('party_code', 'varchar(6)', (col) => col.notNull())
    .addColumn('status', 'text', (col) =>
      col.notNull().defaultTo('lobby').check(
        sql`status IN ('lobby', 'active', 'paused', 'ended')`
      )
    )
    .addColumn('dj_state', 'jsonb')
    .addColumn('event_stream', 'jsonb')
    .addColumn('vibe', 'text')
    .addColumn('venue_name', 'text')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('ended_at', 'timestamptz')
    .execute();

  // Session participants table
  await db.schema
    .createTable('session_participants')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('session_id', 'uuid', (col) =>
      col.notNull().references('sessions.id')
    )
    .addColumn('user_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('guest_name', 'text')
    .addColumn('participation_score', 'integer', (col) =>
      col.notNull().defaultTo(0)
    )
    .addColumn('top_award', 'text')
    .addColumn('feedback_score', 'smallint', (col) =>
      col.check(sql`feedback_score BETWEEN 1 AND 5`)
    )
    .addColumn('joined_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Unique index for session_participants (expression-based, must be an index not a constraint)
  await sql`CREATE UNIQUE INDEX uq_session_participant ON session_participants (session_id, COALESCE(CAST(user_id AS text), guest_name))`.execute(db);

  // Media captures table
  await db.schema
    .createTable('media_captures')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('session_id', 'uuid', (col) =>
      col.notNull().references('sessions.id')
    )
    .addColumn('user_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('storage_path', 'text', (col) => col.notNull())
    .addColumn('trigger_type', 'text', (col) => col.notNull())
    .addColumn('dj_state_at_capture', 'jsonb')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Karaoke catalog table
  await db.schema
    .createTable('karaoke_catalog')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('song_title', 'text', (col) => col.notNull())
    .addColumn('artist', 'text', (col) => col.notNull())
    .addColumn('youtube_video_id', 'text', (col) => col.notNull().unique())
    .addColumn('channel', 'text')
    .addColumn('is_classic', 'boolean', (col) =>
      col.notNull().defaultTo(false)
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Indexes (Task 3.4)
  await db.schema
    .createIndex('idx_sessions_party_code')
    .on('sessions')
    .column('party_code')
    .execute();

  await db.schema
    .createIndex('idx_users_firebase_uid')
    .on('users')
    .column('firebase_uid')
    .execute();

  await db.schema
    .createIndex('idx_session_participants_session_id')
    .on('session_participants')
    .column('session_id')
    .execute();

  await db.schema
    .createIndex('idx_karaoke_catalog_youtube_video_id')
    .on('karaoke_catalog')
    .column('youtube_video_id')
    .execute();

  // Partial unique index: party codes reusable after session ends (Task 3.5)
  await sql`CREATE UNIQUE INDEX idx_sessions_active_party_code ON sessions(party_code) WHERE status != 'ended'`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('karaoke_catalog').ifExists().execute();
  await db.schema.dropTable('media_captures').ifExists().execute();
  await db.schema.dropTable('session_participants').ifExists().execute();
  await db.schema.dropTable('sessions').ifExists().execute();
  await db.schema.dropTable('users').ifExists().execute();
}
