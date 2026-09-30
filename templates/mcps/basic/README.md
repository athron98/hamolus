# MCP server

Model Context Protocol server for **{{PROJECT_LABEL}}** — exposes the core API as
tools so an AI agent (opencode, Claude, …) can drive the data directly.

Every tool ships in the `@hamolus/mcp` package; `src/index.ts` is only the seam
that hands it to Wrangler, so you can wrap the server without forking anything.

## Run locally

```bash
pnpm install
pnpm dev                      # http://localhost:8788/mcp
```

`pnpm typecheck` type-checks the generated worker, `pnpm build` runs Wrangler's
dry-run build so CI catches bundling problems before a deploy.

## Set it up

Two variables, and no secrets:

| Variable | What it is |
| --- | --- |
| `CORE_API_URL` | The core's `/api` base, e.g. `https://example-core.<account>.workers.dev/api` |
| `MCP_INSTANCE_ID` | The id of the instance you created in the console (Environment -> MCP) |

That is the whole configuration surface, and it is small on purpose. The instance
id is a handle to one row in the core; everything that row decides — which land
and colony, read-only or not, which tool groups register, which tokens are
accepted — lives in the core and is edited from the console. Change any of it and
this server picks it up within a minute, with no redeploy.

Because the instance decides the permissions, "read-only" here means the core
refuses the write, not that the server declined to offer the tool.

## Connect an agent

The endpoint is `POST /mcp` (Streamable HTTP, stateless). Your client must accept
both `application/json` and `text/event-stream`.

Issue a token in the console (MCP -> your instance -> New token) and send it as
the bearer. The server exchanges it for a short-lived session, so a token you
revoke stops working within 15 minutes and never has to be rotated in Wrangler.

For opencode, add to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "mcp": {
    "{{PROJECT_NAME}}": {
      "type": "remote",
      "url": "https://{{PROJECT_SLUG}}-mcp.<your-account>.workers.dev/mcp",
      "headers": { "Authorization": "Bearer <token from the console>" },
      "enabled": true
    }
  }
}
```

Check the wiring at any time with `GET /` on the worker: it reports the instance
it is bound to and whether it is in `console-managed` or the deprecated
`legacy` mode.

## Coming from the admin-key setup

Earlier versions held `CORE_ADMIN_KEY` — a platform-wide key that reached every
land and colony, with read-only as a promise the worker made. Deployments without
`MCP_INSTANCE_ID` still run that path so nothing breaks on upgrade; `GET /` warns
you. To migrate: create an instance in the console, set `MCP_INSTANCE_ID`, deploy,
then delete the `CORE_ADMIN_KEY` and `MCP_BEARER_TOKEN` secrets. The core keeps
accepting the old path for as long as any deployment needs it.
