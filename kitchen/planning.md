# Planning

> Public planning notes. Working agreements, open questions, and the order of
> work. Contents here are deliberations — decisions land in roadmap.md, facts
> land in recap.md.

## 2026-09-28 — deploy repos, config feature, CVC

### Working agreement on releases

- OTP for npm publishes is always handled by the author; CI-side automation is
  not attempted.
- A release must run the full gate set, not a subset.
- The generated `packages/cli/templates/` tree is stale whenever `patch` runs
  after the copy step — the order is `patch` → `copy-templates` → `pnpm install`
  → gates.
- On machines with pnpm ≥ 10 and a minimum-release-age policy, freshly published
  packages need `pnpm create hamolus@0.2.8` or
  `pnpm install --config.minimum-release-age=0`.

### Deploy-repo mechanics (decided)

- Standalone repos are **generated, never hand-copied.** The generator
  (`scripts/export-deploy-repo.mjs`) carries every fix forward.
- Auto-provisioning requires the resource id to be **absent**, not present-but-
  placeholder. Placeholder ids in `packages/core/wrangler.jsonc` stay (they are
  validated by `verify.mjs` for the local `configuration` workflow); they are
  stripped only in exports.
- Secrets are never part of a button deploy. After first deploy: core needs
  `JWT_SECRET` + `ADMIN_KEY`; MCP needs `CORE_ADMIN_KEY` + `CORE_API_URL` (its
  default points at `localhost:8787`). Console ships secrets-free.

### Open question — gate into release.mjs

The `--check` drift gate exists and is mutation-tested, but nothing runs it on a
schedule. Hook `export` + `--check` into `scripts/release.mjs` so every release
regenerates hamolus-labs repos and fails the release if the repos drifted. This
is small and removes the exact failure mode that sank a stale repo earlier.

### Open question — console-facing configuration

- Naming: "configuration" in the console sense means **KV-backed settings that
  the console exposes and the author can seed** — not the wrangler preset
  generator.
- Scope is still unclear: is this (a) a seed command that writes the KV-backed
  settings the console already has, (b) a settings editor surface in the
  console, or (c) both?
- Not the same as the `configuration` part; that command is unaffected.

### Open question — CVC framework

- Keeping it under exploration; no builds started. One decision to make before
  any work: does the TS model definition **author** the collection (model is the
  source of truth) or does it **describe** an existing collection (collection
  stays the source of truth, model is a typed view)? The first is the Laravel-
  familiar posture, the second is metadata-first honest. Both are viable; they
  shape the package differently.
- Frontend stack is open (React or SolidJS). Panels already demonstrate the view
  seam, so the framework most likely composes around the panel system rather
  than replacing it.
- Multi-database is explicitly not a blocker for CVC and not a v1 promise.

### Next actions

1. Hook the deploy generator + drift gate into `release.mjs`.
2. Confirm the console bug/feature list with the author, then fix one at a time.
3. Decide console-facing configuration scope (seed only? editor too?).
4. CVC: park until an author decision on "author vs describe" surfaces.