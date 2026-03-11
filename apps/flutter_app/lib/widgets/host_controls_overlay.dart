import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/theme/dj_theme.dart';

class HostControlsOverlay extends StatefulWidget {
  const HostControlsOverlay({
    super.key,
    required this.onInvite,
  });

  final VoidCallback onInvite;

  @override
  State<HostControlsOverlay> createState() => _HostControlsOverlayState();
}

class _HostControlsOverlayState extends State<HostControlsOverlay> {
  bool _expanded = false;

  void _toggle() {
    setState(() => _expanded = !_expanded);
  }

  void _collapse() {
    if (_expanded) setState(() => _expanded = false);
  }

  @override
  Widget build(BuildContext context) {
    final partyProvider = context.watch<PartyProvider>();
    if (!partyProvider.isHost) return const SizedBox.shrink();

    final vibe = partyProvider.vibe;

    return Stack(
      children: [
        if (_expanded)
          Positioned.fill(
            child: GestureDetector(
              key: const Key('host-overlay-barrier'),
              onTap: _collapse,
              behavior: HitTestBehavior.opaque,
              child: Container(color: Colors.black.withValues(alpha: 0.4)),
            ),
          ),
        Positioned(
          right: DJTokens.spaceMd,
          bottom: DJTokens.spaceMd,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (_expanded) ...[
                _ControlButton(
                  key: const Key('host-control-invite'),
                  label: Copy.hostControlInvite,
                  icon: Icons.qr_code,
                  color: vibe.accent,
                  onTap: () {
                    _collapse();
                    widget.onInvite();
                  },
                ),
                const SizedBox(height: DJTokens.spaceSm),
                _ControlButton(
                  key: const Key('host-control-skip'),
                  label: Copy.hostControlSkip,
                  icon: Icons.skip_next,
                  color: vibe.accent,
                  onTap: () {
                    _collapse();
                    SocketClient.instance.emitHostSkip();
                  },
                ),
                const SizedBox(height: DJTokens.spaceSm),
                _ControlButton(
                  key: const Key('host-control-override'),
                  label: Copy.hostControlOverride,
                  icon: Icons.swap_horiz,
                  color: vibe.accent,
                  onTap: () {
                    _collapse();
                    _showOverrideMenu(context);
                  },
                ),
                const SizedBox(height: DJTokens.spaceSm),
                _ControlButton(
                  key: const Key('host-control-pause'),
                  label: partyProvider.isPaused
                      ? Copy.hostControlResume
                      : Copy.hostControlPause,
                  icon: partyProvider.isPaused ? Icons.play_arrow : Icons.pause,
                  color: partyProvider.isPaused
                      ? DJTokens.actionConfirm
                      : vibe.accent,
                  onTap: () {
                    _collapse();
                    if (partyProvider.isPaused) {
                      SocketClient.instance.emitHostResume();
                    } else {
                      SocketClient.instance.emitHostPause();
                    }
                  },
                ),
                const SizedBox(height: DJTokens.spaceSm),
                _ControlButton(
                  key: const Key('host-control-kick'),
                  label: Copy.hostControlKickPlayer,
                  icon: Icons.person_remove,
                  color: DJTokens.actionDanger,
                  onTap: () {
                    _collapse();
                    _showKickPlayerPicker(context, partyProvider);
                  },
                ),
                const SizedBox(height: DJTokens.spaceSm),
                _ControlButton(
                  key: const Key('host-control-end-party'),
                  label: Copy.hostControlEndParty,
                  icon: Icons.stop,
                  color: DJTokens.actionDanger,
                  onTap: () {
                    _collapse();
                    _showEndPartyConfirmation(context);
                  },
                ),
                const SizedBox(height: DJTokens.spaceMd),
              ],
              SizedBox(
                width: 56,
                height: 56,
                child: FloatingActionButton(
                  key: const Key('host-controls-fab'),
                  backgroundColor: vibe.accent,
                  onPressed: _toggle,
                  child: Icon(
                    _expanded ? Icons.close : Icons.settings,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showOverrideMenu(BuildContext context) {
    const targets = ['songSelection', 'partyCardDeal', 'song', 'ceremony', 'interlude'];
    showModalBottomSheet(
      context: context,
      backgroundColor: DJTokens.surfaceColor,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(DJTokens.spaceMd),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                Copy.hostControlOverride,
                style: Theme.of(sheetContext).textTheme.titleMedium?.copyWith(
                      color: DJTokens.textPrimary,
                    ),
              ),
              const SizedBox(height: DJTokens.spaceMd),
              ...targets.map((target) => ListTile(
                    key: Key('override-$target'),
                    title: Text(
                      Copy.djStateLabel(DJState.values.byName(target)),
                      style: const TextStyle(color: DJTokens.textPrimary),
                    ),
                    onTap: () {
                      Navigator.pop(sheetContext);
                      SocketClient.instance.emitHostOverride(target);
                    },
                  )),
            ],
          ),
        ),
      ),
    );
  }

  void _showKickPlayerPicker(BuildContext context, PartyProvider partyProvider) {
    final others = partyProvider.participants
        .where((p) => p.userId != (SocketClient.instance.currentUserId ?? ''))
        .toList();

    showModalBottomSheet(
      context: context,
      backgroundColor: DJTokens.surfaceColor,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(DJTokens.spaceMd),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                Copy.hostControlKickPlayer,
                style: Theme.of(sheetContext).textTheme.titleMedium?.copyWith(
                      color: DJTokens.textPrimary,
                    ),
              ),
              const SizedBox(height: DJTokens.spaceMd),
              ...others.map((p) => ListTile(
                    key: Key('kick-${p.userId}'),
                    title: Text(
                      p.displayName,
                      style: const TextStyle(color: DJTokens.textPrimary),
                    ),
                    trailing: const Icon(Icons.person_remove, color: DJTokens.actionDanger),
                    onTap: () {
                      Navigator.pop(sheetContext);
                      SocketClient.instance.emitHostKickPlayer(p.userId);
                    },
                  )),
            ],
          ),
        ),
      ),
    );
  }

  void _showEndPartyConfirmation(BuildContext context) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        key: const Key('end-party-dialog'),
        backgroundColor: DJTokens.surfaceColor,
        title: const Text(
          Copy.hostControlEndPartyConfirmTitle,
          style: TextStyle(color: DJTokens.textPrimary),
        ),
        content: const Text(
          Copy.hostControlEndPartyConfirmBody,
          style: TextStyle(color: DJTokens.textSecondary),
        ),
        actions: [
          TextButton(
            key: const Key('end-party-cancel'),
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text(Copy.hostControlEndPartyConfirmNo),
          ),
          TextButton(
            key: const Key('end-party-confirm'),
            onPressed: () {
              Navigator.pop(dialogContext);
              SocketClient.instance.emitHostEndParty();
            },
            child: const Text(
              Copy.hostControlEndPartyConfirmYes,
              style: TextStyle(color: DJTokens.actionDanger),
            ),
          ),
        ],
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  const _ControlButton({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(DJTokens.spaceSm),
        child: Container(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          padding: const EdgeInsets.symmetric(
            horizontal: DJTokens.spaceMd,
            vertical: DJTokens.spaceSm,
          ),
          decoration: BoxDecoration(
            color: DJTokens.surfaceElevated,
            borderRadius: BorderRadius.circular(DJTokens.spaceSm),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: onTap != null ? color : DJTokens.textSecondary, size: 20),
              const SizedBox(width: DJTokens.spaceSm),
              Text(
                label,
                style: TextStyle(
                  color: onTap != null ? DJTokens.textPrimary : DJTokens.textSecondary,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
