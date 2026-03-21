import 'package:flutter/foundation.dart';
import 'package:karamania/state/loading_state.dart';

class SessionTimelineItem {
  const SessionTimelineItem({
    required this.id,
    required this.venueName,
    required this.endedAt,
    required this.participantCount,
    required this.topAward,
    required this.thumbnailUrl,
  });

  final String id;
  final String? venueName;
  final String? endedAt;
  final int participantCount;
  final String? topAward;
  final String? thumbnailUrl;
}

/// Reactive state container for session timeline.
/// No business logic — ApiService calls mutate state via onSessionsLoaded.
class TimelineProvider extends ChangeNotifier {
  List<SessionTimelineItem> _sessions = [];
  LoadingState _timelineState = LoadingState.idle;
  LoadingState _loadMoreState = LoadingState.idle;
  bool _hasMore = true;
  int _total = 0;
  int _offset = 0;

  List<SessionTimelineItem> get sessions => _sessions;
  LoadingState get timelineState => _timelineState;
  LoadingState get loadMoreState => _loadMoreState;
  bool get hasMore => _hasMore;
  int get total => _total;

  set timelineState(LoadingState value) {
    _timelineState = value;
    notifyListeners();
  }

  set loadMoreState(LoadingState value) {
    _loadMoreState = value;
    notifyListeners();
  }

  /// Called after initial fetch succeeds.
  void onSessionsLoaded(List<SessionTimelineItem> sessions, int total) {
    _sessions = sessions;
    _total = total;
    _offset = sessions.length;
    _hasMore = sessions.length < total;
    _timelineState = LoadingState.success;
    notifyListeners();
  }

  /// Called after paginated fetch succeeds.
  void onMoreSessionsLoaded(List<SessionTimelineItem> moreSessions, int total) {
    _sessions = [..._sessions, ...moreSessions];
    _total = total;
    _offset = _sessions.length;
    _hasMore = _sessions.length < total;
    _loadMoreState = LoadingState.success;
    notifyListeners();
  }

  void onLoadError() {
    _timelineState = LoadingState.error;
    notifyListeners();
  }

  void onLoadMoreError() {
    _loadMoreState = LoadingState.error;
    notifyListeners();
  }

  /// Reset state (e.g. on sign-out).
  void reset() {
    _sessions = [];
    _timelineState = LoadingState.idle;
    _loadMoreState = LoadingState.idle;
    _hasMore = true;
    _total = 0;
    _offset = 0;
    notifyListeners();
  }

  int get currentOffset => _offset;
}
