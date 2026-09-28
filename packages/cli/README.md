# @hamolus/cli

Scaffold and extend Hamolus projects: cores, consoles, panels, MCP servers, public sites,
plugins, seeds and deployment configurations.

```bash
npx @hamolus/cli init
# or, the same wizard:  npm create hamolus@latest
```

`init` asks twelve questions and then runs the real `create` and `add` commands. Every question
has a flag, and a question whose flag is present is not asked — so it is a set of
scriptable defaults rather than a form. `hamolus init --help` lists all ten.

## Commands

```
hamolus init [name]                     The guided path; what npm create runs
hamolus create <name>                   Create a project (with a core)
hamolus add console                     Admin app
hamolus add panel <name>                A panel app
hamolus add mcp                         MCP server for AI agents
hamolus add site <name>                 A public site (astro | nextjs)
hamolus add plugin <name>               A console plugin
hamolus add seed <name>                 Seed script
hamolus add configuration <name>        wrangler/KV preset
hamolus link <path>                     Point @hamolus/* at a local checkout
hamolus link --clear                    Back to registry ranges
hamolus list                            What this project contains
```

Common options: `-o, --output <path>`, `--mode <independent|centralized|proxy|bridge>`,
`--core <basic|predefined>`, `--core-name <name>`, `--host <address>`, `--jwt <secret>`,
`--key <secret>`, `--land <name>`, `--colony <name>`, `--console`, `--mcp`,
`--site <framework>`, `--template <path>`, `--link <path>`, `--force`, `--dry-run`,
`-y, --yes`.

`--source <path>` and `--package <name>` are no longer accepted by `hamolus add console`
or `hamolus add plugin`. Both depend on their `@hamolus/*` package instead of copying a
source tree, and for a plugin that is the point: vendored plugin source would only build if
the host console added `vite-plugin-solid` and a StyleX compiler. Use `--template <dir>` to
point at a different template, or `hamolus link <path>` to develop against a local
checkout.

`--core` picks the named core template: `basic` ships no schema, `predefined` ships a
collection and a panel under `core/src/`. It cannot be combined with `--template`, which
already names a directory of its own.

## Local secrets

`--jwt` and `--key` write `core/.dev.vars` with a working `JWT_SECRET` and `ADMIN_KEY`, so
`pnpm dev` runs immediately. Pass either one and the pair is completed for you; pass neither
and no `.dev.vars` is written at all. `hamolus init` generates both when you leave them
blank. The file is git-ignored — anything you deploy wants `wrangler secret put`.

## The dev host

`--host` is the address the generated dev servers bind to, and it is written into each
part's `dev` script rather than left implicit: `wrangler dev --ip`, `vite --host`,
`astro dev --host`, `next dev --hostname`. One flag, four scripts, and "why can my phone
not open this" answered by a file. `0.0.0.0` exposes the stack on the LAN; a site generated
for a LAN project still points at `localhost:8787`, because `0.0.0.0` is a bind address and
not a destination.

## Sites

`hamolus add site <name>` generates a public site that reads the core over REST with a
hand-written client — no `@hamolus/*` runtime in a public bundle. Two templates ship:
`astro` (static, fetched at build time) and `nextjs` (App Router, cached). Both refuse to
build when the core is unreachable rather than deploying an empty site.

A site is the one part that never authenticates, so it needs a core with `PUBLIC_GETS` on.
Every non-`independent` mode sets it to `false`, and `hamolus add site` says so when it adds
a site to one.

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

`hamolus init` — the guided path, and what `npm create hamolus@latest` runs.
`hamolus add site` with Astro and Next.js templates, `--core-name`, `--host`, and
generated `@hamolus/*` at `^0.2.1`.

See the [changelog](https://github.com/hamolus-labs/hamolus/blob/main/CHANGELOG.md#unreleased) for every release.

## License

MIT
