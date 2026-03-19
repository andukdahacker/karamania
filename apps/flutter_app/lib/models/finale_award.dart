class FinaleAward {
  const FinaleAward({
    required this.userId,
    required this.displayName,
    required this.category,
    required this.title,
    required this.tone,
    required this.reason,
  });

  final String userId;
  final String displayName;
  final String category;
  final String title;
  final String tone;
  final String reason;

  factory FinaleAward.fromJson(Map<String, dynamic> json) {
    return FinaleAward(
      userId: json['userId'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      category: json['category'] as String? ?? 'everyone',
      title: json['title'] as String? ?? '',
      tone: json['tone'] as String? ?? 'hype',
      reason: json['reason'] as String? ?? '',
    );
  }
}
