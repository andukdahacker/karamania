import 'dart:io' show Platform;
import 'package:flutter/material.dart';

/// Renders emoji text using the platform's native font to avoid
/// glyph issues with custom fonts (SpaceGrotesk) on Impeller.
class EmojiText extends StatelessWidget {
  const EmojiText(this.text, {super.key, this.fontSize = 28});

  final String text;
  final double fontSize;

  // Platform font that reliably renders emoji with Impeller.
  static final String _platformFont =
      Platform.isIOS ? '.AppleSystemUIFont' : 'Roboto';

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: fontSize,
        fontFamily: _platformFont,
      ),
    );
  }
}
