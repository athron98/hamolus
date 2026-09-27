# `@hamolus/plugin-console-contracts` — shared plugin contracts

The vocabulary every console plugin package shares: the page/panel/component types a
plugin implements, the KV helper the console passes in, the StyleX design tokens, and
`definePlugin`. It is a **build-time dependency only** — it carries types and tokens,
not a runtime.

## Two kinds of build output

| Export | Built? | Why |
| ------ | ------ | --- |
| `.` → `dist/index.js` + `.cjs` + `.d.ts` | tsup | the types, the KV helper, `definePlugin` |
| `./styles.stylex.ts` → `./src/styles.stylex.ts` | **not built** | a plugin imports the tokens as TypeScript, so `stylex` compiles them into the *consuming* app's CSS |

Shipping the token file raw is the whole trick. If it went through `dist`, the token
definitions would already be compiled and the consuming app's StyleX would treat them
as a foreign stylesheet with a different insertion order. So:

**Never import a path inside `dist/` from another package.** The only public surface is
the two entries in `exports` plus `./package.json`.

## Commands

```bash
pnpm -F @hamolus/plugin-console-contracts typecheck
pnpm -F @hamolus/plugin-console-contracts build
pnpm -F @hamolus/plugin-console-contracts dev
```

## Layout

| Path | Holds |
| ---- | ----- |
| `src/index.ts` | plugin types, the KV helper, `definePlugin`, the page/panel/component contracts |
| `src/styles.stylex.ts` | the StyleX tokens, each a `var(--x)` reference into the console's `index.css` |
| `docs/` | the plugin contract documentation, shipped to plugin authors |

## Invariants

- **A token is a `var(--x)` reference, never a literal.** The values live in
  `@hamolus/console`'s `src/index.css`, which is the single source of truth. A literal
  here cannot be themed by the console and will drift from the UI it is supposed to
  match.
- **`definePlugin` is the only entry.** It exists so a plugin's manifest is checked
  against the contract at compile time. A plugin that hand-writes the object literal
  still runs, but it loses the check — do not do that in this repository.
- **The KV helper is scoped by the console, not by the plugin.** Keys arrive already
  prefixed with the plugin's id and the current land. A plugin that caches a KV value
  across a land switch shows another land's data.
- Adding a field to the plugin contract is a breaking change for every third-party
  plugin, because these are the types they compile against. Prefer an optional field.

## Gates

No gate script of its own. `pnpm -F @hamolus/cli check:plugin-config` pins what
the console passes to a plugin, and `pnpm check:markers` pins the token values against
the console's `index.css`. Run both after touching a token.

## Conventions

- Copyright/author/SPDX header verbatim (`pnpm check:copyright`).
- Document a contract change by what a plugin author must do, not by restating the
  type.
- Comments are English; commit messages follow Conventional Commits with the package as
  the scope.
