# @hamolus/panel

Framework-neutral browser client for the Hamolus Panel API: bootstrap, records,
relations, dashboard metrics and private asset URLs. Generated panel apps
(`hamolus add panel <name>`) build on it.

## Use it

```ts
import { PanelClient } from '@hamolus/panel'

const client = new PanelClient({
  apiBase: 'https://api.example.com',
  token: import.meta.env.VITE_PANEL_API_TOKEN,
  land: import.meta.env.VITE_PANEL_LAND,
  colony: import.meta.env.VITE_PANEL_COLONY,
})

const manifest = await client.bootstrap('basic')
const page = await client.listRecords('basic', 'products', { page: 1, pageSize: 20 })
```

`PanelClient` normalizes API envelopes and errors, so a generated app can render
manifest-driven views without touching raw `fetch`. A token is required; the
constructor throws `PanelError` without one.

## Private assets

Panel media, documents and attachments are private. The client requests short-lived
signed URLs from the API; a configured `PANEL_ASSET_SECRET` (falling back to
`JWT_SECRET`) signs them.

## Reference

- [Panels](docs/panels.md)

## What's new

No change in this release.

See the [changelog](https://github.com/hamolus-labs/hamolus/blob/main/CHANGELOG.md#020--2026-09-28) for every release.

## License

MIT
