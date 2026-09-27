# @hamolus/plugin-console-contracts

Shared shapes and design tokens for Hamolus console plugins, split across two entry points
so a consumer only pays for what it uses:

| Entry point | Contents | Why |
| --- | --- | --- |
| `@hamolus/plugin-console-contracts` | types only (`KvClient`, `PluginPageProps`, `ConsolePlugin`, …) | a type-only consumer never pulls StyleX into its graph |
| `.../contracts/styles.stylex.ts` | `pluginTokens` + `ps` base styles | **raw TypeScript, never built to `dist`** |

The `.stylex.ts` extension in that subpath specifier is required, not decorative: the StyleX
compiler only transforms a theme module whose own file is named `*.stylex.ts`, and it deopts
before resolution on a bare specifier. The file stays raw so each **plugin's** build can
compile it: plugins are built once and ship as JavaScript plus a stylesheet, and a host
registers a plugin from `console.config.ts` without running a StyleX compiler of its own.
The tokens survive that because they resolve to the CSS custom properties
`@hamolus/console` already declares (`--bg`, `--surface`, `--text`, …), so overriding those
still restyles every plugin.

A host only ever sees the compiled result. It does not import this subpath, and it needs
neither `optimizeDeps.exclude` nor a StyleX toolchain — those belong in a plugin's own
build, where the theme file is compiled exactly once.
