# consoles

Example **admin consoles** for Hamolus.

A console is not an application you write by hand. `@hamolus/console` ships as a library —
a ready-made Vite bundle plus its stylesheet — so a hosted console only does three things:
install the package, import the stylesheet, and call `mount()`.

The consequence is that almost nothing is editable in the host. This is:

| Layer | What can be changed |
| --- | --- |
| `console.config.ts` | host-level preferences, validated strictly — including the plugin list |
| `src/main.ts` | the target element, the config, HMR |
| Config → Users | credentials, at runtime |
| Config → Universe | the land and colony the session uses |
| `console.config.ts` | which plugins are shipped |

## Examples here

| Folder | What it demonstrates |
| --- | --- |
| [`with-plugins`](with-plugins) | plugins registered from `console.config.ts` alone, and the plugin contracts |

## Running

```bash
cd examples/consoles/with-plugins
pnpm install
pnpm dev        # http://localhost:5176
```

There is no env to fill in. The console is told where its API lives through the endpoint
menu in the navbar and remembers it per browser, so one build works against a preview, a
staging core, or production.

## How it differs from a panel

Both are internal tools, but their scope is completely different:

- **The console** is generic and complete: collections, records, media, documents, users,
  seed, panels, config. One console is enough to run a whole core.
- **A panel** is narrow and manifest-driven: one panel per team need, with ACLs per role,
  per view, per operation. A non-technical team can be given access to one screen without
  being given access to the whole system.

Both can run side by side on the same core.
