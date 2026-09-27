# `@hamolus/plugin-console-todo` — the todo plugin

A per-land todo list, stored in the core's plugin KV. It is both a working feature and
the **reference implementation** of the console plugin contract: if you are writing a
plugin, read `src/TodoPage.tsx` before you read the contract docs.

## Built as a library into a host's console

`build` is a three-step chain and the order matters:

```bash
tsc --noEmit                    # typecheck the source
vite build --config vite.lib.config.ts   # JS + CSS
tsc -p tsconfig.lib.json        # emit dist/index.d.ts
```

`vite.lib.config.ts` marks **`solid-js` and `@hamolus/console` as external**. The host
console already has them; bundling a second copy would give the plugin a different Solid
runtime, and the JSX the plugin builds would never render. The same applies to
`@hamolus/plugin-console-contracts` — types plus a `definePlugin` helper, not code to
duplicate.

`prepack` runs the build before copying `LICENSE`, so a published tarball cannot contain
a stale `dist/`.

## Layout

| Path | Holds |
| ---- | ----- |
| `src/index.tsx` | the plugin descriptor `todoPlugin` and the raw `TodoPlugin` component |
| `src/TodoPage.tsx` | the whole page: list, filters, priorities, and its KV access |
| `src/index.css` | the plugin's own styles, built into `dist/index.css` |
| `tsconfig.lib.json` | declaration emit for the published `d.ts` |

## Invariants

- **The plugin id is the storage namespace.** `id: 'todo'` is what makes the core route
  `/_plugins/todo/*` to this plugin's KV. A host that retyped the id in its own config
  would point at an empty namespace while the sidebar showed a different name — which is
  why identity lives in the descriptor and `hamolus add plugin` only ever adds an import
  and one array element.
- **KV keys are `item:<id>`, and the list is the union of `kv.list()`.** There is no
  index document to keep in sync, so a deletion cannot leave a dangling reference. Keep
  it that way: a single "all items" blob would need a write on every mutation.
- **"Done" is a delete, not a flag.** Completed items are removed from KV, so there is
  no `done` column to migrate. If you need history, that is a schema change, not a UI
  change.
- **`props.kv` is already scoped and authenticated.** The console passes a client that
  carries the current land, colony and token. A plugin that opens its own `fetch` to the
  core loses the scope and breaks on a colony switch.
- **A land switch must reload from KV.** Read the store on mount and re-read when the
  scope changes; do not hold items in a module-level variable, or a user switching lands
  sees the previous land's list.
- Plugin CSS uses the shared tokens from
  `@hamolus/plugin-console-contracts/styles.stylex.ts` so the plugin follows the
  console's theme, palette and font. Do not hardcode colours.

## Gates

No gate script of its own. What pins this plugin is:

```bash
pnpm -F @hamolus/cli check:plugin-config   # the contract the console passes in
pnpm check:markers           # token drift against the console's index.css
pnpm typecheck && pnpm build
```

## Conventions

- Copyright/author/SPDX header verbatim (`pnpm check:copyright`).
- Each file's header states what a reader must not break — the KV key scheme, the
  external-solid rule, the deletion semantics.
- Comments are English; commit messages follow Conventional Commits with the package as
  the scope.
