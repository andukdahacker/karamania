import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/session_detail_provider.dart';

SessionDetail _createTestDetail() {
  return SessionDetail(
    id: 'session-1',
    venueName: 'Studio A',
    vibe: 'general',
    createdAt: '2026-03-10T18:00:00Z',
    endedAt: '2026-03-10T20:00:00Z',
    stats: const SessionDetailStats(
      songCount: 3,
      participantCount: 4,
      sessionDurationMs: 7200000,
      totalReactions: 50,
      totalSoundboardPlays: 10,
      totalCardsDealt: 5,
    ),
    participants: const [
      SessionDetailParticipant(
        userId: 'user-1',
        displayName: 'Alice',
        participationScore: 100,
        topAward: 'Star',
      ),
    ],
    setlist: const [
      SessionDetailSetlistItem(
        position: 1,
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        performerName: 'Alice',
        awardTitle: 'Star',
        awardTone: 'hype',
      ),
    ],
    awards: const [
      SessionDetailAward(
        userId: 'user-1',
        displayName: 'Alice',
        category: 'performer',
        title: 'Star',
        tone: 'hype',
        reason: 'Nailed it',
      ),
    ],
    media: const [
      SessionDetailMedia(
        id: 'media-1',
        url: 'https://example.com/photo.jpg',
        triggerType: 'manual',
        createdAt: '2026-03-10T19:00:00Z',
      ),
    ],
  );
}

void main() {
  group('SessionDetailProvider', () {
    late SessionDetailProvider provider;

    setUp(() {
      provider = SessionDetailProvider();
    });

    test('initial state is idle with null detail', () {
      expect(provider.detailState, LoadingState.idle);
      expect(provider.detail, isNull);
      expect(provider.error, isNull);
    });

    test('onDetailLoaded sets detail and state to success', () {
      final detail = _createTestDetail();
      provider.onDetailLoaded(detail);

      expect(provider.detailState, LoadingState.success);
      expect(provider.detail, detail);
      expect(provider.error, isNull);
    });

    test('onLoadError sets error message and state to error', () {
      provider.onLoadError('Something went wrong');

      expect(provider.detailState, LoadingState.error);
      expect(provider.error, 'Something went wrong');
    });

    test('reset clears all state to idle', () {
      provider.onDetailLoaded(_createTestDetail());
      provider.reset();

      expect(provider.detailState, LoadingState.idle);
      expect(provider.detail, isNull);
      expect(provider.error, isNull);
    });

    test('onDetailLoaded clears previous error', () {
      provider.onLoadError('Previous error');
      provider.onDetailLoaded(_createTestDetail());

      expect(provider.error, isNull);
      expect(provider.detailState, LoadingState.success);
    });

    test('detailState setter notifies listeners', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);
      provider.detailState = LoadingState.loading;

      expect(notifyCount, 1);
      expect(provider.detailState, LoadingState.loading);
    });
  });

  group('SessionDetail.fromJson', () {
    test('parses complete JSON correctly', () {
      final json = {
        'id': 'session-1',
        'venueName': 'Studio A',
        'vibe': 'rock',
        'createdAt': '2026-03-10T18:00:00Z',
        'endedAt': '2026-03-10T20:00:00Z',
        'stats': {
          'songCount': 3,
          'participantCount': 4,
          'sessionDurationMs': 7200000,
          'totalReactions': 50,
          'totalSoundboardPlays': 10,
          'totalCardsDealt': 5,
        },
        'participants': [
          {'userId': 'user-1', 'displayName': 'Alice', 'participationScore': 100, 'topAward': 'Star'},
        ],
        'setlist': [
          {'position': 1, 'title': 'Song', 'artist': 'Artist', 'performerName': null, 'awardTitle': null, 'awardTone': null},
        ],
        'awards': [
          {'userId': 'user-1', 'displayName': 'Alice', 'category': 'performer', 'title': 'Star', 'tone': 'hype', 'reason': 'Great'},
        ],
        'media': [
          {'id': 'media-1', 'url': 'https://example.com/photo.jpg', 'triggerType': 'manual', 'createdAt': '2026-03-10T19:00:00Z'},
        ],
      };

      final detail = SessionDetail.fromJson(json);

      expect(detail.id, 'session-1');
      expect(detail.venueName, 'Studio A');
      expect(detail.stats.songCount, 3);
      expect(detail.participants.length, 1);
      expect(detail.participants[0].displayName, 'Alice');
      expect(detail.setlist.length, 1);
      expect(detail.awards.length, 1);
      expect(detail.media.length, 1);
    });

    test('handles nullable fields', () {
      final json = {
        'id': 'session-2',
        'venueName': null,
        'vibe': null,
        'createdAt': '2026-03-10T18:00:00Z',
        'endedAt': null,
        'stats': {
          'songCount': 0,
          'participantCount': 0,
          'sessionDurationMs': 0,
          'totalReactions': 0,
          'totalSoundboardPlays': 0,
          'totalCardsDealt': 0,
        },
        'participants': <dynamic>[],
        'setlist': <dynamic>[],
        'awards': <dynamic>[],
        'media': <dynamic>[],
      };

      final detail = SessionDetail.fromJson(json);

      expect(detail.venueName, isNull);
      expect(detail.vibe, isNull);
      expect(detail.endedAt, isNull);
      expect(detail.participants, isEmpty);
    });
  });
}
