import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_tokens.dart';

class JoinScreen extends StatefulWidget {
  const JoinScreen({super.key, this.initialCode});
  final String? initialCode;

  @override
  State<JoinScreen> createState() => _JoinScreenState();
}

class _JoinScreenState extends State<JoinScreen> {
  late final TextEditingController _codeController;

  @override
  void initState() {
    super.initState();
    _codeController = TextEditingController(text: widget.initialCode ?? '');
    _codeController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 428),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: DJTokens.spaceMd),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(Copy.joinParty, style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: DJTokens.spaceLg),
                  TextField(
                    key: const Key('party-code-input'),
                    controller: _codeController,
                    maxLength: 4,
                    textAlign: TextAlign.center,
                    textCapitalization: TextCapitalization.characters,
                    style: Theme.of(context).textTheme.displayMedium,
                    decoration: const InputDecoration(
                      hintText: Copy.enterPartyCode,
                      counterText: '',
                    ),
                  ),
                  const SizedBox(height: DJTokens.spaceLg),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      key: const Key('join-party-submit-btn'),
                      onPressed: _codeController.text.length == 4 ? () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text(Copy.joinFlowComingSoon)),
                        );
                      } : null,
                      child: const Text(Copy.joinParty),
                    ),
                  ),
                  const SizedBox(height: DJTokens.spaceMd),
                  TextButton(
                    onPressed: () => context.go('/'),
                    child: const Text(Copy.backToHome),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
