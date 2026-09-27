# MCP server

Model Context Protocol server for **{{PROJECT_LABEL}}** — exposes the core API as
tools so an AI agent (opencode, Claude, …) can drive the data directly.

Every tool ships in the `@hamolus/mcp` package; `src/index.ts` is only the seam
that hands it to Wrangler, so you can wrap the server without forking anything.

## Run locally

```bash
pnpm install
cp .env.example .dev.vars     # fill in CORE_API_URL + auth
pnpm dev                      # http://localhost:8789/mcp
```

`pnpm typecheck` type-checks the generated worker, `pnpm build` runs Wrangler's
dry-run build so CI catches bundling problems before a deploy.

## Connect an agent

The endpoint is `POST /mcp` (Streamable HTTP, stateless). Your client must accept
both `application/json` and `text/event-stream`.

For opencode, add to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "mcp": {
    "{{PROJECT_NAME}}": { "type": "remote", "url": "http://localhost:8789/mcp", "enabled": true }
  }
}
```

## Safety

- `MCP_READONLY=true` disables every write tool.
- `MCP_BEARER_TOKEN` gates the endpoint. Without it, anyone who knows the URL can
  call it with whatever core credentials the server holds.
- Prefer a scoped user token over the core admin key.
