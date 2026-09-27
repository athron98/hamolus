# panels/inventory

An example Hamolus panel that **writes** data: a warehouse stock list, edit the numbers,
save.

Example domain: a warehouse operator recounts stock from a phone. This panel is opened so
the operator does not need the full console, and only sees one view with one editable field.

## What it shows

- `updateRecord(panelId, viewId, recordId, input)` — writes through the **view**, not the
  collection. The core decides whether that is allowed; fields outside `fields.write` get
  a 403.
- **Optimistic update with rollback.** The new number shows immediately; if the core
  rejects it, the old value is restored and the error is shown per row.
- **The row the core returns is used, not the local input.** The core fills in derived
  fields such as `updated_at` or `updated_by`, so the local input is not the source of
  truth.
- One failure does not empty the table: errors are kept per `recordId`.
- `AbortController` to abort search requests that are no longer current.

## Prerequisites

A panel manifest with `id: 'inventory'` that has a table view:

```jsonc
// POST http://localhost:8787/api/_panels
{
  "definition": {
    "id": "inventory",
    "name": "Inventory",
    "description": "Recount warehouse stock",
    "menu": [{ "id": "products", "label": "Products", "viewId": "products" }],
    "views": [
      {
        "id": "products",
        "label": "Products",
        "kind": "table",
        "collection": "products",
        "searchable": true,
        "pageSize": 25,
        "fields": { "read": ["sku", "name", "quantity"], "write": ["quantity"] }
      }
    ],
    "roles": [
      { "id": "operator", "label": "Operator", "views": ["products"], "operations": ["read", "update"] }
    ]
  }
}
```

The `products` collection needs `sku`, `name`, and `quantity` fields. If `quantity` is
missing from `fields.write`, the operator sees a locked input — that is the correct
behaviour, not a bug.

## Running

```bash
# core running
cd /path/to/acme && pnpm dev   # replace with the path to your core project

# panel
cd examples/panels/inventory
cp .env.example .env.local     # fill in VITE_PANEL_API_TOKEN (an account with update rights)
pnpm install
pnpm dev                       # http://localhost:5174
```

## Production notes

- After `updateRecord` succeeds, the other rows in the table do **not** refresh on their
  own. If other records depend on this field (say a `status` the core computes), call
  `listRecords` again — this example does not, so the change is easy to follow.
- `saving()` stops a double click on the same row, but it does not lock the table. For
  several operators at once, consider the `lastUpdate` from the list response
  (`GET /api/{collection}/__lastUpdate`) to detect conflicts.
- The panel does not upload media. For private assets inside a panel, use
  `getPanelAssetUrl()` from `@hamolus/panel` — the pattern is shown in
  [`booking-kalendar`](../booking-kalendar).
