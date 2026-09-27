// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/// Entry point of the accounting app.
///
/// What happens on startup, in order:
///
/// 1. [HamolusClient] is built from `--dart-define`.
/// 2. `getLocalization()` is asked once. Failure is swallowed on purpose: that endpoint
///    is public and only picks a locale, so a core without localization configured must
///    not take the app down.
/// 3. [JournalPage] opens with the repository already wired in.
///
/// This app only reads. Writing invoices and journal entries happens in the console or
/// in the panel, because a public read endpoint must not be able to write.
library;

import 'package:flutter/material.dart';

import 'accounting_repository.dart';
import 'hamolus_client.dart';
import 'journal_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final client = HamolusClient();

  // Asked outside the build tree so it does not hold up the first frame. Failure here is
  // not fatal: the locale from the app configuration is enough to run.
  final localization = await client.getLocalization();
  final locale = localization?.defaultLocale ?? client.locale;

  runApp(AccountingApp(repository: AccountingRepository(client), locale: locale));
}

class AccountingApp extends StatelessWidget {
  const AccountingApp({super.key, required this.repository, required this.locale});

  final AccountingRepository repository;
  final String locale;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Accounting',
      // The locale sent to the core is the one sent to Flutter, so the language picker
      // in the core and the app display never drift apart.
      locale: locale == 'id' ? const Locale('id') : null,
      supportedLocales: const [Locale('en'), Locale('id')],
      theme: ThemeData(
        colorSchemeSeed: Colors.teal,
        useMaterial3: true,
      ),
      home: JournalPage(repository: repository),
    );
  }
}
