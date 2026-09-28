# @hamolus/plugin-console-contracts

Types and shared StyleX design tokens for Hamolus console plugins.

A console plugin exports a `ConsolePlugin` — id, name, description, icon, and the page
component together — and receives a `PluginPageProps` bundle: that same descriptor, a
`KvClient` scoped to the plugin, the current permissions, and shared tools. Plugins
persist their state through `KvClient`, so a plugin needs no backend of its own.

```ts
import type { ConsolePlugin } from '@hamolus/plugin-console-contracts'
import { pluginTokens } from '@hamolus/plugin-console-contracts/styles.stylex.ts'

export const todoPlugin: ConsolePlugin = {
  id: 'todo',
  name: 'Todo list',
  description: 'A shared todo list',
  component: TodoPage,
}
```

A plugin is registered by listing that descriptor in the console's `console.config.ts`:

```ts
import { defineConsoleConfig } from '@hamolus/types'
import { todoPlugin } from '@hamolus/plugin-console-todo'

export const config = defineConsoleConfig({ plugins: [todoPlugin] })
```

That is the entire registration. `mount({ config })` hands the list to the console,
which registers it before the first render, so the plugin shows up under `/plugins` and
in the sidebar's Plugins group. `hamolus add plugin <name>` appends to the same array,
between the `hamolus:plugins:imports:*` and `hamolus:plugins:*` marker comments — the
command rewrites only the text between each pair, so keep the markers byte-identical.

Why the descriptor lives in the plugin rather than in the host: the console ships as a
Vite bundle, so a host cannot edit a registry inside it, and a host that retyped `id` in
its own config could disagree with the KV prefix the plugin writes to.

Import the token **values** through the `*.stylex.ts` path (`src/styles.stylex.ts`)
rather than the package root: the StyleX build plugin resolves theme files only when
the specifier ends in `.stylex.ts`.

## What's new

Versioned independently of the core packages, and unchanged in this release.
See the [changelog](https://github.com/hamolus-labs/hamolus/blob/main/CHANGELOG.md#022--2026-09-28) for every release.

## License

MIT
