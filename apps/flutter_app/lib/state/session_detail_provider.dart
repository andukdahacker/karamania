import 'package:flutter/foundation.dart';
import 'package:karamania/state/loading_state.dart';

class SessionDetailStats {
  const SessionDetailStats({
    required this.songCount,
    required this.participantCount,
    required this.sessionDurationMs,
    required this.totalReactions,
    required this.totalSoundboardPlays,
    required this.totalCardsDealt,
  });

  final int songCount;
  final int participantCount;
  final int sessionDurationMs;
  final int totalReactions;
  final int totalSoundboardPlays;
  final int totalCardsDealt;

  factory SessionDetailStats.fromJson(Map<String, dynamic> json) {
    return SessionDetailStats(
      songCount: json['songCount'] as int,
      participantCount: json['participantCount'] as int,
      sessionDurationMs: json['sessionDurationMs'] as int,
      totalReactions: json['totalReactions'] as int,
      totalSoundboardPlays: json['totalSoundboardPlays'] as int,
      totalCardsDealt: json['totalCardsDealt'] as int,
    );
  }
}

class SessionDetailParticipant {
  const SessionDetailParticipant({
    required this.userId,
    required this.displayName,
    required this.participationScore,
    required this.topAward,
  });

  final String? userId;
  final String displayName;
  final int participationScore;
  final String? topAward;

  factory SessionDetailParticipant.fromJson(Map<String, dynamic> json) {
    return SessionDetailParticipant(
      userId: json['userId'] as String?,
      displayName: json['displayName'] as String,
      participationScore: json['participationScore'] as int,
      topAward: json['topAward'] as String?,
    );
  }
}

class SessionDetailSetlistItem {
  const SessionDetailSetlistItem({
    required this.position,
    required this.title,
    required this.artist,
    required this.performerName,
    required this.awardTitle,
    required this.awardTone,
  });

  final int position;
  final String title;
  final String artist;
  final String? performerName;
  final String? awardTitle;
  final String? awardTone;

  factory SessionDetailSetlistItem.fromJson(Map<String, dynamic> json) {
    return SessionDetailSetlistItem(
      position: json['position'] as int,
      title: json['title'] as String,
      artist: json['artist'] as String,
      performerName: json['performerName'] as String?,
      awardTitle: json['awardTitle'] as String?,
      awardTone: json['awardTone'] as String?,
    );
  }
}

class SessionDetailAward {
  const SessionDetailAward({
    required this.userId,
    required this.displayName,
    required this.category,
    required this.title,
    required this.tone,
    required this.reason,
  });

  final String? userId;
  final String displayName;
  final String category;
  final String title;
  final String tone;
  final String reason;

  factory SessionDetailAward.fromJson(Map<String, dynamic> json) {
    return SessionDetailAward(
      userId: json['userId'] as String?,
      displayName: json['displayName'] as String,
      category: json['category'] as String,
      title: json['title'] as String,
      tone: json['tone'] as String,
      reason: json['reason'] as String,
    );
  }
}

class SessionDetailMedia {
  const SessionDetailMedia({
    required this.id,
    required this.url,
    required this.triggerType,
    required this.createdAt,
  });

  final String id;
  final String? url;
  final String triggerType;
  final String createdAt;

  factory SessionDetailMedia.fromJson(Map<String, dynamic> json) {
    return SessionDetailMedia(
      id: json['id'] as String,
      url: json['url'] as String?,
      triggerType: json['triggerType'] as String,
      createdAt: json['createdAt'] as String,
    );
  }
}

class SessionDetail {
  const SessionDetail({
    required this.id,
    required this.venueName,
    required this.vibe,
    required this.createdAt,
    required this.endedAt,
    required this.stats,
    required this.participants,
    required this.setlist,
    required this.awards,
    required this.media,
  });

  final String id;
  final String? venueName;
  final String? vibe;
  final String createdAt;
  final String? endedAt;
  final SessionDetailStats stats;
  final List<SessionDetailParticipant> participants;
  final List<SessionDetailSetlistItem> setlist;
  final List<SessionDetailAward> awards;
  final List<SessionDetailMedia> media;

  factory SessionDetail.fromJson(Map<String, dynamic> json) {
    return SessionDetail(
      id: json['id'] as String,
      venueName: json['venueName'] as String?,
      vibe: json['vibe'] as String?,
      createdAt: json['createdAt'] as String,
      endedAt: json['endedAt'] as String?,
      stats: SessionDetailStats.fromJson(json['stats'] as Map<String, dynamic>),
      participants: (json['participants'] as List)
          .map((p) => SessionDetailParticipant.fromJson(p as Map<String, dynamic>))
          .toList(),
      setlist: (json['setlist'] as List)
          .map((s) => SessionDetailSetlistItem.fromJson(s as Map<String, dynamic>))
          .toList(),
      awards: (json['awards'] as List)
          .map((a) => SessionDetailAward.fromJson(a as Map<String, dynamic>))
          .toList(),
      media: (json['media'] as List)
          .map((m) => SessionDetailMedia.fromJson(m as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// Reactive state container for session detail.
/// No business logic — ApiService calls mutation methods.
class SessionDetailProvider extends ChangeNotifier {
  LoadingState _detailState = LoadingState.idle;
  SessionDetail? _detail;
  String? _error;

  LoadingState get detailState => _detailState;
  SessionDetail? get detail => _detail;
  String? get error => _error;

  set detailState(LoadingState value) {
    _detailState = value;
    notifyListeners();
  }

  void onDetailLoaded(SessionDetail detail) {
    _detail = detail;
    _error = null;
    _detailState = LoadingState.success;
    notifyListeners();
  }

  void onLoadError(String message) {
    _error = message;
    _detailState = LoadingState.error;
    notifyListeners();
  }

  void reset() {
    _detail = null;
    _error = null;
    _detailState = LoadingState.idle;
    notifyListeners();
  }
}
