# @hamolus/plugin-console-todo

A **console plugin**: a standalone workspace package that ships a Solid page plus its KV
logic. `hamolus add plugin todo --source <dir>` copies `src/` into
`console/src/plugins/todo/` and writes a registry entry.

- **Source of truth:** `src/` (published as raw TypeScript — the host app compiles it).
- **Contract:** `@hamolus/plugin-console-contracts` (types from the root, tokens from
  `/styles.stylex.ts`).
- **The package exports a component**, not a descriptor: identity (`id`, `name`,
  `description`, `icon`) lives in the console's registry entry, which the CLI writes.

Run `pnpm -F @hamolus/plugin-console-todo typecheck` after edits.
