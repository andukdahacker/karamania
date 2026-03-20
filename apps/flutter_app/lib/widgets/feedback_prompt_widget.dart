import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:provider/provider.dart';

class FeedbackPromptWidget extends StatefulWidget {
  const FeedbackPromptWidget({
    super.key,
    required this.vibe,
  });

  final PartyVibe vibe;

  @override
  State<FeedbackPromptWidget> createState() => _FeedbackPromptWidgetState();
}

class _FeedbackPromptWidgetState extends State<FeedbackPromptWidget>
    with SingleTickerProviderStateMixin {
  int? _selectedRating;
  late final AnimationController _fadeController;
  late final Animation<double> _fadeAnimation;

  static const _ratingEmojis = ['😞', '😐', '🙂', '😄', '😍'];

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    );
    _fadeController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  void _onRatingTap(int score) {
    if (_selectedRating != null) return; // Already submitted
    setState(() {
      _selectedRating = score;
    });
    SocketClient.instance.submitFeedback(score);
  }

  void _onLeaveParty() {
    final partyProvider = context.read<PartyProvider>();
    if (partyProvider.isHost) {
      SocketClient.instance.emitHostDismissFinale();
    }
    context.go('/');
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: Center(
        key: const Key('feedback-prompt'),
        child: Padding(
          padding: const EdgeInsets.all(DJTokens.spaceLg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                Copy.finaleFeedbackTitle,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: DJTokens.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: DJTokens.spaceXl),
              if (_selectedRating == null)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: List.generate(5, (index) {
                    final score = index + 1;
                    return _RatingButton(
                      score: score,
                      emoji: _ratingEmojis[index],
                      vibe: widget.vibe,
                      onTap: () => _onRatingTap(score),
                    );
                  }),
                )
              else
                Column(
                  children: [
                    Text(
                      _ratingEmojis[_selectedRating! - 1],
                      style: const TextStyle(fontSize: DJTokens.iconSizeXl),
                    ),
                    const SizedBox(height: DJTokens.spaceSm),
                    Text(
                      Copy.finaleFeedbackThanks,
                      style:
                          Theme.of(context).textTheme.headlineMedium?.copyWith(
                                color: widget.vibe.accent,
                                fontWeight: FontWeight.bold,
                              ),
                    ),
                  ],
                ),
              const SizedBox(height: DJTokens.spaceXl),
              ElevatedButton(
                onPressed: _onLeaveParty,
                style: ElevatedButton.styleFrom(
                  backgroundColor: DJTokens.surfaceElevated,
                  foregroundColor: DJTokens.textPrimary,
                  minimumSize: const Size(200, 48),
                ),
                child: const Text(Copy.finaleLeaveParty),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RatingButton extends StatelessWidget {
  const _RatingButton({
    required this.score,
    required this.emoji,
    required this.vibe,
    required this.onTap,
  });

  final int score;
  final String emoji;
  final PartyVibe vibe;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: DJTokens.surfaceElevated,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: vibe.accent.withValues(alpha: 0.3),
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          emoji,
          style: const TextStyle(fontSize: 28),
        ),
      ),
    );
  }
}
