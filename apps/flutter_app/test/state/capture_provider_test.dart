import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/state/capture_provider.dart';

void main() {
  group('CaptureProvider', () {
    late CaptureProvider provider;

    setUp(() {
      provider = CaptureProvider();
    });

    tearDown(() {
      provider.dispose();
    });

    test('initial state: bubble not visible, no trigger type', () {
      expect(provider.isBubbleVisible, isFalse);
      expect(provider.currentTriggerType, isNull);
    });

    test('onCaptureBubbleTriggered sets isBubbleVisible and currentTriggerType', () {
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');
      expect(provider.isBubbleVisible, isTrue);
      expect(provider.currentTriggerType, 'session_start');
    });

    test('onCaptureBubbleTriggered notifies listeners', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onCaptureBubbleTriggered(triggerType: 'session_start');
      expect(notifyCount, 1);
    });

    test('onCaptureBubbleTriggered ignored when already showing bubble', () {
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onCaptureBubbleTriggered(triggerType: 'post_ceremony');
      expect(notifyCount, 0);
      expect(provider.currentTriggerType, 'session_start');
    });

    test('onCaptureBubbleTriggered ignored within 60s cooldown', () {
      // Trigger and dismiss — cooldown starts
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');
      provider.dismissBubble();

      // Try again immediately — should be blocked by cooldown
      provider.onCaptureBubbleTriggered(triggerType: 'post_ceremony');
      expect(provider.isBubbleVisible, isFalse);
    });

    test('onCaptureBubbleTriggered allowed after clearState resets cooldown', () {
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');
      provider.clearState(); // clearState resets cooldown

      provider.onCaptureBubbleTriggered(triggerType: 'post_ceremony');
      expect(provider.isBubbleVisible, isTrue);
      expect(provider.currentTriggerType, 'post_ceremony');
    });

    test('dismissBubble sets isBubbleVisible false and clears triggerType', () {
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');
      provider.dismissBubble();
      expect(provider.isBubbleVisible, isFalse);
      expect(provider.currentTriggerType, isNull);
    });

    test('dismissBubble notifies listeners', () {
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.dismissBubble();
      expect(notifyCount, 1);
    });

    test('auto-dismiss fires after 15 seconds', () {
      fakeAsync((async) {
        final p = CaptureProvider();
        p.onCaptureBubbleTriggered(triggerType: 'session_start');
        expect(p.isBubbleVisible, isTrue);

        async.elapse(const Duration(seconds: 15));
        expect(p.isBubbleVisible, isFalse);

        p.dispose();
      });
    });

    test('onBubbleTapped hides bubble and clears triggerType', () {
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');
      provider.onBubbleTapped();
      expect(provider.isBubbleVisible, isFalse);
      expect(provider.currentTriggerType, isNull);
    });

    test('onBubbleTapped notifies listeners', () {
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onBubbleTapped();
      expect(notifyCount, 1);
    });

    test('clearState resets all fields including cooldown', () {
      fakeAsync((async) {
        final p = CaptureProvider();
        p.onCaptureBubbleTriggered(triggerType: 'session_start');
        p.clearState();

        expect(p.isBubbleVisible, isFalse);
        expect(p.currentTriggerType, isNull);

        // Cooldown should be reset — can show bubble immediately
        p.onCaptureBubbleTriggered(triggerType: 'post_ceremony');
        expect(p.isBubbleVisible, isTrue);

        p.dispose();
      });
    });

    test('clearState notifies listeners', () {
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.clearState();
      expect(notifyCount, 1);
    });
  });
}
