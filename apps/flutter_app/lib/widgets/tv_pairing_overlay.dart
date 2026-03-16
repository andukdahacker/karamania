import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/theme/dj_tokens.dart';

class TvPairingOverlay extends StatefulWidget {
  const TvPairingOverlay({super.key});

  @override
  State<TvPairingOverlay> createState() => _TvPairingOverlayState();
}

class _TvPairingOverlayState extends State<TvPairingOverlay> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _connect() {
    final code = _controller.text.trim();
    if (code.isEmpty) return;
    SocketClient.instance.pairTv(code);
  }

  void _disconnect() {
    SocketClient.instance.unpairTv();
  }

  @override
  Widget build(BuildContext context) {
    final partyProvider = context.watch<PartyProvider>();
    final tvStatus = partyProvider.tvStatus;
    final tvPairingState = partyProvider.tvPairingState;

    return Padding(
      key: const Key('tv-pairing-overlay'),
      padding: const EdgeInsets.all(DJTokens.spaceMd),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            Copy.tvPairingTitle,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: DJTokens.spaceSm),
          if (tvStatus == TvConnectionStatus.connected) ...[
            Text(
              Copy.tvConnected,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: DJTokens.actionConfirm,
                  ),
            ),
            const SizedBox(height: DJTokens.spaceMd),
            TextButton(
              onPressed: _disconnect,
              child: Text(
                Copy.tvUnpair,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DJTokens.actionDanger,
                    ),
              ),
            ),
          ] else if (tvStatus == TvConnectionStatus.reconnecting) ...[
            Text(
              Copy.tvReconnecting,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DJTokens.textSecondary,
                  ),
            ),
          ] else ...[
            Text(
              Copy.tvPairingInstructions,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DJTokens.textSecondary,
                  ),
            ),
            const SizedBox(height: DJTokens.spaceMd),
            TextField(
              controller: _controller,
              decoration: InputDecoration(
                hintText: Copy.tvPairingPlaceholder,
                filled: true,
                fillColor: DJTokens.surfaceElevated,
              ),
              textAlign: TextAlign.center,
              enabled: tvPairingState != LoadingState.loading,
            ),
            const SizedBox(height: DJTokens.spaceMd),
            if (tvPairingState == LoadingState.loading)
              const CircularProgressIndicator()
            else
              ElevatedButton(
                onPressed: _connect,
                child: const Text(Copy.tvPairingConnect),
              ),
            if (partyProvider.tvStatusMessage != null) ...[
              const SizedBox(height: DJTokens.spaceSm),
              Text(
                partyProvider.tvStatusMessage!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DJTokens.actionDanger,
                    ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
