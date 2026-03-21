import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/timeline_provider.dart';

SessionTimelineItem _createItem({String id = 'session-1'}) {
  return SessionTimelineItem(
    id: id,
    venueName: 'Studio A',
    endedAt: '2026-03-10T20:00:00Z',
    participantCount: 5,
    topAward: 'Star of the Show',
    thumbnailUrl: 'https://example.com/thumb.jpg',
  );
}

void main() {
  group('TimelineProvider', () {
    late TimelineProvider provider;

    setUp(() {
      provider = TimelineProvider();
    });

    test('initial state is idle with empty sessions', () {
      expect(provider.timelineState, LoadingState.idle);
      expect(provider.loadMoreState, LoadingState.idle);
      expect(provider.sessions, isEmpty);
      expect(provider.hasMore, isTrue);
      expect(provider.total, 0);
    });

    test('onSessionsLoaded populates sessions and sets success state', () {
      final items = [_createItem(id: 's1'), _createItem(id: 's2')];
      provider.onSessionsLoaded(items, 5);

      expect(provider.sessions, hasLength(2));
      expect(provider.total, 5);
      expect(provider.timelineState, LoadingState.success);
      expect(provider.hasMore, isTrue);
      expect(provider.currentOffset, 2);
    });

    test('onSessionsLoaded sets hasMore false when all loaded', () {
      final items = [_createItem(id: 's1'), _createItem(id: 's2')];
      provider.onSessionsLoaded(items, 2);

      expect(provider.hasMore, isFalse);
    });

    test('onMoreSessionsLoaded appends to existing sessions', () {
      provider.onSessionsLoaded([_createItem(id: 's1')], 3);
      provider.onMoreSessionsLoaded([_createItem(id: 's2'), _createItem(id: 's3')], 3);

      expect(provider.sessions, hasLength(3));
      expect(provider.hasMore, isFalse);
      expect(provider.loadMoreState, LoadingState.success);
      expect(provider.currentOffset, 3);
    });

    test('onLoadError sets error state', () {
      provider.onLoadError();
      expect(provider.timelineState, LoadingState.error);
    });

    test('onLoadMoreError sets loadMore error state', () {
      provider.onLoadMoreError();
      expect(provider.loadMoreState, LoadingState.error);
    });

    test('reset clears all state', () {
      provider.onSessionsLoaded([_createItem()], 1);
      provider.reset();

      expect(provider.sessions, isEmpty);
      expect(provider.timelineState, LoadingState.idle);
      expect(provider.loadMoreState, LoadingState.idle);
      expect(provider.hasMore, isTrue);
      expect(provider.total, 0);
    });

    test('timelineState setter notifies listeners', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.timelineState = LoadingState.loading;
      expect(notifyCount, 1);
      expect(provider.timelineState, LoadingState.loading);
    });

    test('loadMoreState setter notifies listeners', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.loadMoreState = LoadingState.loading;
      expect(notifyCount, 1);
      expect(provider.loadMoreState, LoadingState.loading);
    });
  });
}
