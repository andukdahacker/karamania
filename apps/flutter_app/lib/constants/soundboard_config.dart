/// Soundboard button definitions — soundId matches SoundCue.name for AudioEngine lookup.
class SoundboardButton {
  const SoundboardButton({required this.soundId, required this.emoji, required this.label});
  final String soundId;
  final String emoji;
  final String label;
}

const List<SoundboardButton> soundboardButtons = [
  SoundboardButton(soundId: 'sbAirHorn', emoji: '📯', label: 'Air Horn'),
  SoundboardButton(soundId: 'sbCrowdCheer', emoji: '🎉', label: 'Cheer'),
  SoundboardButton(soundId: 'sbDrumRoll', emoji: '🥁', label: 'Drum Roll'),
  SoundboardButton(soundId: 'sbRecordScratch', emoji: '💿', label: 'Scratch'),
  SoundboardButton(soundId: 'sbRimshot', emoji: '🪘', label: 'Rimshot'),
  SoundboardButton(soundId: 'sbWolfWhistle', emoji: '🐺', label: 'Whistle'),
];
