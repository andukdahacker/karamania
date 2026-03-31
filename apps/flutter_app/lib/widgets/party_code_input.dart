import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_tokens.dart';

class PartyCodeInput extends StatefulWidget {
  const PartyCodeInput({
    super.key,
    this.initialCode,
    required this.onCodeChanged,
  });

  final String? initialCode;
  final ValueChanged<String> onCodeChanged;

  @override
  State<PartyCodeInput> createState() => _PartyCodeInputState();
}

class _PartyCodeInputState extends State<PartyCodeInput> {
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _focusNodes;

  String get code =>
      _controllers.map((c) => c.text).join().toUpperCase();

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(4, (_) => TextEditingController());
    _focusNodes = List.generate(4, (_) => FocusNode());

    // Set initial text BEFORE adding listeners to avoid setState during build
    if (widget.initialCode != null && widget.initialCode!.isNotEmpty) {
      final chars = widget.initialCode!.toUpperCase();
      for (int i = 0; i < 4 && i < chars.length; i++) {
        _controllers[i].text = chars[i];
      }
    }

    for (final c in _controllers) {
      c.addListener(_notifyCodeChanged);
    }
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.removeListener(_notifyCodeChanged);
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  void _notifyCodeChanged() {
    widget.onCodeChanged(code);
  }

  void _handleCodeInput(int index, String value) {
    if (value.length > 1) {
      if (value.length == 2) {
        // Edit: user typed into a filled box — keep the new char (last char)
        _controllers[index].text = value[value.length - 1];
        if (index < 3) {
          _focusNodes[index + 1].requestFocus();
        }
      } else {
        // Paste detection: 3+ chars entered in a single box
        final chars =
            value.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
        for (int i = 0; i < 4 && i < chars.length; i++) {
          _controllers[i].text = chars[i];
        }
        final lastIndex = (chars.length - 1).clamp(0, 3);
        _focusNodes[lastIndex].requestFocus();
      }
      setState(() {});
      return;
    }
    // Enforce single character per box
    if (value.length == 1 && index < 3) {
      // Auto-advance on character entry
      _focusNodes[index + 1].requestFocus();
    } else if (value.isEmpty && index > 0) {
      // Backspace: move focus to previous box
      _focusNodes[index - 1].requestFocus();
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          key: const Key('party-code-input'),
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(4, (i) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: DJTokens.spaceXs),
              child: Semantics(
                label: 'Party code digit ${i + 1} of 4',
                child: SizedBox(
                  width: 64,
                  height: 64,
                  child: TextField(
                    key: Key('party-code-$i'),
                    controller: _controllers[i],
                    focusNode: _focusNodes[i],
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                    ),
                    textCapitalization: TextCapitalization.characters,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')),
                    ],
                    decoration: InputDecoration(
                      counterText: '',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: DJTokens.textSecondary,
                          width: 1.5,
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: DJTokens.textSecondary,
                          width: 1.5,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: DJTokens.gold,
                          width: 2,
                        ),
                      ),
                      filled: true,
                      fillColor: DJTokens.surfaceElevated,
                    ),
                    onChanged: (value) => _handleCodeInput(i, value),
                  ),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: DJTokens.spaceSm),
        Text(
          Copy.partyCodeHint,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: DJTokens.textSecondary,
              ),
        ),
      ],
    );
  }
}
