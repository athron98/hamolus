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
`--core <basic|predefined>`, `--template <path>`, `--link <path>`, `--force`,
`--dry-run`, `-y, --yes`.

`--source <path>` and `--package <name>` are no longer accepted by `hamolus add console`
or `hamolus add plugin`. Both depend on their `@hamolus/*` package instead of copying a
source tree, and for a plugin that is the point: vendored plugin source would only build if
the host console added `vite-plugin-solid` and a StyleX compiler. Use `--template <dir>` to
point at a different template, or `hamolus link <path>` to develop against a local
checkout.

`--core` picks the named core template: `basic` ships no schema, `predefined` ships a
collection and a panel under `core/src/`. It cannot be combined with `--template`, which
already names a directory of its own.

## Source resolution

`--source` wins, then a part already in your project, then an installed
`@hamolus/*` package, then a linked checkout, and finally this repository. That
order is what lets a published CLI generate the same output as a local checkout.

## Templates

The canonical templates ship in `templates/`. `packages/cli/templates` is a copy
refreshed on `prepack` — edit `templates/`, never the copy.

A core is generated from a named directory: `templates/cores/<name>`, resolved in the
order `templates/cores/<--core>`, then `templates/cores/<--mode>`, then
`templates/cores/basic`. The resolved name is recorded as the core's `source` in
`hamolus.json`, so `hamolus list` can say where a core came from.

## What's new

Generated projects now pin `@hamolus/*` at `^0.2.0`, and `hamolus add plugin` picks
the right range per plugin instead of assuming every `@hamolus/*` package shares a
version.

See the [changelog](https://github.com/hamolus-labs/hamolus/blob/main/CHANGELOG.md#020--2026-09-28) for every release.

## License

MIT
