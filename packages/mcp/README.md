# @hamolus/mcp

Model Context Protocol server for Hamolus. It exposes the core API — collections,
records, media, files, panels, lands — as MCP tools over Streamable HTTP on
Cloudflare Workers, so an AI agent can read and write your data directly.

## Use it

```bash
hamolus add mcp        # copy this server into ./mcp
```

## Configure

| Variable | Purpose |
| -------- | ------- |
| `CORE_API_URL` | base URL of the core API |
| `CORE_API_TOKEN` | bearer token; omit to mint one from `CORE_ADMIN_KEY` |
| `CORE_ADMIN_KEY` | admin key used to mint a token when no token is set |
| `CORE_LAND` / `CORE_COLONY` | default scope for every request |
| `MCP_BEARER_TOKEN` | when set, clients must send `Authorization: Bearer …` |
| `MCP_READONLY` | `true` refuses every write tool |

Every tool also accepts `land`/`colony` to override the default scope per call.

## Reference

- [MCP server](docs/mcp.md)

## License

MIT
