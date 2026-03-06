import 'package:flutter/widgets.dart';

/// Provides accessibility state, primarily reduced-motion detection.
/// Register in MultiProvider at app root.
///
/// Reduced motion widget behaviors (convention for subsequent stories):
/// - Decorative elements: use ExcludeSemantics
/// - Animations: become instant/static
/// - No confetti/glow/pulse effects
class AccessibilityProvider extends ChangeNotifier {
  bool _reducedMotion = false;

  /// Whether the user prefers reduced motion.
  /// Read from MediaQuery.disableAnimations.
  bool get reducedMotion => _reducedMotion;

  /// Update reduced motion state from MediaQuery.
  /// Call from a widget that has access to MediaQuery context.
  void updateFromMediaQuery(BuildContext context) {
    final disableAnimations = MediaQuery.of(context).disableAnimations;
    if (_reducedMotion != disableAnimations) {
      _reducedMotion = disableAnimations;
      notifyListeners();
    }
  }
}
