import 'package:flutter/material.dart';
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
import 'package:karamania/widgets/party_code_input.dart';

class JoinScreen extends StatefulWidget {
  const JoinScreen({super.key, this.initialCode});
  final String? initialCode;

  @override
  State<JoinScreen> createState() => _JoinScreenState();
}

class _JoinScreenState extends State<JoinScreen> {
  late final TextEditingController _nameController;
  String _currentCode = '';
  String? _errorMessage;

  bool get _canJoin =>
      _currentCode.length == 4 &&
      _nameController.text.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    _currentCode = (widget.initialCode ?? '').toUpperCase();

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
        partyCode: _currentCode,
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
    final hasFirebaseName =
        authProvider.state == AuthState.authenticatedFirebase &&
            authProvider.displayName != null &&
            authProvider.displayName!.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          key: const Key('join-back-btn'),
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/'),
        ),
      ),
      body: SafeArea(
        child: Align(
          alignment: const Alignment(0, -0.3),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 428),
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: DJTokens.spaceMd),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(Copy.joinParty,
                      style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: DJTokens.spaceLg),
                  PartyCodeInput(
                    initialCode: widget.initialCode,
                    onCodeChanged: (code) {
                      setState(() => _currentCode = code);
                    },
                  ),
                  const SizedBox(height: DJTokens.spaceMd),
                  if (hasFirebaseName)
                    Padding(
                      padding:
                          const EdgeInsets.only(bottom: DJTokens.spaceMd),
                      child: Text(
                        authProvider.displayName!,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    )
                  else
                    Padding(
                      padding:
                          const EdgeInsets.only(bottom: DJTokens.spaceMd),
                      child: TextField(
                        key: const Key('display-name-input'),
                        controller: _nameController,
                        maxLength: 30,
                        textCapitalization: TextCapitalization.words,
                        style: Theme.of(context).textTheme.bodyLarge,
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
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            vertical: DJTokens.spaceMd),
                        decoration: BoxDecoration(
                          color: DJTokens.gold,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: isLoading
                            ? Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: DJTokens.bgColor,
                                    ),
                                  ),
                                  const SizedBox(width: DJTokens.spaceSm),
                                  Text(
                                    Copy.joiningParty,
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelLarge
                                        ?.copyWith(color: DJTokens.bgColor),
                                  ),
                                ],
                              )
                            : Text(
                                Copy.joinParty,
                                textAlign: TextAlign.center,
                                style: Theme.of(context)
                                    .textTheme
                                    .labelLarge
                                    ?.copyWith(color: DJTokens.bgColor),
                              ),
                      ),
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
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
