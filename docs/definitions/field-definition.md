# Field definition

A **field definition** describes one column of a collection: its name, its type,
its constraints, how the console should render it, and what shape a value must
have on the wire. Hamolus turns it into three things at once — a DDL column, a
Zod validator for record payloads, and a widget in the admin console.

Fields are the smallest unit of schema in Hamolus. They only exist inside a
[collection definition](./collection-definition.md), they are never created
directly, and they are always edited as part of their collection.

| | |
| --- | --- |
| Schema | `fieldDefinitionSchema` — `packages/types/src/field.ts` |
| Types | `FieldDefinition`, `FieldDefinitionInput` |
| Value validator | `fieldValueSchema(field, languages?)` — `packages/types/src/collection.ts` |
| DDL mapping | `columnType(field)` — `packages/core/src/db/table.ts` |
| Value coercion | `toDbValue` / `fromDbValue` — `packages/core/src/db/coerce.ts` |

## Authoring a field

There is no `defineField()` helper. A field is a plain object literal that
satisfies the schema, written inside its collection's `fields` array:

```ts
// core/src/collections/posts.ts
import type { CollectionDefinitionInput } from '@hamolus/types'

export const POSTS = {
  name: 'posts',
  label: 'Posts',
  primaryKey: 'id',
  fields: [
    { name: 'title', type: 'string', label: 'Title', required: true },
    { name: 'slug', type: 'slug', label: 'Slug', unique: true, required: true },
    { name: 'published', type: 'boolean', label: 'Published', default: false },
  ],
} satisfies CollectionDefinitionInput
```

Over HTTP the same object is the `PUT /api/_meta/collections/{name}` body. The
two are interchangeable: create it in the console, copy the JSON into a file,
and the shape does not change.

## Every property

`.strict()` — an unknown key is a validation error, not a no-op.

