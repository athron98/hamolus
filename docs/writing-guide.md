# Writing guide

How to write prose and code in this repository. Most of it is not a matter of
taste — it is the set of habits that keep a metadata-driven codebase readable
when the schema lives in a database instead of a file.

## Prose

**Lead with what it is, not with what it does.** "A field definition describes
one column of a collection" beats "The field definition schema lets you
configure fields". The reader is looking for the noun.

**Say the surprising thing.** A reference document that only states the
unstated teaches nothing. The valuable sentences are the ones a competent
reader would not have guessed:

- `indexed` is metadata only — no `CREATE INDEX` is emitted.
- `PUT` only ever *adds*; a rename needs a D1 migration by hand.
- A definition written as a file is validated at boot, and a failure leaves the
  previous definition standing.
- `IDR` is a two-sen currency by ISO 4217 and is still never displayed with sen.

**Mark the limits, don't imply them.** Every non-obvious constraint wants a
"Current gaps" entry or an inline caveat. `email` and `url` do not validate
their format; a collection definition cannot be retyped in place; the
`currency` code is pattern-checked, not checked against the ISO 4217 list. If a
reader cannot tell the difference between "enforced" and "not enforced", the
sentence is too soft.

**Prefer a table to a list of sentences** for anything enumerable, and a
worked example to either once there are more than two interacting keys.
Examples must be copy-pasteable and must typecheck against the real schema —
a plausible-looking field definition that the PUT would reject is worse than no
example.

**Use American English**, which is what the existing set already uses — "normalize",
not "normalise". The one exception is a proper name you are quoting: a design
token called `color` stays `color` even mid-sentence.

**Never document a command that does not run.** If a doc lists a gate, that gate
must exist in the root `package.json`. The alternative — a wall of prose nobody
runs — is the single most common way a README rots.

## Code

**Comment the decision, never the mechanism.** The code already says
`if (decimals < 0) return ''`. What the reader cannot derive is *why* a
`custom_currency` field carries its own symbol instead of an ISO code. Comment
that, in a block above the declaration, and keep the block to the reasoning:

```ts
/**
 * Whether a symbol is written flush against the amount. `$19.50` and `€10,00`
 * are, `Rp 250.000` and `zł 10,00` are not — and the rule that produces both is
 * simply the shape of the symbol …
 */
```

**Name the thing the reader would otherwise have to remember.** `ZERO_DECIMAL_CURRENCIES`,
`currencyBaseOf`, `toDbValue`. `handleX` tells them nothing.

**Make illegal states unrepresentable, then validate at the boundary anyway.**
The schema is `.strict()` so a misspelled key is a `400`, not a silent no-op.
Cross-field rules — `format` only on `richtext`, `customCurrency` only on
`custom_currency` — live in a `superRefine` on the schema rather than in a
comment asking callers to remember.

**Prefer data to branching.** `SQLITE_COLUMN` maps 19 field types to three SQL
types in one object. A new type is one entry, not a new `if`. Same for
`ZERO_DECIMAL_CURRENCIES`, the symbol table, and the allowed-control map.

**Return the narrow type.** A helper that can return `string | number | null`
pushes its union onto every caller. Narrow at the boundary and the call sites
stay short.

**Write the tests that pin a decision, not the ones that walk the code.** The
useful assertion is "`price` is rejected as a field type", because that is the
migration someone will hit. A test that re-derives the formatter's own output
line by line only breaks when the formatter changes.

## Definitions

- A definition is **metadata** (a D1 row: collections, fields, panels) or
  **configuration** (a file in the core). Do not blur them, and do not move a
  setting from one to the other without saying why in the changelog.
- Changing a definition shape is a **breaking change** even when it is additive,
  because stored rows do not migrate themselves. Ship the reader side before the
  writer side, or state the migration in the same release.
- Renaming or retyping a field is out of reach of `PUT`. Say so wherever a
  reader would reasonably expect it to work.

## Checks

Run these before proposing a change:

```bash
pnpm typecheck
pnpm build
pnpm check:markers        # template copy is faithful
pnpm check:copyright      # every published file carries its notice
pnpm check:code-definitions   # offline definition contract
```

`pnpm check:panel-acl`, `check:code-defined-core` and `check:generated-app` need a
running Worker or a warm install; they are not "broken" when they fail on a
laptop without them. Say which gates you ran.

## See also

- [Contributing](../CONTRIBUTING.md) — the workflow around a change.
- [Definitions](./definitions/README.md) — what each definition is and where it
  lives.
- [Docs index](./README.md).
