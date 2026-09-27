# `@hamolus/plugin-console-kanban` — the kanban plugin

A drag-and-drop kanban board stored as a **single KV document per land**. It is the
second reference implementation of the console plugin contract, next to
`@hamolus/plugin-console-todo`.

## Built as a library into a host's console

Same three-step chain as the todo plugin, and the same reason for the order:

```bash
tsc --noEmit
vite build --config vite.lib.config.ts
tsc -p tsconfig.lib.json
```

`vite.lib.config.ts` marks **`solid-js` and `@hamolus/console` as external**. The host
console already ships them; a bundled second Solid runtime means the plugin's JSX is
built against an instance the host tree never renders. `@hamolus/plugin-console-contracts`
is external for the same reason.

`prepack` builds before copying `LICENSE`, so a published tarball never contains a stale
`dist/`.

## Layout

| Path | Holds |
| ---- | ----- |
| `src/index.tsx` | the plugin descriptor `kanbanPlugin` and the raw `KanbanPlugin` component |
| `src/KanbanPage.tsx` | the board: columns, cards, drag-and-drop, and its KV access |
| `src/index.css` | the plugin's own styles, built into `dist/index.css` |
| `tsconfig.lib.json` | declaration emit for the published `d.ts` |

## Invariants

- **One document, not a set.** The whole board is one value at KV key `board`, read on
  mount and written on every move. That is fine at this size and it is the reason a
  drag is a single `kv.set`. If the board ever needs per-card permissions, incremental
  sync, or concurrent editors, this has to become a list of documents — at which point
  the last writer wins silently and you will need a revision guard.
- **The id is the storage namespace.** `id: 'kanban'` is what routes `/_plugins/kanban/*`
  to this plugin. Identity lives in the descriptor so a host cannot retype it and end up
  pointing at a different namespace than the sidebar shows. It also keeps this plugin's
  namespace disjoint from the todo plugin's.
- **`props.kv` is already scoped and authenticated** — the console passes a client bound
  to the current land, colony and token. Do not open your own `fetch` to the core: you
  lose the scope and a colony switch silently shows the wrong board.
- **A land switch must reload the document.** The board is read on mount and re-read when
  the scope changes; keeping it in a module-level variable shows the previous land's data.
- **The write is optimistic-but-single.** A drag updates local state and issues one
  `kv.set`. If a write fails, say so — the UI is now ahead of KV and a refresh will
  disagree with what the user sees.
- Styling comes from `@hamolus/plugin-console-contracts/styles.stylex.ts`, so the board
  follows the console's theme, palette and font. Do not hardcode colours.

## Gates

No gate script of its own. What pins this plugin is:

```bash
pnpm -F @hamolus/cli check:plugin-config   # the contract the console passes in
pnpm check:markers           # token drift against the console's index.css
pnpm typecheck && pnpm build
```

## Conventions

- Copyright/author/SPDX header verbatim (`pnpm check:copyright`).
- Each file's header states what a reader must not break — the single-document storage
  model, the external-solid rule, the id-as-namespace rule.
- Comments are English; commit messages follow Conventional Commits with the package as
  the scope.
