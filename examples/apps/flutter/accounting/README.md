# examples/apps/flutter/accounting

Native **Flutter** accounting app that reads data from a Hamolus core.

Example domain: a professional services business whose owner and admin use the app to look
at the general ledger, journal entries, and invoices. This app is **read-only** — all
writing happens in the console or in a panel, because an app that can write through the
public API without authentication is a hole, not a feature.

## What it demonstrates

- **A REST client in Dart** (`lib/hamolus_client.dart`), the counterpart of
  `src/lib/hamolus.ts` in the site examples: no `Authorization` header, a normalised base
  URL, and errors thrown as exceptions carrying a `code`.
- **A client that can be injected.** `HamolusClient` takes an `http.Client`, so
  `test/hamolus_client_test.dart` can exercise queries, headers, and error mapping without
  a network. That is what makes the integration verifiable without a live core.
- **One implementation for desktop and web.** The client uses `package:http`, not
  `dart:io`, because `dart:io` does not exist on the web. A `dart:io` client would make
  this example desktop-only even though this README promises web.
- **Core-owned locales.** `getLocalization()` is read once at startup, and its locale is
  then used for every request. Adding a language in the core does not touch app code.
- **Honest pagination.** `meta.totalPages` decides whether there is a next page; the app
  does not guess from the length of the list.
- **Layer separation.** `lib/accounting_repository.dart` knows its data shape,
  `lib/journal_page.dart` knows how to display it, and `lib/hamolus_client.dart` only
  knows the transport.
- **Models that tolerate new fields.** Records from the core are converted into classes
  with defaults, so a field added by the core does not stop the app from starting.

## Prerequisites

Three collections in the core:

| Collection | Fields |
| --- | --- |
| `accounts` | `code`, `name`, `type` (`asset` / `liability` / `equity` / `revenue` / `expense`) |
| `journal_entries` | `entry_no`, `entry_date`, `description`, `account_id`, `debit`, `credit`, `currency` |
| `invoices` | `invoice_no`, `issued_at`, `due_at`, `client_name`, `total`, `status` |

## Running

This folder deliberately does **not** commit platform folders (`android/`, `ios/`,
`macos/`, `web/`, `linux/`, `windows/`). They are all `flutter create` output that changes
fast and holds nothing that is being demonstrated. One command creates them:

```bash
cd examples/apps/flutter/accounting
flutter create .        # adds the platform folders, without overwriting lib/ or pubspec.yaml
```

After that:

```bash
# desktop and web, against a core on the same machine
flutter run --dart-define=HAMOLUS_API_ORIGIN=http://localhost:8787

# Android emulator: localhost means the emulator itself, so use 10.0.2.2
flutter run --dart-define=HAMOLUS_API_ORIGIN=http://10.0.2.2:8787

# a physical device on the same LAN
flutter run --dart-define=HAMOLUS_API_ORIGIN=http://mac.lan:8787
```

Other useful commands:

```bash
flutter test        # tests the REST client with MockClient, no network
dart analyze        # static analysis
```

Values are passed with `--dart-define`, not with a `.env` file — Dart has no `.env` loader,
and `String.fromEnvironment` is read at compile time, so no code can leak secrets into a
production binary.

## Deliberate limitations

- **No state management.** Data is fetched while a frame is built and dropped on the next
  one. For a real app, use `provider`, `riverpod`, or `bloc` — but that is not part of the
  Hamolus integration pattern.
- **No login.** The endpoints used here are public. If the app needs to write, it needs
  authentication that does not exist for that case yet; see the note in
  [`../../../sites/README.md`](../../../sites/README.md).
- **No attachments.** Private assets need a signed URL, and that mechanism exists in
  `@hamolus/panel` for the browser — there is no Dart equivalent yet.
- **No platform folders.** `flutter create .` is preparation, not part of the example. The
  folders it generates are never committed either, so `flutter run` fails with
  "no supported devices" until you run that command.
