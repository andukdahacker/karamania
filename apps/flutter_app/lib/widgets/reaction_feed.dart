import 'package:flutter/material.dart';
import 'package:karamania/widgets/emoji_text.dart';

/// Floating emoji reaction display using implicit animations.
/// Emoji particles float upward with random horizontal scatter.
/// Uses pre-rendered scatter patterns (NOT real-time physics) per NFR5.
class ReactionFeed extends StatelessWidget {
  const ReactionFeed({
    super.key,
    required this.reactions,
    this.onParticleComplete,
  });

  final List<ReactionFeedItem> reactions;
  final void Function(int id)? onParticleComplete;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      key: const Key('reaction-feed'),
      child: SizedBox.expand(
        child: Stack(
          children: reactions.map((reaction) {
            return _ReactionParticle(
              key: ValueKey(reaction.id),
              emoji: reaction.emoji,
              startX: reaction.startX,
              opacity: reaction.opacity,
              onComplete: () => onParticleComplete?.call(reaction.id),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class ReactionFeedItem {
  const ReactionFeedItem({
    required this.id,
    required this.emoji,
    required this.startX,
    required this.opacity,
  });

  final int id;
  final String emoji;
  final double startX;
  final double opacity;
}

/// Individual emoji particle that floats up and fades out.
class _ReactionParticle extends StatefulWidget {
  const _ReactionParticle({
    super.key,
    required this.emoji,
    required this.startX,
    required this.opacity,
    required this.onComplete,
  });

  final String emoji;
  final double startX;
  final double opacity;
  final VoidCallback onComplete;

  @override
  State<_ReactionParticle> createState() => _ReactionParticleState();
}

class _ReactionParticleState extends State<_ReactionParticle>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        widget.onComplete();
      }
    });
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;
        final size = MediaQuery.of(context).size;
        return Positioned(
          left: widget.startX * size.width * 0.8 + size.width * 0.1,
          bottom: t * size.height * 0.5 + size.height * 0.1,
          child: Opacity(
            opacity: widget.opacity * (1.0 - t),
            child: child,
          ),
        );
      },
      child: EmojiText(
        widget.emoji,
      ),
    );
  }
}
