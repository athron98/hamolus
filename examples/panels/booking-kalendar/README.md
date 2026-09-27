# panels/booking-kalendar

A Hamolus example panel of the **calendar** kind: bookings are grouped by date, the language
can be switched, and attachments are fetched through signed URLs.

Example domain: a hotel reception checks the agenda day by day. Guests speaking different
languages see names and notes in their own language, and attachment files (confirmations,
invoices) only open for people who really have panel access.

## What it shows

- **Language belongs to the core.** `getLocalization()` is read once, then `locale` is sent
  with every `listRecords`. `VITE_PANEL_LOCALE` is only the first appearance; if its code is
  not in the core's list, the panel falls back to the core's `defaultLocale` rather than
  guessing.
- **Date filtering in the client, because the panel API has no filter.** `panelQuerySchema`
  in `@hamolus/types` accepts only `page`, `pageSize`, `search`, `locale`, `sortBy`, and
  `sortDir`. That schema is `strict`, so sending `filter` only earns you `INVALID_QUERY`.
  Dates are therefore filtered in the `visible` memo rather than in the core — and the limit
  has to be stated plainly: only the first 50 records take part in the filtering.
- **Grouping by date in the client.** The core returns a list of records; splitting it by
  date is a presentation concern.
- **Private assets.** `listAssets()` already returns a signed `url` along with its
  `expiresAt`; `getPanelAssetUrl()` picks between the display and the download URL, and
  `isPanelAssetExpired()` flags the ones that need refreshing.
- **`AbortController`** to abort requests that are no longer current when the user changes the
  date or the language.

## Prerequisites

A `bookings` collection with `booked_at`, `booked_date`, `customer_name`, `status`, and
`attachment` fields; plus a panel manifest with `id: 'booking'` and a single table view.

```jsonc
// POST http://localhost:8787/api/_panels
{
  "definition": {
    "id": "booking",
    "name": "Booking Calendar",
    "description": "Daily booking agenda",
    "menu": [{ "id": "agenda", "label": "Agenda", "viewId": "agenda" }],
    "views": [
      {
        "id": "agenda",
        "label": "Agenda",
        "kind": "table",
        "collection": "bookings",
        "searchable": false,
        "pageSize": 50,
        "fields": {
          "read": ["booked_at", "booked_date", "customer_name", "status", "attachment"],
          "write": ["status"]
        }
      }
    ],
    "roles": [
      { "id": "reception", "label": "Reception", "views": ["agenda"], "operations": ["read"] }
    ]
  }
}
```

For several languages, turn localization on in the core (`core.config.ts`, or the
Config → Localization screen) and fill in the localized fields such as `customer_name_id`,
`customer_name_en`. `locale=id` then asks for the `id` version, falling back to
`defaultLocale` when that has no content.

## Running

```bash
cd /path/to/acme && pnpm dev   # replace with the path to your core project

cd examples/panels/booking-kalendar
cp .env.example .env.local     # fill in VITE_PANEL_API_TOKEN
pnpm install
pnpm dev                       # http://localhost:5175
```

## Production notes

- The `pageSize: 50` here is enough for a single day, and the client-side date filtering
  works over those same 50 records. For a wide date range, fetch per date (a `for` loop
  with `await`) or add paging to the UI — and do not push `pageSize` past 100, which is the
  limit the core sets.
- `listAssets()` is called here for the whole view, not per record. That is wasteful for a
  long booking list; a better pattern is storing an `asset` that references an id and
  fetching its details when the row is clicked.
- Asset URLs have a short lifetime. A page left open a long time will find
  `isPanelAssetExpired() === true`; the "Refresh" button covers that without reloading the
  whole panel.
