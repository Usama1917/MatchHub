---
name: API client imports
description: Correct import paths for types and hooks from the generated API client
---

Always import from the barrel export `@workspace/api-client-react`, not from subpaths:

```tsx
// CORRECT
import { User, Match, RankingEntry, useGetMe, useLogin } from '@workspace/api-client-react';

// WRONG - will cause TS2307 "cannot find module" errors
import { User } from '@workspace/api-client-react/src/generated/api.schemas';
```

**Why:** The package's `package.json` exports are configured for the barrel only. Subpath imports are not declared as package exports, so TypeScript can't resolve them.

**How to apply:** Any time the design subagent creates pages, check imports and replace `/src/generated/api.schemas` with the barrel.
