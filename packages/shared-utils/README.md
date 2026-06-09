# Shared Utils

## Overview

Common utility functions used in both frontend and backend.

## Structure

- `validators/` - Input validation functions (email, password, etc.)
- `formatters/` - Data formatting functions (dates, currencies, etc.)
- `api/` - API-related utilities

## Usage

Import utilities from this package:

```typescript
import { isValidEmail, normalizeEmail } from '@orbitchat/shared-utils';

if (isValidEmail(userEmail)) {
  const normalized = normalizeEmail(userEmail);
}
```

## Principles

1. **Isomorphic** - Works in both Node.js and browser
2. **No Side Effects** - Pure functions
3. **Well Tested** - All functions should be easily testable
4. **Well Documented** - Clear examples and use cases

## Available Utilities

### Validators

- `isValidEmail(email: string): boolean` - Validate email format
- `normalizeEmail(email: string): string` - Normalize email to lowercase
- `isValidPassword(password: string, requirements?): boolean` - Validate password
- `getPasswordStrength(password: string)` - Get password strength level

### Formatters

(To be added)

### API Utilities

(To be added)
