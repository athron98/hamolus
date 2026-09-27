# examples/apps/flutter

Example **Flutter** mobile app that reads data from a Hamolus core.

| Folder | What it demonstrates |
| --- | --- |
| [`accounting`](accounting) | a dependency-free Dart REST client, core-owned locales, models that tolerate new fields |

## Running

```bash
cd examples/apps/flutter/accounting
flutter run --dart-define=HAMOLUS_API_ORIGIN=http://localhost:8787
```

It needs the Flutter SDK and a running Hamolus core. There is no `.env` file: the
configuration is passed with `--dart-define`, whose values are read at compile time and end
up inlined into the binary.

## Why only one example

The Flutter example here is deliberately not a hotel, a shop, or a CRM. All of those would
repeat the same client with a different data shape, and what would differ is the UI
pattern, not the way you integrate with Hamolus. Once the client reads clearly, the rest
is ordinary application work.
