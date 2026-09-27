# @hamolus/plugin-console-todo

A **console plugin**: a standalone workspace package that ships a Solid page, its KV
logic, and the finished descriptor. `hamolus add plugin todo` declares this package in the
console's `package.json` and appends it to the console's `console.config.ts` — it copies
nothing into the project.

- **Source of truth:** `src/`, published as `dist/` — compiled JavaScript, a compiled
  stylesheet, and types. `pnpm -F @hamolus/plugin-console-todo build`.
- **Contract:** `@hamolus/plugin-console-contracts` (types from the root, tokens from
  `/styles.stylex.ts`).
- **The package exports the descriptor**, `todoPlugin`, not just the page: identity
  (`id`, `name`, `description`, `icon`) lives here, because `console.config.ts` lists
  descriptors and the console ships as a bundle a host cannot edit. `TodoPlugin` stays
  exported by name for anyone rendering the page directly, and the default export is the
  descriptor.

Registering it by hand is one line:

```ts
import { todoPlugin } from '@hamolus/plugin-console-todo'
export const config = defineConsoleConfig({ plugins: [todoPlugin] })
```

## Why the package is built

A host registers a plugin from `console.config.ts` and does nothing else, so a plugin that
published raw `.tsx` and `styles.stylex.ts` would force every host to add
`vite-plugin-solid` and a StyleX compiler to build it. Building here keeps `vite.config.ts`
of a host console empty, and `src/index.css` plus `vite.lib.config.ts` exist so the compiled
stylesheet is emitted next to the JavaScript and imported by the entry chunk — the host's
bundler then picks the styles up on its own, and `sideEffects` keeps it from being dropped.

`solid-js` and `solid-js/web` are left external on purpose. A plugin is Solid code running
inside the console's render tree, so it has to share the console's Solid instance; a second
copy would put every `createMemo` in this package outside the console's reactive graph,
where it would never be tracked.

Run `pnpm -F @hamolus/plugin-console-todo typecheck` after edits, and
`node packages/cli/scripts/check-plugin-config.mjs` to check the packaging as a whole.
