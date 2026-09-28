# Todo

> Public work tracker. Tickets the room agreed on. Status: todo / doing / done.

## Now

- [ ] **Hook deploy gate into `release.mjs`** — every release regenerates
      `hamolus-labs/{core,console,mcp}` from `packages/*` and fails if
      `--check` reports drift.
- [ ] **Console pass** — work through the author-picked list of console bugs,
      intent-mismatched features, and display issues; confirm each fix before
      moving on.

## Queued

- [ ] **Console-facing configuration** — seed the KV-backed settings the console
      exposes (scope TBD: seed only, or seed + editor).
- [ ] **Site deploy** — repeated next; deferred by the author.

## Exploration (parked)

- [ ] **CVC framework decision** — "author the collection" vs "describe an
      existing collection" for the TS model seam; nothing built until the author
      picks a posture and a frontend stack.
- [ ] **Multi-database** — PostgreSQL / MariaDB / SQLite / MongoDB; explicitly
      a later capability, not a CVC v1 promise.

## Done (this session)

- [x] Regenerate `hamolus-labs/{core,console,mcp}` from `packages/*`; all three
      public with live Deploy buttons.
- [x] Drift gate (`export-deploy-repo.mjs --check`) written and mutation-tested.
- [x] `@hamolus/*` 0.2.8 verified, registry agrees with the tree.

## Legend

- Public tracker; the private counterpart lives in `.opencode/`.
- "Deferred by the author" means the author explicitly pushed it down the list,
  not that it was forgotten.