# examples/apps

Example **mobile apps** that read data from the Hamolus core.

One platform for now: Flutter. If React Native or Kotlin is added later, add its folder
here with the same shape — `pubspec.yaml` or `build.gradle`, a `lib/` or `app/` folder, and
a `README.md`.

## What is shared with the site examples

Sites and mobile apps read the same things from the core, under the same rules:

- the endpoints are `GET /api/{collection}`, with the `page`, `pageSize`, `sortBy`,
  `sortDir`, `filter`, `locale`, and `search` query parameters;
- **no token**, as long as `PUBLIC_GETS` is still `true` on the core. Never send an
  `Authorization` header when you have no token — the moment that header appears, the auth
  middleware demands a valid JWT and a request that used to succeed starts failing;
- the response shape is `{ data, meta, lastUpdate }`, and errors are
  `{ error: { code, message } }`.

Only the transport and the lifecycle differ: an app has a network that drops, while a
static site fetches once at build time.

## Examples here

| Folder | Platform | What it demonstrates |
| --- | --- | --- |
| [`flutter/accounting`](flutter/accounting) | Flutter | REST client in Dart, locales from the core, models that survive new fields |

## What should not be written here

- **Writes without authentication.** A mobile app does not make public read endpoints
  writable. If that is needed, add authentication to the app first.
- **Private assets.** The signed URLs that panels use have no mobile counterpart yet. Until
  they do, assume attachment files live in public media.
- **Business aggregation inside the core.** The core computes `meta.total` and
  `lastUpdate`; it does not aggregate. The ledger is computed in the app.
