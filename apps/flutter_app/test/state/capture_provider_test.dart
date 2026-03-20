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

    // Story 6.2 — Capture flow state tests

    test('initial capture flow state: selector not visible, not capturing', () {
      expect(provider.isSelectorVisible, isFalse);
      expect(provider.isCapturing, isFalse);
      expect(provider.activeCaptureType, isNull);
      expect(provider.recordingSecondsRemaining, 0);
      expect(provider.captureTriggerType, 'manual');
    });

    test('onBubbleTapped sets isSelectorVisible true and isBubbleVisible false', () {
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');
      provider.onBubbleTapped();
      expect(provider.isSelectorVisible, isTrue);
      expect(provider.isBubbleVisible, isFalse);
    });

    test('onBubbleTapped preserves triggerType for capture analytics', () {
      provider.onCaptureBubbleTriggered(triggerType: 'post_ceremony');
      provider.onBubbleTapped();
      expect(provider.captureTriggerType, 'post_ceremony');
    });

    test('onManualCaptureTriggered sets isSelectorVisible true with triggerType manual', () {
      provider.onManualCaptureTriggered();
      expect(provider.isSelectorVisible, isTrue);
      expect(provider.captureTriggerType, 'manual');
    });

    test('onManualCaptureTriggered ignored when already capturing', () {
      provider.onCaptureTypeSelected(CaptureType.photo);

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onManualCaptureTriggered();
      expect(notifyCount, 0);
    });

    test('onManualCaptureTriggered ignored when selector visible', () {
      provider.onManualCaptureTriggered(); // makes selector visible

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onManualCaptureTriggered(); // should be ignored
      expect(notifyCount, 0);
    });

    test('onCaptureTypeSelected(photo) sets isCapturing true and activeCaptureType photo', () {
      provider.onCaptureTypeSelected(CaptureType.photo);
      expect(provider.isCapturing, isTrue);
      expect(provider.activeCaptureType, CaptureType.photo);
      expect(provider.isSelectorVisible, isFalse);
    });

    test('onCaptureTypeSelected(video) sets capturing but no countdown (native picker)', () {
      provider.onCaptureTypeSelected(CaptureType.video);
      expect(provider.isCapturing, isTrue);
      expect(provider.activeCaptureType, CaptureType.video);
      expect(provider.recordingSecondsRemaining, 0);
    });

    test('onCaptureTypeSelected(audio) starts countdown from 10', () {
      provider.onCaptureTypeSelected(CaptureType.audio);
      expect(provider.isCapturing, isTrue);
      expect(provider.activeCaptureType, CaptureType.audio);
      expect(provider.recordingSecondsRemaining, 10);
    });

    test('countdown decrements every second', () {
      fakeAsync((async) {
        final p = CaptureProvider();
        p.onCaptureTypeSelected(CaptureType.audio);
        expect(p.recordingSecondsRemaining, 10);

        async.elapse(const Duration(seconds: 1));
        expect(p.recordingSecondsRemaining, 9);

        async.elapse(const Duration(seconds: 1));
        expect(p.recordingSecondsRemaining, 8);

        p.dispose();
      });
    });

    test('countdown stops at 0', () {
      fakeAsync((async) {
        final p = CaptureProvider();
        p.onCaptureTypeSelected(CaptureType.video);

        async.elapse(const Duration(seconds: 5));
        expect(p.recordingSecondsRemaining, 0);

        // No further decrements
        async.elapse(const Duration(seconds: 2));
        expect(p.recordingSecondsRemaining, 0);

        p.dispose();
      });
    });

    test('onCaptureComplete resets all capture state', () {
      provider.onCaptureTypeSelected(CaptureType.video);
      provider.onCaptureComplete();

      expect(provider.isCapturing, isFalse);
      expect(provider.activeCaptureType, isNull);
      expect(provider.recordingSecondsRemaining, 0);
    });

    test('onCaptureCancelled resets all capture state', () {
      provider.onManualCaptureTriggered();
      provider.onCaptureTypeSelected(CaptureType.audio);
      provider.onCaptureCancelled();

      expect(provider.isCapturing, isFalse);
      expect(provider.isSelectorVisible, isFalse);
      expect(provider.activeCaptureType, isNull);
      expect(provider.recordingSecondsRemaining, 0);
    });

    test('clearState resets capture flow state (new fields)', () {
      provider.onManualCaptureTriggered();
      provider.onCaptureTypeSelected(CaptureType.audio);
      provider.clearState();

      expect(provider.isSelectorVisible, isFalse);
      expect(provider.isCapturing, isFalse);
      expect(provider.activeCaptureType, isNull);
      expect(provider.recordingSecondsRemaining, 0);
      expect(provider.captureTriggerType, 'manual');
    });

    // Story 9.2 — Capture ID tracking for guest-to-account upgrade

    test('myCaptureIds starts empty', () {
      expect(provider.myCaptureIds, isEmpty);
    });

    test('onCaptureCreated adds capture ID to myCaptureIds', () {
      provider.onCaptureCreated('cap-1');
      provider.onCaptureCreated('cap-2');
      expect(provider.myCaptureIds, ['cap-1', 'cap-2']);
    });

    test('clearMyCaptureIds empties the list', () {
      provider.onCaptureCreated('cap-1');
      provider.onCaptureCreated('cap-2');
      provider.clearMyCaptureIds();
      expect(provider.myCaptureIds, isEmpty);
    });

    test('clearState also clears myCaptureIds', () {
      provider.onCaptureCreated('cap-1');
      provider.clearState();
      expect(provider.myCaptureIds, isEmpty);
    });

    test('myCaptureIds returns unmodifiable list', () {
      provider.onCaptureCreated('cap-1');
      expect(() => provider.myCaptureIds.add('cap-2'), throwsUnsupportedError);
    });

    test('dismissBubble also dismisses selector if open', () {
      provider.onManualCaptureTriggered();
      expect(provider.isSelectorVisible, isTrue);

      provider.dismissBubble();
      expect(provider.isSelectorVisible, isFalse);
    });
  });
}
