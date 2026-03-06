/// Three tap interaction tiers for DJTapButton.
enum TapTier {
  /// 64x64px min, 500ms long-press hold, heavyImpact on confirm,
  /// scale(0.92), fill animation during hold, early release = cancel.
  consequential,

  /// 56x56px min, immediate fire, 200ms debounce,
  /// lightImpact on touch-down, scale(0.95).
  social,

  /// 48x48px min, immediate fire, 200ms debounce,
  /// no haptic, scale(0.97).
  private,
}

/// Minimum size in logical pixels for each tier.
double tapTierMinSize(TapTier tier) {
  switch (tier) {
    case TapTier.consequential:
      return 64.0;
    case TapTier.social:
      return 56.0;
    case TapTier.private:
      return 48.0;
  }
}

/// Scale factor for press feedback per tier.
double tapTierScale(TapTier tier) {
  switch (tier) {
    case TapTier.consequential:
      return 0.92;
    case TapTier.social:
      return 0.95;
    case TapTier.private:
      return 0.97;
  }
}
