# `examples/apps/flutter/accounting` — Flutter accounting app

A Flutter example that reads double-entry journal entries from a Hamolus core. It
exists to show what a **non-React, non-JS host** looks like: a hand-written REST client
over plain `GET` calls, no framework glue, and the same three rules every other host in
`examples/` follows.

## Not a workspace member

`examples/` is not in `pnpm-workspace.yaml`, and this project is a **Dart** package
beside it. Nothing here is installed or built by the repository's pnpm scripts, and
`pnpm typecheck` / `pnpm build` from the root deliberately ignore it.

```bash
flutter pub get
flutter analyze          # or: dart analyze
flutter test
flutter run -d chrome
```

Requires Flutter with Dart `>=3.5.0 <4.0.0`.

## Layout

| Path | Holds |
| ---- | ----- |
| `lib/main.dart` | the app entry and the journal list screen |
| `lib/journal_page.dart` | the UI: entry rows, totals, empty and error states |
| `lib/hamolus_client.dart` | the REST client: origin normalisation, `listRecords`, `getRecord`, `getLocalization` |
| `lib/accounting_repository.dart` | the layer between the client and the widgets |
| `test/hamolus_client_test.dart` | the client tests, run with `MockClient` — no network |

## The core it expects

A core created with a seed that defines the accounting collections and a
**`journal` view declared `public: true`**, because this app sends no token at all.
Against a core in any other mode, every request answers `FORBIDDEN`. That is the
expected result, not a bug to work around.

Point it at a core with `--dart-define`:

```bash
flutter run --dart-define=HAMOLUS_ORIGIN=http://localhost:8787
```

## Invariants

- **Never send an `Authorization` header.** The core's auth middleware demands a valid
  JWT the moment that header appears, so sending it without a token breaks a request
  that would otherwise succeed. The test
  `'never sends an Authorization header'` is the guard; do not "fix" it by adding auth
  to this example.
- **`package:http`, not `dart:io`'s `HttpClient`.** This example runs on desktop *and*
  web, and `dart:io` does not exist on the web. The client must have one implementation
  for both. `Client` is also injectable, which is what makes the tests networkless.
- **The base URL is normalised once** — `/api` is appended when missing, trailing
  slashes are stripped, and it is not appended twice. Getting configuration wrong should
  not be possible.
- **Queries go through `Uri`, never string concatenation.** Collection names and filter
  values can contain characters that need escaping; hand-assembled URLs break silently.
- **An explicit timeout and cancellation are not optional here.** A Dart client that
  hangs on a dead core leaves a spinner forever; that is the difference from the JS
  examples and it is the reason this file exists.
- A core error becomes a catchable exception carrying `status` and `code`, so the UI can
  tell "no such record" from "the core is down".
- `getLocalization()` returns `null` on a 404 and on an empty language list — a core
  without localization configured is normal, not an error.

## Conventions

- One-line copyright notice at the top of every Dart file, after any `library;` /
  doc comment position the language requires. `pnpm check:copyright` from the repository
  root covers `examples/**` and will fail without it.
- Comments are English and explain the *why* — the three rules above are the model.
- Commit messages follow Conventional Commits; the scope for this directory is
  `examples`.
