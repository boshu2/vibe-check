# TypeScript Code Review Skill

**Trigger:** User asks for TypeScript review, type safety audit, or TS best practices check.

**Purpose:** Systematic TypeScript code review focusing on type safety, patterns, and idiomatic usage.

---

## Review Checklist

### 1. Compiler Configuration (tsconfig.json)

| Setting | Recommended | Why |
|---------|-------------|-----|
| `strict` | `true` | Enables all strict checks |
| `noImplicitAny` | `true` (via strict) | No silent `any` types |
| `strictNullChecks` | `true` (via strict) | Catch null/undefined errors |
| `noUncheckedIndexedAccess` | `true` | Arrays return `T \| undefined` |
| `exactOptionalPropertyTypes` | `true` | Distinguish `undefined` vs missing |
| `noImplicitReturns` | `true` | All code paths must return |
| `noFallthroughCasesInSwitch` | `true` | Prevent switch fallthrough bugs |

### 2. Type Safety Issues

**Critical (fix immediately):**
- [ ] Explicit `any` types
- [ ] Type assertions without validation (`as Type`)
- [ ] Non-null assertions (`!`) without checks
- [ ] `@ts-ignore` or `@ts-expect-error` comments
- [ ] Missing return types on exported functions

**Warning (improve when possible):**
- [ ] Implicit `any` in callbacks
- [ ] Overly broad types (`object`, `{}`, `Function`)
- [ ] Missing generics where reuse is possible
- [ ] Type assertions that could be type guards

### 3. Type Design Patterns

**Good patterns to look for:**
```typescript
// Discriminated unions
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Branded types for IDs
type UserId = string & { readonly brand: unique symbol };

// Const assertions for literals
const STATUSES = ['pending', 'active', 'done'] as const;
type Status = typeof STATUSES[number];

// Type guards
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}
```

**Anti-patterns to flag:**
```typescript
// ❌ Stringly-typed
function setStatus(status: string) { }

// ✅ Union type
function setStatus(status: 'pending' | 'active' | 'done') { }

// ❌ Optional chaining hiding bugs
const name = user?.profile?.name ?? 'Unknown';

// ✅ Explicit null handling
if (!user || !user.profile) {
  throw new Error('User profile required');
}
const name = user.profile.name;
```

### 4. Interface vs Type

| Use Interface | Use Type |
|---------------|----------|
| Object shapes | Unions, intersections |
| Extendable contracts | Computed types |
| Class implementations | Mapped types |
| Public API | Internal aliases |

### 5. Export Hygiene

- [ ] Are internal types exported unnecessarily?
- [ ] Is there a central `types.ts` for shared types?
- [ ] Are re-exports organized (`index.ts` barrels)?

---

## Review Process

1. **Check tsconfig.json** - Verify strict settings
2. **Run `tsc --noEmit`** - Catch all compiler errors
3. **Search for anti-patterns:**
   ```bash
   grep -r ": any" src/
   grep -r "as " src/ | grep -v "import"
   grep -r "@ts-ignore" src/
   grep -r "!" src/ | grep -v "!=" | grep -v "!=="
   ```
4. **Review types.ts** - Check type design
5. **Sample 3-5 files** - Deep review patterns

---

## Output Format

```markdown
## TypeScript Review: [Project Name]

### Config Score: X/10
[tsconfig.json findings]

### Type Safety Score: X/10
[Anti-pattern counts and examples]

### Type Design Score: X/10
[Pattern quality assessment]

### Top Issues
1. [Most critical issue]
2. [Second issue]
3. [Third issue]

### Recommendations
- [ ] [Actionable fix 1]
- [ ] [Actionable fix 2]
- [ ] [Actionable fix 3]
```

---

## Quick Fixes

```bash
# Find all `any` types
grep -rn ": any" src/

# Find type assertions
grep -rn " as [A-Z]" src/

# Find non-null assertions
grep -rn "\![^=]" src/

# Run strict type check
npx tsc --noEmit --strict
```
