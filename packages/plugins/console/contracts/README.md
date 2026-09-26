# @hamolus/plugin-console-contracts

Types and shared StyleX design tokens for Hamolus console plugins.

A console plugin declares a `ConsolePlugin` (id, name, description, icon) and
receives a `PluginPageProps` bundle: the plugin descriptor, a `KvClient` scoped to
that plugin, the current permissions, and shared tools. Plugins persist their state
through `KvClient`, so a plugin needs no backend of its own.

```ts
import type { ConsolePlugin } from '@hamolus/plugin-console-contracts'
import { pluginTokens } from '@hamolus/plugin-console-contracts/styles.stylex.ts'
import { TodoPage } from '@hamolus/plugin-console-todo'

export const todoPlugin: ConsolePlugin = {
  id: 'todo',
  name: 'Todo list',
  description: 'A shared todo list',
  component: TodoPage,
}
```

A plugin is registered in the console's `src/plugins/registry.ts` between the
`hamolus:plugins:imports:*` and `hamolus:plugins:*` marker comments — `hamolus add
plugin <name>` rewrites only the text between each pair, so keep the markers
byte-identical.

Import the token **values** through the `*.stylex.ts` path (`src/styles.stylex.ts`)
rather than the package root: the StyleX build plugin resolves theme files only when
the specifier ends in `.stylex.ts`.

## License

MIT
