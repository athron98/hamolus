# panels

Example **panel** apps: internal tools built on SolidJS that read and write data through
`@hamolus/panel`, with their screens defined by a panel manifest on the core.

A panel is neither the console nor a site:

| | Panel | Console | Site / app |
| --- | --- | --- | --- |
| Screen surface | manifest per panel | generic | the app's own |
| Access | ACL per role, per view, per operation | full admin login | usually public |
| Client | `@hamolus/panel` | `@hamolus/console` | `fetch` against the core REST API |
| Token | required | from the login form | not needed |

So one core can serve a full console for administration, and several small panels that
open only part of the data to a smaller team.

## Examples here

| Folder | What it shows |
| --- | --- |
| [`seo-dashboard`](seo-dashboard) | a `dashboard` view (metrics) plus a `table` view (table and search) |
| [`inventory`](inventory) | writing data: `updateRecord`, optimistic updates, handling 403 |
| [`booking-kalendar`](booking-kalendar) | grouping by date, locale, and private assets |

## Running

```bash
# core first, in another terminal
pnpm hamolus create acme --core predefined
cd acme && pnpm install && pnpm hamolus add console && pnpm dev

# then, from this examples folder
cd examples/panels/<name>
cp .env.example .env.local     # fill in VITE_PANEL_API_TOKEN
pnpm install
pnpm dev
```

Each example uses its own port so they can be open at the same time:

| Example | Port |
| --- | --- |
| `seo-dashboard` | 5173 |
| `inventory` | 5174 |
| `booking-kalendar` | 5175 |

All of them bind to `0.0.0.0`, so they also work from another device via `mac.lan`.

## Rules every example here follows

- A panel does **not** decide access. The visible fields, the allowed operations, and the
  views on offer are all read from the manifest; a panel only renders what the core sends.
- The token travels only in `VITE_PANEL_API_TOKEN` (`.env.local`, never committed). When the
  token is empty, `missingTokenMessage` turns it into a message a user can read, instead of
  a `TypeError` from inside the SDK.
- Superseded requests are aborted, not ignored. Without that, fast typing would render the
  results of an old request.
- Nothing writes to `@hamolus/core` directly — that package is a Worker, not an SDK.
