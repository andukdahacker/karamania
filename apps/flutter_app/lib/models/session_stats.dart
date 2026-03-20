class SessionStats {
  const SessionStats({
    required this.songCount,
    required this.participantCount,
    required this.sessionDurationMs,
    required this.totalReactions,
    required this.totalSoundboardPlays,
    required this.totalCardsDealt,
    this.topReactor,
    required this.longestStreak,
  });

  final int songCount;
  final int participantCount;
  final int sessionDurationMs;
  final int totalReactions;
  final int totalSoundboardPlays;
  final int totalCardsDealt;
  final TopReactor? topReactor;
  final int longestStreak;

  factory SessionStats.fromJson(Map<String, dynamic> json) {
    final topReactorJson = json['topReactor'] as Map<String, dynamic>?;
    return SessionStats(
      songCount: (json['songCount'] as int?) ?? 0,
      participantCount: (json['participantCount'] as int?) ?? 0,
      sessionDurationMs: (json['sessionDurationMs'] as int?) ?? 0,
      totalReactions: (json['totalReactions'] as int?) ?? 0,
      totalSoundboardPlays: (json['totalSoundboardPlays'] as int?) ?? 0,
      totalCardsDealt: (json['totalCardsDealt'] as int?) ?? 0,
      topReactor: topReactorJson != null
          ? TopReactor.fromJson(topReactorJson)
          : null,
      longestStreak: (json['longestStreak'] as int?) ?? 0,
    );
  }
}

class TopReactor {
  const TopReactor({
    required this.displayName,
    required this.count,
  });

  final String displayName;
  final int count;

  factory TopReactor.fromJson(Map<String, dynamic> json) {
    return TopReactor(
      displayName: (json['displayName'] as String?) ?? '',
      count: (json['count'] as int?) ?? 0,
    );
  }
}
