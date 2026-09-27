# sites/nextjs

This folder deliberately holds a single framework: `nextjs/blog`.

Astro is used for three examples, Next.js for one. That is not because Next.js fits a blog
better than Astro — both do. The real reason is that the three Astro examples already show
three different things, and a fourth framework adds reading material rather than capability.

If a Next.js site outside the blog is added later — a catalog that needs server actions, or
a dashboard with its own authentication — add its folder here with the same shape:
`package.json`, `next.config.mjs`, `src/lib/hamolus.ts`, `src/app/`, and a `README.md`.
