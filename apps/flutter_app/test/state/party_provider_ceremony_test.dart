import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('PartyProvider ceremony state', () {
    late PartyProvider provider;

    setUp(() {
      provider = PartyProvider(wakelockToggle: (_) {});
    });

    test('onCeremonyAnticipation sets ceremony fields and notifies listeners', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onCeremonyAnticipation(
        performerName: 'Alice',
        revealAt: 1234567890,
      );

      expect(provider.ceremonyPerformerName, 'Alice');
      expect(provider.ceremonyRevealAt, 1234567890);
      expect(provider.ceremonyAward, isNull);
      expect(provider.ceremonyTone, isNull);
      expect(notifyCount, 1);
    });

    test('onCeremonyAnticipation clears previous award and tone', () {
      provider.onCeremonyReveal(
        award: 'Old Award',
        performerName: 'Bob',
        tone: 'hype',
      );

      provider.onCeremonyAnticipation(
        performerName: 'Alice',
        revealAt: 9999999,
      );

      expect(provider.ceremonyAward, isNull);
      expect(provider.ceremonyTone, isNull);
    });

    test('onCeremonyReveal sets award and tone, notifies listeners', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onCeremonyReveal(
        award: 'Mic Drop Master',
        performerName: 'Bob',
        tone: 'hype',
      );

      expect(provider.ceremonyAward, 'Mic Drop Master');
      expect(provider.ceremonyTone, 'hype');
      expect(provider.ceremonyPerformerName, 'Bob');
      expect(notifyCount, 1);
    });

    test('onCeremonyReveal does not overwrite performerName if null', () {
      provider.onCeremonyAnticipation(
        performerName: 'Alice',
        revealAt: 1234567890,
      );

      provider.onCeremonyReveal(
        award: 'Star of the Show',
        performerName: null,
        tone: 'comedic',
      );

      expect(provider.ceremonyPerformerName, 'Alice');
    });

    test('ceremony state cleared when DJ state changes away from ceremony', () {
      // Enter ceremony
      provider.onDjStateUpdate(state: DJState.ceremony, ceremonyType: 'full');
      provider.onCeremonyAnticipation(
        performerName: 'Alice',
        revealAt: 1234567890,
      );
      provider.onCeremonyReveal(
        award: 'Star',
        performerName: 'Alice',
        tone: 'hype',
      );

      // Transition away from ceremony
      provider.onDjStateUpdate(state: DJState.interlude);

      expect(provider.ceremonyPerformerName, isNull);
      expect(provider.ceremonyRevealAt, isNull);
      expect(provider.ceremonyAward, isNull);
      expect(provider.ceremonyTone, isNull);
    });

    test('ceremony state NOT cleared when staying in ceremony', () {
      provider.onDjStateUpdate(state: DJState.ceremony, ceremonyType: 'full');
      provider.onCeremonyAnticipation(
        performerName: 'Alice',
        revealAt: 1234567890,
      );

      // Another update while still in ceremony
      provider.onDjStateUpdate(state: DJState.ceremony, ceremonyType: 'full');

      expect(provider.ceremonyPerformerName, 'Alice');
      expect(provider.ceremonyRevealAt, 1234567890);
    });

    test('ceremony state cleared on session ended', () {
      provider.onCeremonyAnticipation(
        performerName: 'Alice',
        revealAt: 1234567890,
      );

      provider.onSessionEnded();

      expect(provider.ceremonyPerformerName, isNull);
      expect(provider.ceremonyRevealAt, isNull);
      expect(provider.ceremonyAward, isNull);
      expect(provider.ceremonyTone, isNull);
    });

    test('ceremony state cleared on kicked', () {
      provider.onCeremonyAnticipation(
        performerName: 'Alice',
        revealAt: 1234567890,
      );

      provider.onKicked();

      expect(provider.ceremonyPerformerName, isNull);
      expect(provider.ceremonyRevealAt, isNull);
    });

    test('ceremony state cleared on session end', () {
      provider.onCeremonyAnticipation(
        performerName: 'Alice',
        revealAt: 1234567890,
      );

      provider.onSessionEnd();

      expect(provider.ceremonyPerformerName, isNull);
      expect(provider.ceremonyRevealAt, isNull);
    });
  });
}
