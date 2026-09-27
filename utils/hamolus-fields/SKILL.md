---
name: hamolus-fields
description: Use ONLY when designing or validating field definitions inside a collection. Knows 19 field types, storage (NUMERIC/TEXT/INTEGER), localized types, relation kinds, currency/custom_currency, and control/widget constraints. Front-load keywords: FieldDefinition, fieldValueSchema, currency, custom_currency, relation, richtext.
---

# Hamolus — Fields

Create fields per `docs/definitions/field-definition.md`. A field is part of a collection's `fields` array only. `.strict()` on schema; unknown keys rejected.

## When to use

Use for adding/changing fields (type, required/default, unique/indexed, localized, consoleView/group, relation, enumValues, currency/customCurrency, format). NOT for collections/panels/config alone.

## Core constraints

1. `name`: `^[a-z][a-z0-9_]*$` snake_case. Column name.
2. `type`: one of 19 (`id,string,slug,text,richtext,number,currency,custom_currency,boolean,date,datetime,enum,json,email,url,relation,media,document,attachment`).
3. `required` vs `default`: write-time required only if `required===true && default===undefined`. DDL sets `NOT NULL DEFAULT` when default present.
4. `localized`: only `text,string,slug,email,url,richtext` honour it (value becomes `{ [locale]: string }`).
5. `control`: only allowed for `boolean,enum,relation` (matrix in spec). Defaults per type.
6. `enum`: needs non-empty `enumValues`. `multichecklist` stores `string[]` as JSON.
7. `relation`: needs `relation.collection, relation.field`. `kind` in `{belongsTo,hasMany,hasOne}` (defaults `belongsTo`). Stored as `string|string[]`. **Metadata only** (no FK enforcement).
8. `richtext.format`: `lexical|markdown|mdx` (mdx stored as text, JSX escaped).
9. Monetary: `currency` stores NUMERIC base; reads `{base,currency,display}`. `custom_currency` reads `{base,symbol,display}` with `customCurrency` block (position/prefix/suffix/decimals/grouping/patterns). `currency` requires `^[A-Z]{3}$` pattern (not full ISO validation). Zero-decimal conventions documented.
10. `media/document/attachment`: store self-contained snapshot (id,url,alt/width/height/focus or name/mime/size/ext).
11. `indexed`: metadata only (no CREATE INDEX emitted).
12. `hidden`: excluded from API output and panel ACL references.

## Storage mapping (key)

- `number,currency,custom_currency` → `NUMERIC`
- `boolean` → `INTEGER` (0/1)
- others (including `json,media,document,attachment,enum[]`) → `TEXT` (JSON serialized where object/array)

## Examples

```ts
// string + slug
{ name: 'title', type: 'string', label: 'Title', required: true },
{ name: 'slug',  type: 'slug',   label: 'Slug',   required: true, unique: true },

// boolean with default
{ name: 'published', type: 'boolean', label: 'Published', default: false, consoleView: 'side' },

// currency
{ name: 'price', type: 'currency', label: 'Price', currency: 'IDR', required: true, min: 0 },

// custom currency
{ name: 'budget', type: 'custom_currency', label: 'Budget', required: true, min: 0,
  customCurrency: { symbol: '€', suffix: ' /bln', decimals: 0 } },

// enum multichecklist
{ name: 'tags', type: 'enum', label: 'Tags', enumValues: ['a','b'], control: 'multichecklist' },

// relation hasMany
{ name: 'tag_ids', type: 'relation', label: 'Tags',
  relation: { collection: 'tags', field: 'id', kind: 'hasMany' } },

// richtext markdown
{ name: 'body', type: 'richtext', label: 'Body', format: 'markdown' },

// localized text
{ name: 'excerpt', type: 'text', label: 'Excerpt', localized: true },
```

## Validation checklist

- [ ] name snake_case + valid
- [ ] enum has enumValues
- [ ] relation has required relation keys
- [ ] format only on richtext
- [ ] currency only on currency; customCurrency only on custom_currency
- [ ] localized only on allowed 6 types
- [ ] control allowed for that type
- [ ] minLength/maxLength only for string/text/slug/email/url; min/max only for number/currency/custom_currency
- [ ] default matches type shape (objects allowed for json/media etc., stored as JSON)

## References

- `docs/definitions/field-definition.md`
- `packages/types/src/field.ts`, `packages/types/src/collection.ts`, `packages/core/src/db/table.ts`, `packages/core/src/db/coerce.ts`
