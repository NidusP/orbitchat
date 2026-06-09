# Shared Types

## Overview

Centralized type definitions for Orbitchat API contracts and domain models.

## Structure

- `api/` - API request/response types
- `domain/` - Business domain models  
- `utils/` - Type utilities and type guards

## Usage

Import types from this package in both frontend and backend:

```typescript
import type { User } from '@orbitchat/shared-types/domain/user';
import { isSuccessResponse } from '@orbitchat/shared-types/api/response';
```

## Principles

1. **API Contract** - Types define the contract between frontend and backend
2. **No Implementation** - Only type definitions, no implementation code
3. **Isomorphic** - Types must work in both Node.js and browser environments
4. **Strict** - All types must be strict, no `any` type

## Adding New Types

When adding new types:

1. Create a new file in the appropriate subdirectory (api, domain, utils)
2. Export types from that file
3. Re-export from `index.ts`
4. Update this README with the new types
