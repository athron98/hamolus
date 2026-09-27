# panels/seo-dashboard

A Hamolus example panel of the **dashboard** kind: metric cards from a `dashboard` view,
then a table of records from a `table` view below it.

Example domain: a content team watches the article count, the number of articles with no meta
description, and the average article length — all computed by the core from a single
collection.

## What it shows

- `createPanelClient()` — one client for bootstrap, metrics, and the record list.
- `bootstrap(panelId)` — the views, the readable fields, and the allowed operations come from
  the panel manifest on the core. The panel declares no access of its own.
- `getDashboardMetrics(panelId, viewId)` for a `dashboard` view.
- `listRecords(panelId, viewId, query)` for a `table` view, including `search`.
- Request cancellation: a new search aborts the previous request through `AbortController`.

## Prerequisites

A core that already has a panel with `id: 'seo'`. A panel can be made in the console
(Config → Panels), or defined in source via `hamolus create --core predefined` and then
edited in `core/src/panels/`.

## Running

```bash
# 1. core running in another terminal
cd /path/to/acme && pnpm dev   # replace with your core project path  # http://localhost:8787

# 2. panel
cd examples/panels/seo-dashboard
cp .env.example .env.local       # fill in VITE_PANEL_API_TOKEN
pnpm install
pnpm dev                        # http://localhost:5173
```

The token comes from `POST /api/_auth/login`:

```bash
curl -s http://localhost:8787/api/_auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"..."}' | jq -r .data.token
```

## If you would rather not create the panel by hand

A panel can be created through the API. The minimum manifest this example needs:

```jsonc
// POST http://localhost:8787/api/_panels
{
  "definition": {
    "id": "seo",
    "name": "SEO Dashboard",
    "description": "Article SEO monitoring",
    "menu": [{ "id": "overview", "label": "Overview", "viewId": "overview" }],
    "views": [
      {
        "id": "overview",
        "label": "Overview",
        "kind": "dashboard",
        "metrics": [
          { "id": "total", "label": "Total articles", "operation": "count" },
          { "id": "missing", "label": "No description", "operation": "count",
            "filter": { "meta_description": { "op": "eq", "value": "" } } }
        ]
      },
      {
        "id": "articles",
        "label": "Articles",
        "kind": "table",
        "collection": "articles",
        "searchable": true,
        "pageSize": 25,
        "fields": { "read": ["title", "slug", "meta_description"], "write": ["title"] }
      }
    ],
    "roles": [{ "id": "editor", "label": "Editor", "views": ["overview", "articles"], "operations": ["read"] }]
  }
}
```

Match `metrics` and `fields` to the collection that actually exists in your core — a field
name in the manifest has to be exactly the field name in the collection definition.

## How this differs from the generator template

`hamolus add panel seo` produces a far more complete app: an asset loader, a theme
switcher, a sidebar, paging, a form editor, relation options, and media upload. The
`App.tsx` here leaves all of that out so the data flow — bootstrap, metrics, table, request
cancellation — fits on one screen. Start here when you want a reference; use the generator
output when you need the full set of features.
