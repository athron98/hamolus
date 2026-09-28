# @hamolus/console

The Hamolus console: a SolidJS + StyleX admin app for collections, records, media,
files, panels, users and multi-land scope. It is also the source that
`hamolus add console` copies into a project.

## Use it

```bash
hamolus add console        # copy this app into ./console
```

In a generated project the console is a workspace member you can edit freely — the
`add` command copies the source, it does not import this package at runtime.

## What it does

- **Collections** — edit a collection's definition (fields, flags, labels, groups) in
  a form or as raw JSON; the core creates and migrates the physical table.
- **Records** — generic table with search, filters, sorting, grouping, column
  persistence, and forms generated from the field definitions (relations, media,
  files, rich text, localized values).
- **Media / Documents / Attachments** — R2-backed libraries with taxonomy, cropping,
  focus points and variants.
- **Panels** — manifests, roles and members; the panel definition viewer.
- **Lands** — tenant registry, colonies and platform super-admins.
- **Settings** — the KV settings blob, plus self-service password changes.

## Development

```bash
pnpm dev                              # http://localhost:5173
CORE_API_URL=http://localhost:8787 pnpm dev
```

The console proxies `/api` to the core in development, so the browser talks to one
origin. It is deployed as Worker static assets with
`not_found_handling: "single-page-application"`.

## Reference

- [Console guide](docs/console.md)

## License

MIT
