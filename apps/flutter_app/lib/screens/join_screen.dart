import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/constants/tap_tiers.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/widgets/dj_tap_button.dart';

class JoinScreen extends StatefulWidget {
  const JoinScreen({super.key, this.initialCode});
  final String? initialCode;

  @override
  State<JoinScreen> createState() => _JoinScreenState();
}

class _JoinScreenState extends State<JoinScreen> {
  late final TextEditingController _codeController;
  late final TextEditingController _nameController;
  String? _errorMessage;

  bool get _canJoin =>
      _codeController.text.length == 4 &&
      _nameController.text.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    _codeController = TextEditingController(text: widget.initialCode ?? '');
    _codeController.addListener(() => setState(() {}));

    // If user is Firebase-authenticated with a display name, pre-fill it
    final authProvider = context.read<AuthProvider>();
    final firebaseName = authProvider.state == AuthState.authenticatedFirebase
        ? authProvider.displayName
        : null;
    _nameController = TextEditingController(text: firebaseName ?? '');
    _nameController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _codeController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _onJoin() async {
    setState(() => _errorMessage = null);
    final socketClient = context.read<SocketClient>();
    try {
      await socketClient.joinParty(
        apiService: context.read<ApiService>(),
        authProvider: context.read<AuthProvider>(),
        partyProvider: context.read<PartyProvider>(),
        serverUrl: AppConfig.instance.serverUrl,
        displayName: _nameController.text.trim(),
        partyCode: _codeController.text.toUpperCase(),
        captureProvider: context.read<CaptureProvider>(),
      );
      if (mounted) {
          final status = context.read<PartyProvider>().sessionStatus;
          if (status == 'active') {
            context.go('/party');
          } else {
            context.go('/lobby');
          }
        }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          switch (e.code) {
            case 'NOT_FOUND':
              _errorMessage = Copy.partyNotFound;
            case 'SESSION_FULL':
              _errorMessage = Copy.partyIsFull;
            default:
              _errorMessage = Copy.joinFailed;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = Copy.joinFailed);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final partyProvider = context.watch<PartyProvider>();
    final authProvider = context.watch<AuthProvider>();
    final isLoading = partyProvider.joinPartyLoading == LoadingState.loading;
    final hasFirebaseName = authProvider.state == AuthState.authenticatedFirebase &&
        authProvider.displayName != null &&
        authProvider.displayName!.isNotEmpty;

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
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')),
                    ],
                    decoration: const InputDecoration(
                      hintText: Copy.enterPartyCode,
                      counterText: '',
                    ),
                  ),
                  const SizedBox(height: DJTokens.spaceMd),
                  if (hasFirebaseName)
                    Padding(
                      padding: const EdgeInsets.only(bottom: DJTokens.spaceMd),
                      child: Text(
                        authProvider.displayName!,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.only(bottom: DJTokens.spaceMd),
                      child: TextField(
                        key: const Key('display-name-input'),
                        controller: _nameController,
                        maxLength: 30,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(
                          hintText: Copy.enterYourName,
                          counterText: '',
                        ),
                      ),
                    ),
                  const SizedBox(height: DJTokens.spaceSm),
                  Opacity(
                    opacity: _canJoin && !isLoading ? 1.0 : 0.5,
                    child: DJTapButton(
                      key: const Key('join-party-submit-btn'),
                      tier: TapTier.consequential,
                      onTap: _canJoin && !isLoading ? _onJoin : () {},
                      child: isLoading
                          ? Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                ),
                                const SizedBox(width: DJTokens.spaceSm),
                                const Text(Copy.joiningParty),
                              ],
                            )
                          : const Text(Copy.joinParty),
                    ),
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: DJTokens.spaceSm),
                    Text(
                      _errorMessage!,
                      key: const Key('join-error-message'),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.error,
                          ),
                      textAlign: TextAlign.center,
                    ),
                  ],
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
