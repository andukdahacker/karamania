import 'package:flutter/material.dart';
import 'package:karamania/theme/dj_tokens.dart';

/// Style variants for [BrandedDialogAction] buttons.
enum BrandedDialogActionStyle { cancel, confirm, danger }

/// A branded dialog widget matching the app's dark theme.
///
/// Uses [DJTokens.surfaceElevated] background, 16px border radius,
/// and consistent text colors.
class BrandedDialog extends StatelessWidget {
  const BrandedDialog({
    super.key,
    required this.title,
    this.content,
    this.actions = const [],
  });

  final String title;
  final Widget? content;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: DJTokens.surfaceElevated,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(DJTokens.spaceLg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: DJTokens.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (content != null) ...[
              const SizedBox(height: DJTokens.spaceMd),
              content!,
            ],
            if (actions.isNotEmpty) ...[
              const SizedBox(height: DJTokens.spaceLg),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: actions,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// A styled action button for use inside [BrandedDialog].
///
/// - [BrandedDialogActionStyle.cancel]: text-only, secondary color
/// - [BrandedDialogActionStyle.confirm]: gold filled, dark text
/// - [BrandedDialogActionStyle.danger]: text-only, danger color
class BrandedDialogAction extends StatelessWidget {
  const BrandedDialogAction({
    super.key,
    required this.label,
    required this.onPressed,
    this.style = BrandedDialogActionStyle.cancel,
  });

  final String label;
  final VoidCallback onPressed;
  final BrandedDialogActionStyle style;

  @override
  Widget build(BuildContext context) {
    switch (style) {
      case BrandedDialogActionStyle.confirm:
        return ElevatedButton(
          onPressed: onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: DJTokens.gold,
            foregroundColor: DJTokens.bgColor,
          ),
          child: Text(label),
        );
      case BrandedDialogActionStyle.danger:
        return TextButton(
          onPressed: onPressed,
          style: TextButton.styleFrom(
            foregroundColor: DJTokens.actionDanger,
          ),
          child: Text(label),
        );
      case BrandedDialogActionStyle.cancel:
        return TextButton(
          onPressed: onPressed,
          style: TextButton.styleFrom(
            foregroundColor: DJTokens.textSecondary,
          ),
          child: Text(label),
        );
    }
  }
}

/// Shows a branded confirm/cancel dialog.
///
/// Returns `true` if confirmed, `false` if cancelled or dismissed.
/// Use [isDanger] for destructive actions (e.g., "End Party").
Future<bool> showBrandedConfirm({
  required BuildContext context,
  required String title,
  required String message,
  String confirmLabel = 'OK',
  String cancelLabel = 'CANCEL',
  bool isDanger = false,
  Key? key,
  Key? cancelKey,
  Key? confirmKey,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (context) => BrandedDialog(
      key: key,
      title: title,
      content: Text(
        message,
        style: const TextStyle(color: DJTokens.textSecondary),
      ),
      actions: [
        BrandedDialogAction(
          key: cancelKey,
          label: cancelLabel,
          style: BrandedDialogActionStyle.cancel,
          onPressed: () => Navigator.of(context).pop(false),
        ),
        const SizedBox(width: DJTokens.spaceSm),
        BrandedDialogAction(
          key: confirmKey,
          label: confirmLabel,
          style: isDanger
              ? BrandedDialogActionStyle.danger
              : BrandedDialogActionStyle.confirm,
          onPressed: () => Navigator.of(context).pop(true),
        ),
      ],
    ),
  );
  return result ?? false;
}
