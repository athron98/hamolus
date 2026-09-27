# @hamolus/plugin-console-kanban

A **console plugin**: a standalone workspace package that ships a Solid page, its KV
logic, and the finished descriptor. `hamolus add plugin kanban` declares this package in
the console's `package.json` and appends it to the console's `console.config.ts` — it
copies nothing into the project.

- **Source of truth:** `src/`, published as `dist/` — compiled JavaScript, a compiled
  stylesheet, and types. `pnpm -F @hamolus/plugin-console-kanban build`.
- **Contract:** `@hamolus/plugin-console-contracts` (types from the root, tokens from
  `/styles.stylex.ts`).
- **The package exports the descriptor**, `kanbanPlugin`, not just the page: identity
  (`id`, `name`, `description`, `icon`) lives here, because `console.config.ts` lists
  descriptors and the console ships as a bundle a host cannot edit. `KanbanPlugin` stays
  exported by name for anyone rendering the page directly, and the default export is the
  descriptor.

Registering it by hand is one line:

```ts
import { kanbanPlugin } from '@hamolus/plugin-console-kanban'
export const config = defineConsoleConfig({ plugins: [kanbanPlugin] })
```

Run `pnpm -F @hamolus/plugin-console-kanban typecheck` after edits, and
`node packages/cli/scripts/check-plugin-config.mjs` to check the packaging as a whole. The
package is built rather than published as raw TypeScript so a host never has to add
`vite-plugin-solid` or a StyleX compiler — see the todo plugin's README for the reasoning.
