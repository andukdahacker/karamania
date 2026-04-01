import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/widgets/branded_dialog.dart';

void main() {
  Widget buildApp({required Widget child}) {
    return MaterialApp(home: Scaffold(body: child));
  }

  group('BrandedDialog', () {
    testWidgets('renders title text', (tester) async {
      await tester.pumpWidget(buildApp(
        child: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => showDialog(
              context: context,
              builder: (_) => const BrandedDialog(title: 'Test Title'),
            ),
            child: const Text('Open'),
          ),
        ),
      ));

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('Test Title'), findsOneWidget);
    });

    testWidgets('renders content widget when provided', (tester) async {
      await tester.pumpWidget(buildApp(
        child: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => showDialog(
              context: context,
              builder: (_) => const BrandedDialog(
                title: 'Title',
                content: Text('Body content'),
              ),
            ),
            child: const Text('Open'),
          ),
        ),
      ));

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('Body content'), findsOneWidget);
    });

    testWidgets('hides content when null', (tester) async {
      await tester.pumpWidget(buildApp(
        child: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => showDialog(
              context: context,
              builder: (_) => const BrandedDialog(title: 'Title Only'),
            ),
            child: const Text('Open'),
          ),
        ),
      ));

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      // Title should be present but no extra content text
      expect(find.text('Title Only'), findsOneWidget);
      // Column should have only the title Text widget (no SizedBox + content)
      final column = tester.widget<Column>(find.descendant(
        of: find.byType(Dialog),
        matching: find.byType(Column),
      ));
      expect(column.children.length, 1);
    });
  });

  group('BrandedDialogAction', () {
    testWidgets('confirm style renders as ElevatedButton', (tester) async {
      await tester.pumpWidget(buildApp(
        child: BrandedDialogAction(
          label: 'Confirm',
          style: BrandedDialogActionStyle.confirm,
          onPressed: () {},
        ),
      ));

      expect(find.byType(ElevatedButton), findsOneWidget);
      expect(find.text('Confirm'), findsOneWidget);
    });

    testWidgets('cancel style renders as TextButton', (tester) async {
      await tester.pumpWidget(buildApp(
        child: BrandedDialogAction(
          label: 'Cancel',
          style: BrandedDialogActionStyle.cancel,
          onPressed: () {},
        ),
      ));

      expect(find.byType(TextButton), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
    });

    testWidgets('danger style renders as TextButton', (tester) async {
      await tester.pumpWidget(buildApp(
        child: BrandedDialogAction(
          label: 'Delete',
          style: BrandedDialogActionStyle.danger,
          onPressed: () {},
        ),
      ));

      expect(find.byType(TextButton), findsOneWidget);
      expect(find.text('Delete'), findsOneWidget);
    });
  });

  group('showBrandedConfirm', () {
    testWidgets('returns true when confirm tapped', (tester) async {
      bool? result;

      await tester.pumpWidget(buildApp(
        child: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              result = await showBrandedConfirm(
                context: context,
                title: 'Confirm?',
                message: 'Are you sure?',
                confirmLabel: 'YES',
                cancelLabel: 'NO',
              );
            },
            child: const Text('Open'),
          ),
        ),
      ));

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('YES'));
      await tester.pumpAndSettle();

      expect(result, isTrue);
    });

    testWidgets('returns false when cancel tapped', (tester) async {
      bool? result;

      await tester.pumpWidget(buildApp(
        child: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              result = await showBrandedConfirm(
                context: context,
                title: 'Confirm?',
                message: 'Are you sure?',
                confirmLabel: 'YES',
                cancelLabel: 'NO',
              );
            },
            child: const Text('Open'),
          ),
        ),
      ));

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('NO'));
      await tester.pumpAndSettle();

      expect(result, isFalse);
    });

    testWidgets('renders danger style button when isDanger is true', (tester) async {
      await tester.pumpWidget(buildApp(
        child: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => showBrandedConfirm(
              context: context,
              title: 'End Party?',
              message: 'This will end the party for everyone.',
              confirmLabel: 'END',
              isDanger: true,
            ),
            child: const Text('Open'),
          ),
        ),
      ));

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      // Confirm button should be TextButton (danger), not ElevatedButton
      // The cancel button is also a TextButton, plus the trigger ElevatedButton
      expect(find.byType(TextButton), findsNWidgets(2));
      expect(find.byType(ElevatedButton), findsOneWidget); // only the trigger button
    });

    testWidgets('applies custom keys to dialog and action widgets', (tester) async {
      await tester.pumpWidget(buildApp(
        child: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => showBrandedConfirm(
              context: context,
              title: 'Confirm?',
              message: 'Are you sure?',
              confirmLabel: 'YES',
              cancelLabel: 'NO',
              key: const Key('test-dialog'),
              cancelKey: const Key('test-cancel'),
              confirmKey: const Key('test-confirm'),
            ),
            child: const Text('Open'),
          ),
        ),
      ));

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('test-dialog')), findsOneWidget);
      expect(find.byKey(const Key('test-cancel')), findsOneWidget);
      expect(find.byKey(const Key('test-confirm')), findsOneWidget);
    });

    testWidgets('returns false when dismissed via barrier tap', (tester) async {
      bool? result;

      await tester.pumpWidget(buildApp(
        child: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              result = await showBrandedConfirm(
                context: context,
                title: 'Confirm?',
                message: 'Are you sure?',
              );
            },
            child: const Text('Open'),
          ),
        ),
      ));

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      // Tap outside dialog to dismiss
      await tester.tapAt(Offset.zero);
      await tester.pumpAndSettle();

      expect(result, isFalse);
    });
  });
}
