# @hamolus/types

Shared, versioned data contracts for Hamolus: Zod schemas, TypeScript interfaces and
API DTOs for collections, fields, records, media, files, panels, auth and scope.

The core validates every payload with these schemas, so they are the single source of
truth for what the API accepts and returns.

## Use it

```ts
import { collectionDefinitionSchema, fieldDefinitionSchema } from '@hamolus/types'
```

Validate a collection definition before you `PUT` it:

```ts
const def = collectionDefinitionSchema.parse(input)
```

## Layout

```
src/collection.ts   collection + field definitions
src/field.ts        field types, controls, view placement
src/dto.ts          record, media, file and pagination DTOs
src/panel.ts        panel manifest contracts
src/group.ts        navigation groups
src/auth.ts         users, privileges, sessions
src/scope.ts        lands, colonies, tenant scope
src/price.ts        money formatting
src/markdown.ts     markdown → HTML/plain text
```

Build with `pnpm build`; the package ships compiled CJS + ESM + `.d.ts`.

## License

MIT
