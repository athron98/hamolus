# @hamolus/cli

Scaffold and extend Hamolus projects: cores, consoles, panels, MCP servers, plugins,
seeds and deployment configurations.

```bash
npm i -g @hamolus/cli
hamolus create acme
cd acme && pnpm install
```

## Commands

```
hamolus create <name>                    Create a project (with a core)
hamolus add console                      Admin app
hamolus add panel <name>                 A panel app
hamolus add mcp                          MCP server for AI agents
hamolus add plugin <name>                A console plugin
hamolus add seed <name>                  Seed script
hamolus add configuration <name>         wrangler/KV preset
hamolus link <path>                      Point @hamolus/* at a local checkout
hamolus link --clear                     Back to registry ranges
hamolus list                             What this project contains
```

Common options: `-o, --output <path>`, `--mode <independent|centralized|proxy|bridge>`,
`--template <path>`, `--source <path>`, `--package <name>`, `--link <path>`,
`--force`, `--dry-run`, `-y, --yes`.

## Source resolution

`--source` wins, then a part already in your project, then an installed
`@hamolus/*` package, then a linked checkout, and finally this repository. That
order is what lets a published CLI generate the same output as a local checkout.

## Templates

The canonical templates ship in `templates/`. `packages/cli/templates` is a copy
refreshed on `prepack` — edit `templates/`, never the copy.

## License

MIT
