---
name: hamolus-scaffold
description: Use ONLY when creating or extending a Hamolus project with the CLI — 'hamolus create', 'add console/panel/mcp/plugin/seed/configuration', '--core basic|predefined', '--mode', '--output'. Knows project root resolution, the marker API 'add plugin' depends on, and workspace globs. Front-load keywords: hamolus create, hamolus add, scaffold, new project, --core, --output.
---

# Hamolus — Scaffold

Create and extend projects with the `hamolus` CLI. The CLI is zero-runtime-dependency and its commands are template-driven; the gotchas are about *where* it runs and *what* it rewrites.

## When to use

User says: new project, scaffold, `hamolus create`, `hamolus add <target>`, add console/panel/mcp/seed/configuration/plugin. NOT for editing an existing definition's fields (use `hamolus-collections` / `hamolus-fields`).

## Commands

There is no `--part` flag. `create` always makes a **project with a core**; the other parts are added afterwards with `add`.

```bash
hamolus create <name> [--mode <mode>] [--core <basic|predefined>] [-o <path>]
                    [--link <checkout>] [--force] [--dry-run] [-y]

hamolus add <target> [name] [-o <path>] [--template <dir>] [--source <dir>]
                            [--package <name>] [--link <path>] [--force] [--dry-run] [-y]
hamolus list
hamolus link
```

`add` targets: `console`, `panel <name>`, `mcp`, `plugin <name>`, `seed <name>`, `configuration <name>`.

## `--core` vs `--mode` — not the same axis

| Flag | Values | Changes |
| ---- | ------ | ------- |
| `--core` | `basic` (default) · `predefined` | **The schema.** `basic` ships no collections or panels — they are created in the console or the API and stay editable. `predefined` ships a `posts` collection + `content` panel under `core/src/`, in source control, therefore frozen against API edits (records stay editable). |
| `--mode` | `independent` (default) · `centralized` · `proxy` · `bridge` | **The scope model.** `independent` is a single scope with the land/colony layer off, and the only mode that sets `PUBLIC_GETS=true`. |

`--core` defaults to the mode's own template, then to `basic`.

## Hard rules

1. **Project root first.** Every command walks up to `hamolus.json`. A directory without one is rejected *before* any manifest is read. You cannot run the CLI from the repository root of hamolus itself.
2. **`--output` is relative to the project root** (for `create`, default `./<name>`), not your CWD.
3. **Part names are `snake_case`** (`[a-z][a-z0-9_]*`). A directory may be named differently from the part id.
4. **`hamolus add plugin` edits between markers.** It appends to the `plugins` array in `console.config.ts` between `/* hamolus:plugins:start */` and `:end */`, and inserts its import between the `imports` markers. Removing or moving a marker makes the command fail loudly with a "restore the markers" error — that is designed, not a bug to bypass. The `imports` markers sit **above** `defineConsoleConfig({…})` on purpose: inside the object literal, an `import` line does not parse.
5. **A new package part needs a workspace glob.** Adding a directory under `packages/` or a plugin under `packages/plugins/**` requires the directory registered in `pnpm-workspace.yaml`, inside the `packages:` block. `pnpm check:workspace-glob` pins this — a glob appended at the end of the file is silently ignored by pnpm.
6. **`templates/` inside `packages/cli` is a generated copy.** Never edit it by hand; edit the repository's `templates/` and repack. `pnpm check:markers` proves the copies are faithful.
7. **Running from source vs built.** `bin/hamolus.mjs` prefers `dist/cli.js` and falls back to `src/cli.ts` on Node 22+. After editing CLI sources, rebuild or the gates exercise your *previous* build.
8. **`--dry-run` first** for anything destructive. It prints the plan and writes nothing.

## Typical flows

**New project with a code-defined collection and panel:**

```bash
hamolus create acme --core predefined --mode independent
cd acme && pnpm install
```

**A project whose schema stays editable at runtime** (console/API owns it):

```bash
hamolus create acme --core basic
```

**Add a panel / seed / plugin to an existing project:**

```bash
hamolus add panel shop_ops
hamolus add seed demo_data
hamolus add plugin todo
```

**Develop against a local checkout instead of npm:**

```bash
hamolus create acme --link ../hamolus
```

The checkout is recorded in `hamolus.json`, so later `hamolus add` calls inherit it.

## Checklist

- [ ] Ran from inside a project (has `hamolus.json`), or `hamolus create` for a new one
- [ ] `--core` and `--mode` chosen deliberately — they are independent axes
- [ ] `--output` interpreted relative to project root
- [ ] Part id is `snake_case`
- [ ] Marker comments intact in `console.config.ts` (if a console exists)
- [ ] New package part registered in `pnpm-workspace.yaml` `packages:` block
- [ ] Did not hand-edit `packages/cli/templates/`
- [ ] Re-ran `hamolus list` to confirm the project reads back

## References

- `packages/cli/AGENTS.md`, `packages/cli/src/help.ts` (authoritative flag list)
- `packages/cli/src/commands/`
- `docs/writing-guide.md`
