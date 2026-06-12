---
name: Orval codegen config
description: How to configure Orval in this repo to avoid barrel/collision issues
---

The zod output config in `lib/api-spec/orval.config.ts` must use:
- `mode: "single"` — outputs everything to one file
- `target: path.resolve(apiZodSrc, "generated/api.ts")` — absolute path
- NO `workspace` field
- NO `schemas` field

**Why:** Without this, Orval regenerates a barrel `index.ts` that causes type collision errors when both the hooks output and zod output try to export types with the same names.

**How to apply:** After changing `openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`. Never edit `lib/api-client-react/src/generated/` or `lib/api-zod/src/generated/` by hand.

The `lib/api-zod/src/index.ts` barrel must stay as a single line: `export * from "./generated/api";`
