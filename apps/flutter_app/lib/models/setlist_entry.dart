class SetlistEntry {
  const SetlistEntry({
    required this.position,
    required this.title,
    required this.artist,
    this.performerName,
    this.awardTitle,
    this.awardTone,
  });

  final int position;
  final String title;
  final String artist;
  final String? performerName;
  final String? awardTitle;
  final String? awardTone;

  factory SetlistEntry.fromJson(Map<String, dynamic> json) {
    return SetlistEntry(
      position: (json['position'] as int?) ?? 0,
      title: (json['title'] as String?) ?? '',
      artist: (json['artist'] as String?) ?? '',
      performerName: json['performerName'] as String?,
      awardTitle: json['awardTitle'] as String?,
      awardTone: json['awardTone'] as String?,
    );
  }
}
