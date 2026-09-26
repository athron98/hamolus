# @hamolus/plugin-console-contracts

Shared shapes and design tokens for Hamolus console plugins, split across two entry points
so a consumer only pays for what it uses:

| Entry point | Contents | Why |
| --- | --- | --- |
| `@hamolus/plugin-console-contracts` | types only (`KvClient`, `PluginPageProps`, `ConsolePlugin`, …) | a type-only consumer never pulls StyleX into its graph |
| `.../contracts/styles.stylex.ts` | `pluginTokens` + `ps` base styles | **raw TypeScript, never built to `dist`** |

The `.stylex.ts` extension in that subpath specifier is required, not decorative: the StyleX
compiler only transforms a theme module whose own file is named `*.stylex.ts`, and it deopts
before resolution on a bare specifier. The tokens must be compiled by the **consuming** app so
its palette CSS variables are emitted and the class names line up with the host's build.

Consuming apps must add the package to `optimizeDeps.exclude` in Vite — pre-bundling would
strip the theme file through esbuild, which cannot see it.