| Property | Type | Required | Default | Notes |
| -------- | ---- | -------- | ------- | ----- |
| `name` | `string` | ✅ | — | Must match `^[a-z][a-z0-9_]*$` (snake_case). The column name, quoted as a SQL identifier. |
| `type` | `FieldType` | ✅ | — | One of the 19 types below. |
| `label` | `string` | | title-cased `name` | Human label for forms and tables. |
| `required` | `boolean` | | `false` | `NOT NULL` in DDL. At the value level, see [required vs. defaulted](#required-vs-defaulted). |
| `unique` | `boolean` | | `false` | `UNIQUE` column constraint. |
| `indexed` | `boolean` | | `false` | Metadata only — no `CREATE INDEX` is emitted. See [Current gaps](#current-gaps). |
| `default` | `unknown` | | — | Rendered into the column `DEFAULT`. Objects are stored as JSON text. |
| `minLength` | `number` | | — | `int ≥ 0`. Applies to `string`, `text`, `slug`, `email`, `url`. |
| `maxLength` | `number` | | — | `int > 0`. Same types as `minLength`. |
| `min` | `number` | | — | Lower bound for `number`, `currency` and `custom_currency`. |
| `max` | `number` | | — | Upper bound for `number`, `currency` and `custom_currency`. |
| `enumValues` | `string[]` | for `enum` | — | Non-empty. Mandatory when `type: 'enum'`. |
| `relation` | `RelationConfig` | for `relation` | — | Mandatory in practice when `type: 'relation'`. |
| `control` | `ControlType` | | type default | Widget for `enum`, `relation`, `boolean` only. |
| `format` | `RichTextFormat` | | `lexical` | `richtext` only. |
| `currency` | `string` | for `currency` | `IDR` | ISO 4217 code, `^[A-Z]{3}$`. `currency` only. |
| `customCurrency` | `CustomCurrencyConfig` | for `custom_currency` | — | Formatting block for a non-ISO unit. `custom_currency` only. |
| `hidden` | `boolean` | | `false` | Dropped from API output; unusable in panels. |
| `localized` | `boolean` | | `false` | Value is a JSON object keyed by locale code. Honoured by `text`, `string`, `slug`, `email`, `url`, `richtext`. |
| `consoleView` | `ConsoleView` | | `normal` | Console form placement: `normal`, `side`, `header`, `footer`. |
| `group` | `string` | | — | Collapsible section name in the console form. |
| `groupOpen` | `boolean` | | `true` | Whether that section starts expanded. |

Validation beyond the per-property rules is five cross-field refinements:

1. `type: 'enum'` ⇒ `enumValues` must be present and non-empty.
2. `format` is only valid on `richtext`.
3. `control`, when present, must be in the set allowed for that field (see below).
4. `currency` is only valid on `currency`.
5. `customCurrency` is only valid on `custom_currency`.

Point 5 is what stops a stale `customCurrency` block from outliving a field
switched back to `number` — the console clears both keys when the type changes, and
the PUT rejects the pair if it does not.

## Field types

Nineteen types. The column type comes from `SQLITE_COLUMN` in
`packages/core/src/db/table.ts` — everything except `number`, `currency`,
`custom_currency` and `boolean` is a `TEXT` column, including `json`, `media`,
`document`, `attachment` and multi-value enums, which are stored as JSON text.

Both monetary types share one storage model: a `NUMERIC` column holding the raw
amount, plus a read-time presentation. What differs is where the presentation
comes from — an ISO code the core already knows, or a block the field carries.

| `type` | SQL | Value shape (JSON) | Localized | Notes |
| ------ | --- | ------------------ | --------- | ----- |
| `id` | `TEXT` | `string` | | The primary key. Rarely declared — see [the primary key](#the-primary-key). |
| `string` | `TEXT` | `string` | ✅ | Single line. Honours `minLength` / `maxLength`. |
| `slug` | `TEXT` | `string` | ✅ | `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Also honours length limits. |
| `text` | `TEXT` | `string` | ✅ | Multi-line plain text. |
| `richtext` | `TEXT` | `string` or `{ root: … }` | ✅ | Depends on `format`. |
| `number` | `NUMERIC` | `number` | | Honours `min` / `max`. |
| `currency` | `NUMERIC` | `number` or `{ base, currency, display }` | | ISO 4217 amount; see [currency](#currency). |
| `custom_currency` | `NUMERIC` | `number` or `{ base, symbol, display }` | | Non-ISO unit; see [custom_currency](#custom_currency). |
| `boolean` | `INTEGER` | `boolean` | | Stored as `0` / `1`. |
| `date` | `TEXT` | `"YYYY-MM-DD"` | | Regex-validated, not a timestamp. |
| `datetime` | `TEXT` | ISO 8601 string | | `z.iso.datetime()`. |
| `enum` | `TEXT` | `string` or `string[]` | | `enumValues` required. `string[]` when `control: 'multichecklist'`. |
| `json` | `TEXT` | any JSON | | `z.unknown()` — the core does not inspect it. |
| `email` | `TEXT` | `string` | ✅ | A `string` for rendering; no format check beyond length. |
| `url` | `TEXT` | `string` | ✅ | A `string` for rendering; no format check beyond length. |
| `relation` | `TEXT` | `string` or `string[]` | | `string[]` when `relation.kind: 'hasMany'`. |
| `media` | `TEXT` | `MediaFieldValue` | | Self-contained image reference. |
| `document` | `TEXT` | `FileRefValue` | | Reference into the documents library. |
| `attachment` | `TEXT` | `FileRefValue` | | Reference into the attachments library. |

### `richtext` and `format`

`format` picks the stored representation and the console editor:

| `format` | Stored value | Console | Rendering |
| -------- | ------------ | ------- | --------- |
| `lexical` (default) | Lexical editor state — an object `{ root: … }` or a JSON string | Lexical editor | The site converts it to HTML, including embedded media images. |
| `markdown` | A plain CommonMark string | Write/Preview editor | Shared `markdownToHtml` renderer — escaped output, safe links only. |
| `mdx` | A plain markdown string (a superset; JSX stays escaped as text) | Write/Preview editor | Same as `markdown`. |

`mdx` is a markdown superset, not a JSX runtime: the value is stored and edited as
text, and JSX in it renders as escaped text.

### `currency`

`currency` is an amount in a real-world currency, held in a `NUMERIC` column as a
bare number — there is no currency-specific column type and no per-record FX state.

```ts
{ name: 'price', type: 'currency', currency: 'IDR', required: true, min: 0,
  label: 'Price', group: 'Pricing' }
```

- **Writes** accept a bare number, or a serialized `{ base, currency, display }`
  object so a read value can be written back unchanged. The object must carry
  `base`; `currency` and `display` are re-derived, so a stale `display` is
  harmless.
- **Reads** always return `{ base, currency, display }`. `base` is the raw amount,
  `currency` echoes the field's code, and `display` is formatted for the requested
  `?locale=`:

  | | `?locale=id` | `?locale=en` |
  | --- | --- | --- |
  | `currency: 'IDR'`, base `250000` | `Rp 250.000` | `Rp 250,000` |
  | `currency: 'USD'`, base `19.5` | `$19,50` | `$19.50` |
  | `currency: 'JPY'`, base `1500` | `¥1.500` | `¥1,500` |

  `null` / `NaN` formats as `''`.

Three details are worth knowing because they are conventions, not rules of the
standard:

- **The code is not validated against ISO 4217.** It only has to be three uppercase
  letters. An unknown code still renders, falling back to the code itself as the
  symbol (`XAB` → `XAB 10.00`) and to two decimals. A typo like `IDR2` is rejected
  by the pattern; `UDD` is not caught.
- **Zero-decimal currencies are a display convention.** `ZERO_DECIMAL_CURRENCIES`
  lists the currencies shown without fraction digits, which includes `IDR` — ISO
  counts it as a two-sen currency, but nobody writes `Rp 250.000,00`. Set
  `decimals` on the formatter call to override.
- **Symbol spacing follows the glyph.** `$19.50` and `€10,00` bind flush to the
  digits, `Rp 250.000` and `zł 10,00` do not — the rule is that a single
  non-alphabetic character is a suffix-like glyph, and anything longer is a
  wordmark. `space` overrides it.

Keeping the numeric `base` in the response is the whole point: a site can repaint
`display` with a live exchange rate, or with the visitor's chosen currency, without
re-reading the record. Nothing converts on write — `currency` records one amount in
one currency.

### `custom_currency`

`custom_currency` covers the units ISO 4217 never had: store credit, loyalty
points, grams of gold, billable hours, or a price quoted *per something* — `Rp
150.000 /bulan` is a number with a unit, and forcing it into `USD` would be a lie.

```ts
{ name: 'budget', type: 'custom_currency', required: true, min: 0,
  customCurrency: { symbol: '€', suffix: ' /bln', decimals: 0 } }
```

Storage and reads mirror `currency`; only the presentation source differs. Reads
return `{ base, symbol, display }`, with `symbol: null` when the field declares
none.

Every key is optional — the block itself is the unit:

| Key | Type | Default | Notes |
| --- | ---- | ------- | ----- |
| `symbol` | `string` | — | `max(3)`. Shown next to the amount unless `prefix` / `suffix` replace it. |
| `position` | `before` \| `after` | `before` | Where the symbol sits. |
| `prefix` | `string` | — | `max(12)`, placed before everything. |
| `suffix` | `string` | — | `max(12)`, placed after everything — the `/bulan` half of `Rp /bulan`. |
| `space` | `boolean` | inferred | Force or suppress the space after the symbol. |
| `decimals` | `int 0…8` | `2` | Fraction digits. |
| `grouping` | `boolean` | `true` | Thousands separators on or off. |
| `decimalSeparator` | `string` | `,` / `.` | `max(3)`, from the requested locale. |
| `thousandSeparator` | `string` | `.` / `,` | `max(3)`, from the requested locale. |
| `negativePattern` | `string` | `—` | Must contain `{amount}`. May also use `{symbol}`. |

Order is fixed: `prefix`, then symbol, then the amount, then `suffix`. So
`{ symbol: 'Rp', suffix: ' /bln', decimals: 0 }` on `1500000` gives
`Rp 1.500.000 /bln` for `locale=id`.

`negativePattern` is the one key that can rearrange the sign, because the sign has
to live *somewhere*:

```ts
{ negativePattern: '({amount})' }   // → (€1.234,50)   accounting
{ negativePattern: '-{amount}' }   // → -€1.234,50     neutral, the default
{ negativePattern: '{amount} {symbol}' }  // → -1.234,50 €
```

The pattern must contain `{amount}` — a `({symbol})` would render a minus sign
that no longer applies to anything. `negativePattern: '-{amount}'` is the neutral
escape hatch, and any other placement is the caller's business.

### `enum`

```ts
{ name: 'status', type: 'enum', label: 'Status', enumValues: ['draft', 'live'],
  control: 'combobox', default: 'draft' }
```

A `multichecklist` enum stores a JSON array in the `TEXT` column
(`z.array(z.enum(enumValues))`) and is parsed back on read — the same storage
model as a `hasMany` relation.

### `relation`

```ts
{ name: 'category_id', type: 'relation', label: 'Category',
  relation: { collection: 'categories', field: 'id', onDelete: 'setNull' },
  consoleView: 'side' }
```

`RelationConfig` (`.strict()`):

| Property | Type | Required | Notes |
| -------- | ---- | -------- | ----- |
| `collection` | `string` | ✅ | Target collection name. |
| `field` | `string` | ✅ | Target field, usually the primary key. |
| `onDelete` | `'cascade' \| 'restrict' \| 'setNull'` | | Documented intent; **not enforced** by the database. |
| `kind` | `'belongsTo' \| 'hasMany' \| 'hasOne'` | | Defaults to `belongsTo`. |

| `kind` | Stored value | Meaning |
| ------ | ------------ | ------- |
| `belongsTo` (default) | `string` | The foreign key lives on this table — `posts.category_id → categories.id`. |
| `hasMany` | `string[]` | This table stores an array of target keys — `posts.tag_ids → tags.id[]`. |
| `hasOne` | `string` | Reverse lookup: one record on the target references this record. |

Relations are metadata + storage only. There are no SQL `FOREIGN KEY`
constraints, no referential validation on write, and no join or populate on
read — the console resolves labels through a separate request.

### `media`, `document`, `attachment`

These store a **self-contained snapshot** of the picked object, not just its id,
so a record renders without an extra lookup. The `url` is an absolute public URL
served from `/media/<key>`, `/documents/<key>` or `/attachments/<key>`.

`MediaFieldValue`:

```ts
{
  id: string          // required
  url: string         // required
  alt?: string | null
  width?: number | null
  height?: number | null
  focusX?: number | null   // 0–100, percent
  focusY?: number | null   // 0–100, percent
}
```

`FileRefValue` (used by both `document` and `attachment`):

```ts
{
  id: string          // required
  url: string         // required
  name?: string | null
  mime?: string | null
  size?: number | null
  ext?: string | null
}
```

`document` and `attachment` are the same shape and differ only in which file
library they read from.

## Widgets (`control`)

`control` chooses the console input. It is only valid on `enum`, `relation` and
`boolean`; the default depends on the type. `allowedControls(field)` in
`packages/types/src/field.ts` is the single source of truth for this matrix, and
the schema enforces it:

| Field | Allowed `control` | Default when unset |
| ----- | ----------------- | ------------------ |
| `boolean` | `toggle`, `radio` | a checkbox |
| `enum` | `combobox`, `search`, `radio`, `checklist`, `multichecklist` | `combobox` — a native `<select>` |
| `relation` with `kind: 'hasMany'` | `search`, `multichecklist` | tag-style chips |
| `relation` otherwise | `combobox`, `search`, `radio`, `checklist` | `combobox` |
| everything else | *(must be absent)* | — |

| `control` | Widget |
| --------- | ------ |
| `combobox` | Native `<select>`. |
| `search` | Searchable combobox — type to filter many options, tag-input style. |
| `radio` | Inline radio group. For small choice sets. |
| `toggle` | Switch. |
| `checklist` | Pick **one** from a list of rows. |
| `multichecklist` | Pick **many** with checkboxes; the value is a JSON array. |

## Console presentation

These properties change the record form only; they never change storage or
validation.

- `consoleView` — `normal` (the main column), `side` (right column), `header`
  (top of the form), `footer` (bottom of the form).
- `group` / `groupOpen` — fields sharing a `group` render inside a collapsible
  section. `groupOpen` defaults to `true` (starts expanded).

## Localization

`localized: true` makes the stored value a JSON object keyed by locale code:

```jsonc
{ "en": "Hello world", "id": "Halo dunia" }
```

Two rules worth knowing before you use it:

- **Only six types honour it**: `text`, `string`, `slug`, `email`, `url` and
  `richtext`. On any other type the flag is stored but has no effect.
- **The locale list comes from configuration**, not from the field. A
  `{ en, id }` value is rejected when the project declares only `en`. Declare
  locales in `core.config.ts` or in KV settings — see
  [config definition](./config-definition.md).

Reads without `?locale=` return the whole object; with `?locale=id` the
resolved string comes back instead.

## Read behaviour

- `hidden: true` removes the field from list and detail responses, and from
  panel field ACLs (`hidden` fields cannot be referenced by a manifest at all).
- `search` on a list endpoint covers `string`, `text`, `email`, `url`, `slug`
  and `richtext` fields that are not hidden.
- The primary key is always present in a response, even when it is not a
  declared field.

## Required vs. defaulted

`required` has two meanings, and they do not always agree:

| Declaration | DDL | Record value |
| ----------- | --- | ------------ |
| `required: true`, no `default` | `NOT NULL` | Mandatory. |
| `required: true` **with** `default` | `NOT NULL DEFAULT …` | Optional — the validator makes it nullable because a default exists. |
| `required` unset | nullable | Optional. |

`fieldValueSchema` computes this as
`field.required === true && field.default === undefined`. A field with a default
is never a write-time obligation, which is what lets a `published` boolean
default to `false` without every create call spelling it out.

## The primary key

A collection's `primaryKey` defaults to `id`, and the core creates the column
whether or not you declare it. So a normal collection does **not** list an `id`
field:

```ts
{ name: 'posts', label: 'Posts', primaryKey: 'id', fields: [ /* no id field */ ] }
```

`pkField()` in `packages/core/src/db/table.ts` synthesizes
`{ name: primaryKey, type: 'id' }` when the field is absent from `fields`. That
synthetic field is what the DDL, the record reads and the panel field resolvers
all fall back to — which is why a panel view may list `id` under `fields.read`
for a collection that never declares it.

If you *do* declare it, that declaration is the one used (this is how the
platform-owned `privileges` collection declares `id` explicitly). Declaring both
`primaryKey: 'id'` and a separate `id` field of another type is a mistake: the
duplicate check keys on `name:type`, so it slips through the schema and shows up
as confusing DDL instead.

## Adding a field type

Field types are a closed union in one file. To add one:

1. Append the literal to `FIELD_TYPES` in `packages/types/src/field.ts`.
2. Add a `case` to `fieldValueSchema()` in `packages/types/src/collection.ts`
   — this is the write-time validator.
3. Add an entry to `SQLITE_COLUMN` in `packages/core/src/db/table.ts` and, if
   the type is not stored as its JSON text form, to `toDbValue` / `fromDbValue`
   in `packages/core/src/db/coerce.ts`.
4. Add the console widget in `packages/console/src/components/FieldEditor.tsx`.
5. Add it to the `type` list documented in
   `packages/core/docs/api.md` and here.

Steps 2 and 3 are the load-bearing ones: skipping `toDbValue` stores objects as
`[object Object]`, and skipping `fieldValueSchema` accepts anything.

## Current gaps

- `indexed` is **metadata only**. No `CREATE INDEX` is emitted, so it records
  intent for a future migration rather than changing D1 today.
- `onDelete` on a relation is **metadata only** — documented intent, no cascade,
  no restrict, no referential check.
- `email` and `url` do not validate their format. They are render hints; add a
  `json` field with your own rule if you need one enforced.
- `localized` is inert on every type except the six listed above.
- Field definitions cannot be renamed or retyped in place through a migration —
  dropping a column is not something `PUT /_meta/collections/{name}` does. It
  only ever adds columns.

## See also

- [Collection definition](./collection-definition.md) — the schema that owns
  fields.
- [Config definition](./config-definition.md) — where the locale list and other
  project settings live.
- [Core API reference](../../packages/core/docs/api.md#fielddefinition) — the
  HTTP shape.
- [Console guide](../../packages/console/docs/console.md) — the field editor.
