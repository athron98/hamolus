# create-hamolus

The initializer behind `npm create hamolus@latest`.

```bash
npm create hamolus@latest          # ten questions, then a project
npm create hamolus@latest acme     # the same, with the name already answered
```

It asks, and then it runs the real `hamolus` commands. Nothing here scaffolds anything
of its own: the wizard is `hamolus init`, and this package is the front door npm knows
how to open.

## The questions

1. **Project name** — the directory it goes in.
2. **Core name** — its package and Worker name.
3. **Core mode** — `independent` (one tenant, the default), or `centralized`, `proxy`
   or `bridge`, which also ask for a land and a colony.
4. **Predefined collections** — `n` for none, `y` for the `predefined` template, or type
   the name of a template your own repository ships.
5. **JWT secret** — typed, or generated when left empty.
6. **Admin key** — typed, or generated when left empty.
7. **The LAN** — `y` binds every dev server to `0.0.0.0`, `n` keeps them on
   `127.0.0.1`, and you can type an address such as `mac.lan`. Your phone can then open
   the core at `http://mac.lan:8787`.
8. **An admin console?**
9. **An MCP server?**
10. **A public site?** — `y` for Astro, `n` for none, or type `nextjs`, or a path.

The two secrets land in `core/.dev.vars`, which is git-ignored, so a project can be
run immediately. The LAN answer is written into the `dev` script of every part rather
than left to a flag someone has to remember.

## Every question has a flag, and a flag you pass is not asked

That is what makes the wizard scriptable rather than a form to get through. The flag
for a question is listed by `hamolus init --help`; the common ones:

```bash
npm create hamolus@latest acme --yes                     # every default, no questions
npm create hamolus@latest acme --mode centralized \
  --land acme --colony jakarta --console --mcp           # questions 3, 8 and 9 answered
npm create hamolus@latest acme --host 0.0.0.0 --site nextjs
```

With no terminal, or with `--yes`, nothing is asked and the defaults are used. The
wizard says so before it starts, so a `--yes` run in CI is never mistaken for a
question that went unanswered.

## Afterwards

```bash
cd acme
pnpm install
pnpm dev
npx hamolus list        # what the project ended up containing
```

`npx hamolus` works because `@hamolus/cli` is this package's only dependency — the same
CLI that ran the wizard stays available in the project it created.

## A note on names

A project name that is also a command word — `add`, `create`, `list` — cannot be created
through this front door, because the first word is read as the command. Use
`npx hamolus init add` for those; everything else is unaffected.

## See also

`@hamolus/cli` for the commands this forwards to, and the
[repository](https://github.com/hamolus-labs/hamolus) for the templates behind them.
