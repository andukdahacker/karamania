import { describe, it, expect } from 'vitest';
import { createTestUser } from './user.js';
import { createTestSession } from './session.js';
import { createTestParticipant } from './participant.js';

describe('test factories', () => {
  it('createTestUser returns valid shape with all required fields', () => {
    const user = createTestUser();
    expect(user.id).toBeDefined();
    expect(user.display_name).toBeDefined();
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user).toHaveProperty('firebase_uid');
    expect(user).toHaveProperty('avatar_url');
  });

  it('createTestUser accepts overrides', () => {
    const user = createTestUser({ display_name: 'Custom Name' });
    expect(user.display_name).toBe('Custom Name');
  });

  it('createTestUser generates unique IDs', () => {
    const a = createTestUser();
    const b = createTestUser();
    expect(a.id).not.toBe(b.id);
  });

  it('createTestSession returns valid shape with all required fields', () => {
    const session = createTestSession();
    expect(session.id).toBeDefined();
    expect(session.host_user_id).toBeDefined();
    expect(session.party_code).toBeDefined();
    expect(session.status).toBe('lobby');
    expect(session.created_at).toBeInstanceOf(Date);
    expect(session).toHaveProperty('dj_state');
    expect(session).toHaveProperty('event_stream');
    expect(session).toHaveProperty('vibe');
    expect(session).toHaveProperty('venue_name');
    expect(session).toHaveProperty('ended_at');
  });

  it('createTestSession accepts overrides', () => {
    const session = createTestSession({ party_code: 'ROCK', status: 'active' });
    expect(session.party_code).toBe('ROCK');
    expect(session.status).toBe('active');
  });

  it('createTestParticipant returns valid shape with all required fields', () => {
    const participant = createTestParticipant();
    expect(participant.id).toBeDefined();
    expect(participant.session_id).toBeDefined();
    expect(participant.participation_score).toBe(0);
    expect(participant.joined_at).toBeInstanceOf(Date);
    expect(participant).toHaveProperty('user_id');
    expect(participant).toHaveProperty('guest_name');
    expect(participant).toHaveProperty('top_award');
    expect(participant).toHaveProperty('feedback_score');
  });

  it('createTestParticipant accepts overrides', () => {
    const participant = createTestParticipant({
      guest_name: 'DJ Khaled',
      participation_score: 42,
    });
    expect(participant.guest_name).toBe('DJ Khaled');
    expect(participant.participation_score).toBe(42);
  });
});
