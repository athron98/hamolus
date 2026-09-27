# {{PROJECT_LABEL}} console

The Hamolus admin console for {{PROJECT_LABEL}}, served as a static Vite app on
Cloudflare Workers. All of the UI comes from `@hamolus/console`; this app owns the
shell around it.

```
src/main.ts        mount() the console
console.config.ts  build-time preferences (locale fallback)
```

## Develop

```bash
pnpm install
pnpm dev           # http://localhost:5173
```

The console asks you which core to talk to on first load (the **API endpoint** menu
in the navbar) and remembers it per browser, so there is no base URL to configure
here. `pnpm dev` serves the app on its own; nothing needs to be running locally
unless you want a core on this machine.

## Build and deploy

```bash
pnpm typecheck
pnpm build         # → dist/
pnpm deploy        # wrangler deploy (static assets, no Worker script)
```

Deploying creates a Workers Static Assets deployment — no D1, KV or R2, and no
secrets. The console holds no credentials of its own: it signs in against the core
and the token lives in the browser.

The core this console points at decides its own `PUBLIC_GETS` and mode. For a
local core, run it on port 8787 and use `http://localhost:8787/api` as the endpoint.

## Add your own front end later

This app is one client of the core. A public site reads the same collections and
settings through the same API — the console is only where you *edit* things.
