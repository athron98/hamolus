# `utils/` — agent skills for building on Hamolus

Seven self-contained skills that teach a coding agent how to use Hamolus correctly:
how to scaffold a project, how to declare a collection, how to pick a field type, how
to write a panel manifest, which config surface a value belongs on, how to seed data,
and which gate to run afterwards.

They are ordinary markdown with YAML frontmatter. There is no runtime, no plugin, and
nothing to compile — which is the point: the knowledge is reviewable in a pull request
like any other change to this repository.

## The skills

| Skill | Use it for |
| ----- | ---------- |
| [`hamolus-scaffold`](./hamolus-scaffold/SKILL.md) | `hamolus create` / `hamolus add <part>`, part names, `--output`, marker API, workspace globs |
| [`hamolus-collections`](./hamolus-collections/SKILL.md) | Declaring a collection in code or over HTTP; naming, PK, timestamps, groups, and the "PUT migrates, never drops" rule |
| [`hamolus-fields`](./hamolus-fields/SKILL.md) | The 19 field types, storage mapping, `required` vs `default`, `localized`, `relation`, `currency` / `custom_currency`, widget constraints |
| [`hamolus-panels`](./hamolus-panels/SKILL.md) | Panel manifests: view kinds, field ACLs, role operations, filters, metrics, reference validation, `bootstrap` as the source of truth |
| [`hamolus-config`](./hamolus-config/SKILL.md) | `core.config.ts` vs KV settings vs config entries vs Wrangler; the KV-wins localization precedence |
| [`hamolus-seed`](./hamolus-seed/SKILL.md) | Self-cleaning seed scripts, `DRY_RUN`, `ADMIN_KEY`, skipping code-defined collections |
| [`hamolus-verify`](./hamolus-verify/SKILL.md) | Which gate to run for which change, how to read an environmental failure, and the deploy-repository drift gate (`export-deploy-repo.mjs --check`) |

Each one is narrow on purpose. A skill that covered everything would be loaded for
every task and would be ignored for most of them.

## How they load

`SKILL.md` files are discovered by scanning skill directories for `**/SKILL.md`, and
the frontmatter is what decides whether a skill is ever shown to a model:

```yaml
---
name: hamolus-collections   # must equal the folder name
description: Use ONLY when …  # what it does AND when to trigger it
---
```

Two rules are not optional:

- **`name` must match the folder name.** A mismatch and the skill is not registered.
- **`description` is effectively required.** A skill without one is filtered out and
  never surfaced. Every description here starts with `Use ONLY when …` and then
  front-loads the literal keywords a user is likely to type, so the right skill fires
  on the right request.

## Registering them

Already done for this project, in [`.opencode/opencode.json`](../.opencode/opencode.json):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": { "paths": ["utils"] }
}
```

`paths` is scanned recursively, so `utils/hamolus-collections/SKILL.md` is found
without any per-skill entry. Add a folder, add a `SKILL.md` with valid frontmatter, and
it is live — no manifest to update.

Skill and config files are read at startup, not hot-reloaded. **Restart opencode after
adding or editing one.**

Other ways to load the same skills:

- **Claude Code / `agents` convention** — symlink or copy `utils/` to
  `~/.claude/skills/` or `~/.agents/skills/`; both are auto-scanned.
- **A published URL** — `skills.urls` accepts a host that serves a list of skills, so a
  release of this folder can be consumed without cloning.
- **Another tool entirely** — the body is plain markdown. Point any agent at the file.

## What the skills deliberately do not do

They are **not** a copy of `docs/definitions/`. Each one points at the authoritative
doc for depth and carries only the working knowledge plus the traps — the rules whose
violation produces a confusing failure rather than an error message:

- `PUT /_meta/collections` adds columns and never drops them.
- `required: true` **with** a `default` is not a write-time obligation.
- `localized` is inert on every type except six.
- `onDelete` and `indexed` are metadata only.
- A seed that `PUT`s a code-defined collection name gets a `403`.
- `search` on a list endpoint is strict, so a typo fails loudly instead of being ignored.
- Panel view schemas are not `.strict()`, so a mistyped view key is dropped silently.

## When the code changes

A skill that contradicts the code is worse than no skill. If you change a schema, a
rule, or a default, update the matching skill in the same commit — the gate that catches
a stale skill does not exist yet, so it is a review responsibility.
