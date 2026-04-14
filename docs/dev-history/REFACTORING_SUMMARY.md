# Refactoring Summary: Services Layer & React Hooks

> Archived development note: this summary reflects a historical refactoring phase and may not match current implementation details. For canonical current behavior, prefer `docs/INDEX.md`, `docs/STORES.md`, and `docs/SOLUTION_ARCHITECTURE.md`.

This document summarizes the refactoring and debugging work completed in April 2026.

## Overview

This work consisted of two phases:
1. **Services Layer Refactoring** — Architecture improvements to API integration layer
2. **React Hooks Debugging** — Fixing critical hooks violations affecting multi-subject loads

## Phase 1: Services Layer Refactoring

### Objectives
- Eliminate code duplication across service files
- Fix security vulnerabilities (GraphQL injection)
- Modernize async patterns (promise chains → async/await)
- Extract reusable utilities

### Changes

#### New Files Created

##### `src/services/apiClient.ts` (59 lines)
- **Purpose**: Generic HTTP client wrapper for Zooniverse REST endpoints
- **Removes**: ~60 lines of repetitive fetch/header/error handling code
- **Functions**:
  - `apiCall<T>(baseUrl, endpoint, options)` — Safe API calls with error handling
  - `buildQueryString(params)` — URL parameter encoding with undefined filtering
- **Benefits**:
  - Single source of truth for API patterns
  - Consistent error messaging
  - Type-safe responses
  - Reduced boilerplate in panoptesService

##### `src/utils/coordinates.ts` (114 lines)
- **Purpose**: Centralized coordinate transformation utilities
- **Extracted from**: Scattered throughout sam2Service
- **Functions**:
  - `transformPoints(points, fix)` — Point coordinate system conversion
  - `calculateDisplayCoordinates(x, y, image, canvas)` — Scale transformations
- **Benefits**:
  - Testable coordinate logic
  - Reusable across components
  - Clear EXIF/display/SAM2 coordinate mapping

#### Modified Files

##### `src/services/caesarService.ts`
**Security Fix**: Eliminated GraphQL injection vulnerability
- **Before**: Used string interpolation for variable substitution
  ```typescript
  // ❌ VULNERABLE
  const query = `workflow(id: ${workflowId})`;
  ```
- **After**: Uses GraphQL variables (parameterized queries)
  ```typescript
  // ✅ SAFE
  const FETCH_REDUCTIONS_QUERY = gql`
    query FetchSubjectReductions($workflowId: ID!, $subjectId: ID!, $reducerKey: String!) {
      workflow(id: $workflowId) { ... }
    }
  `;
  ```
- **Impact**: Prevents malicious query injection; follows GraphQL best practices

**Type Fixes**: Corrected GraphQL variable types
- Changed `Int!` to `ID!` for workflowId and subjectId
- Caesar API schema expects GraphQL ID scalar type, not integer
- Resolves "Type mismatch on variable $workflowId" error

##### `src/services/panoptesService.ts`
- **Updated**: Now uses `apiClient` for all Panoptes REST calls
- **Removed**: ~40 lines of redundant fetch/header boilerplate
- **Functions**: No behavior changes, only implementation details
  - `getQueuedSubjects()`
  - `getWorkflow()`
  - `getUserDetails()`

##### `src/services/imageService.ts`
- **Modernized**: Promise chains → async/await
- **Before**:
  ```typescript
  const promise = loadImageAsDataUrl(url)
    .then(url => normalizeImage(url))
    .then(url => getImageDimensions(url));
  ```
- **After**:
  ```typescript
  const dataUrl = await loadImageAsDataUrl(url);
  const normalizedUrl = await normalizeImageForDisplay(dataUrl);
  const dimensions = await getImageDimensions(normalizedUrl);
  ```
- **Added**: Timeout protection on all async operations
  - File reads: 30 second timeout
  - URL fetches: 30 second timeout
  - Image normalization: 10 second timeout

##### `src/services/sam2Service.ts`
- **Refactored**: Extracted coordinate transformations to `utils/coordinates.ts`
- **Behavior**: No changes; same functionality with cleaner imports

#### New React Hooks

##### `src/hooks/useCaesarClient.ts` (16 lines)
- **Purpose**: Memoizes GraphQL client creation
- **Dependencies**: `[token]` only (opts is constant reference)
- **Used by**: ZooniverseImageLoader component

### Testing
All refactored services verified:
- ✅ caesarService.ts — Zero compilation errors, type-safe GraphQL queries
- ✅ panoptesService.ts — All endpoints working with apiClient wrapper
- ✅ imageService.ts — Timeout protection functioning on image loads
- ✅ sam2Service.ts — Coordinate transformations working correctly
- ✅ apiClient.ts — Generic wrapper pattern validated across services

### Code Quality Metrics
- **Lines Removed**: ~100 lines of boilerplate
- **Security Fixes**: 1 (GraphQL injection prevention)
- **Async Improvements**: 3 (imageService functions)
- **Type Mismatches**: 1 fixed (Caesar API types)
- **Code Duplication**: Eliminated across 3 services

---

## Phase 2: React Hooks Debugging

### Problem

Multi-click "Next subject" workflow was failing with React hooks violations:

1. **First page load**: "Expected static flag was missing" warning
2. **First click**: Works normally
3. **Second click**: "Rendered more hooks than expected" error

### Root Causes Identified

#### Issue #1: Hooks Called Inside Map Loop (Critical)

**Location**: `CaesarAnnotationOverlay.tsx` line 44

```typescript
// ❌ BROKEN: Hooks called inside loop
{annotations.map((annotation) => {
  const tooltipHandlers = useCaesarAnnotationTooltip(...);  // Called N times
  return <Rect ... />;
})}
```

**Problem**: Hook count varies with annotation count. First subject has 5 annotations (5 hook calls), second subject has 6 annotations (6 hook calls). React detects mismatch and crashes.

**Error Pattern**: "React has detected a change in the order of Hooks called by CaesarAnnotationOverlay"

**Error Details**: Hook #805 was `undefined` on first render, `useCallback` on second render

**Solution**: Extract child component

```typescript
// ✅ FIXED: Hook called at component top level
function CaesarAnnotationRect({ annotation, ... }) {
  const tooltipHandlers = useCaesarAnnotationTooltip(...);  // Called once per instance
  return <Rect ... />;
}

{annotations.map((annotation) => (
  <CaesarAnnotationRect key={annotation.markId} annotation={annotation} ... />
))}
```

#### Issue #2: Guard Clause Before Hooks

**Location**: `ZooniverseImageLoader.tsx` initial version

```typescript
// ❌ PROBLEM: Guard before hooks
if (!token?.access_token) {
  return <Container />;  // Hooks not called
}

// Hooks only called if authenticated
const caesarClient = useCaesarClient(...);
const reductions = useCaesarReductions(...);
const loader = useSubjectLoader(...);
```

**Problem**: On first render token exists (from localStorage), hooks are called. On second render if token changes or context updates, conditional evaluation changes, and hooks may or may not be called in same order.

**Solution**: Call hooks unconditionally, guard after

```typescript
// ✅ FIXED: All hooks always called
const accessToken = token?.access_token;
const caesarClient = useCaesarClient(accessToken, CAESAR_REDUCTION_OPTS);
const reductions = useCaesarReductions(caesarClient, WORKFLOW_ID, accessToken);
const loader = useSubjectLoader(accessToken, reductions);

if (!accessToken) {
  return <Container />;  // Guard AFTER hooks
}

return <Container><Button>Next subject</Button></Container>;
```

#### Issue #3: State-Driven Hook Count Variations

**Location**: `useSubjectLoader.ts` initial version

```typescript
// ❌ Problem: State changes affect dependencies
const [subjects, setSubjects] = useState<Subject[]>([]);
const [queueSize, setQueueSize] = useState(0);

const loadNextSubject = useCallback(async () => {
  const newSubjects = [...subjects];  // Depends on state
  setSubjects(newSubjects);  // Triggers re-render
}, [subjects]);  // Subject count in dependency = unstable
```

**Problem**: When subjects state changes, dependency array changes, callbacks recreate, triggering cascading re-renders.

**Solution**: Use refs for queue data

```typescript
// ✅ FIXED: Queue in ref, only display state for renders
const subjectsQueueRef = useRef<Subject[] | null>(null);
const hasInitializedRef = useRef(false);
const [queueSize, setQueueSize] = useState(0);  // Only for display

const loadNextSubject = useCallback(async () => {
  // Stores queue in ref (no state update)
  subjectsQueueRef.current = newSubjects;
  // Only updates state for display
  setQueueSize(newSubjects.length);
}, []);  // Stable: no state dependencies
```

### Files Modified

#### `src/components/ImageLoader/ZooniverseImageLoader.tsx`
- Moved hook calls before guard clause
- Accepts `undefined` accessToken to hooks
- Guards execute after all hooks initialize
- Status: ✅ Zero errors, multi-click works

#### `src/components/CaesarAnnotationOverlay/CaesarAnnotationOverlay.tsx`
- Extracted `CaesarAnnotationRect` child component
- Moved `useCaesarAnnotationTooltip` hook to child component
- Filters rectangles before mapping to children
- Added TypeScript type guard for rectangle type safety
- Status: ✅ Zero errors, tooltips work on all annotations

#### `src/components/ImageLoader/useSubjectLoader.ts`
- Moved subject queue from state to useRef
- Only minimal display state for queue size
- Removed subject state from dependencies
- Status: ✅ Zero errors, queue management stable

#### `src/components/ImageLoader/useCaesarReductions.ts`
- Added useRef pattern for caesarClient and accessToken
- Breaks dependency chain through refs
- Callback dependencies stable
- Status: ✅ Zero errors, Caesar reductions fetch correctly

#### `src/components/ImageLoader/useSubjectLoader.ts`
- Uses ref pattern for queue management
- No state-driven hook count variations
- Status: ✅ Zero errors, multiple clicks work

#### `src/main.tsx`
- Verified React.StrictMode present (required for debugging hooks)
- Tested with/without StrictMode (errors occur in both)

### Testing Results

**Initial State**:
- ❌ First page load: "Expected static flag was missing" warning
- ❌ First click: Works
- ❌ Second click: "Rendered fewer/more hooks" error

**After Fixes**:
- ✅ Page load: No warnings
- ✅ First click: Works
- ✅ Second click: Works
- ✅ Multiple clicks: All work
- ✅ Next subject functionality: Fully operational
- ✅ Caesar annotations: Load and display correctly

### Lessons Learned

1. **Hooks Execution Order Is Sacred**
   - React tracks hooks by their ORDER in the render function
   - Changing execution order breaks hook state tracking
   - Always call hooks unconditionally

2. **Guards Before Hooks Are Dangerous**
   - Even though it looks right, it breaks hook ordering
   - Correct pattern: Call hooks first, guard after

3. **Hooks in Loops Are Always Bugs**
   - Loop count changes = hook count changes = error
   - Solution: Extract hook to child component

4. **State-Driven Dependencies Can Cascade**
   - Avoid putting state in useCallback dependencies
   - Use refs for non-display data
   - Keep dependency arrays minimal and stable

5. **Type Safety Catches Issues Early**
   - TypeScript caught Caesar API type mismatch
   - Type guards filter incorrect annotation types before passing to children

## Code Quality Improvements

### Before
- 100+ lines of duplicated fetch/header boilerplate
- GraphQL injection vulnerability (string interpolation)
- Promise chains instead of async/await
- Scattered coordinate transformation logic
- Broken hooks patterns preventing multi-subject loads
- No timeout protection on async operations

### After
- DRY principle applied across services
- Injection-safe GraphQL parameterized queries
- Modern async/await patterns with timeout protection
- Centralized, testable coordinate transformations
- Correct React hooks patterns enabling full functionality
- Comprehensive timeout protection on all async operations

## Documentation Created

### New Documentation Files

- **docs/SERVICES.md** (450+ lines)
  - Complete services architecture overview
  - Function signatures and usage examples
  - Configuration, environment variables, types
  - Error handling patterns
  - Future enhancement suggestions

- **docs/COMPONENTS.md** (400+ lines)
  - Component architecture and data flow
  - Detailed function documentation for ZooniverseImageLoader, useSubjectLoader, useCaesarReductions
  - Critical hooks refactoring explanation
  - Integration points between services and components
  - Performance considerations and optimization opportunities

- **docs/debugging/HOOKS_DEBUGGING.md** (500+ lines)
  - Root causes of React hooks violations
  - Real-world case study from this refactoring
  - Solutions with before/after code examples
  - Prevention best practices
  - Diagnostic checklist
  - Common patterns to avoid
  - Debugging tools and techniques

## Impact Summary

### User-Facing
- ✅ Can click "Next subject" multiple times without errors
- ✅ Caesar ML annotations load and display correctly
- ✅ Subject queue management works seamlessly

### Developer Experience
- ✅ Services layer is DRY and maintainable
- ✅ Security vulnerability (GraphQL injection) fixed
- ✅ Clear patterns for hooks usage in components
- ✅ Comprehensive documentation for future work
- ✅ Better understanding of React hooks constraints

### Code Health
- ✅ Type safety improved (Caesar API types, component props)
- ✅ Security improved (parameterized GraphQL queries)
- ✅ Performance improved (memoized clients, ref-based state)
- ✅ Maintainability improved (less boilerplate, clear patterns)
- ✅ Testability improved (extracted utilities, pure functions)

## Recommendations for Future Work

### Short Term
- Add unit tests for `utils/coordinates.ts` coordinate transformations
- Add integration tests for multi-subject workflow
- Document environment variable configuration

### Medium Term
- Implement request caching with TTL for Caesar API
- Add exponential backoff retry logic to apiClient
- Extract useSubjectQueue to custom hook library
- Implement browser DevTools integration for debugging

### Long Term
- Monitor React version updates for hooks improvements
- Consider migrating to React Query for server state
- Evaluate GraphQL subscription support for real-time updates
- Plan performance optimization for large annotation sets

## Conclusion

This refactoring improved both the services layer architecture and the component patterns. The root cause of the hooks violation was calling hooks conditionally (before guard clauses) and inside loops, violating React's fundamental rules. By moving hooks to unconditional positions and extracting child components, the application now handles multi-subject workflows correctly while maintaining type safety and security.

## Post-Refactoring Enhancements: Caesar Annotation UI/UX

### Caesar Annotation Cursors (April 2026)

**Feature**: Dynamic SVG-based cursors for Caesar annotation rectangles providing visual feedback about zoom behavior.

**Implementation Details**:
- **Unselected annotation**: Magnifying glass with **+** symbol (zoom in)
- **Selected annotation**: Magnifying glass with **−** symbol (zoom out)
- **Cursor composition**: SVG pointer arrow (upper-left) + magnifying glass lens + zoom symbol
- **Hotspot**: (0, 0) at pointer tip to indicate exact click position
- **Behavior**: Maintained during mousemove for smooth UX within hit buffer zone

**Files Modified**:
- `src/components/CaesarAnnotationOverlay/constants.ts` — Added `getAnnotationCursor()` function and SVG cursor data URIs
- `src/components/CaesarAnnotationOverlay/useCaesarAnnotationTooltip.ts` — Enhanced to accept `isSelected` parameter and set dynamic cursors in both `handleMouseEnter` and `handleMouseMove`
- `src/components/CaesarAnnotationOverlay/CaesarAnnotationOverlay.tsx` — Pass selection state to tooltip hook
- `src/components/ImageCanvas/ImageCanvas.tsx` — Pass `selectedCaesarAnnotation` to overlay, change rectangle hover cursor from `'not-allowed'` to `'auto'` to allow custom cursor display

**Benefits**:
- Visual feedback on annotation state without text tooltips
- Clear indication of zoom direction before clicking
- Improved discoverability of annotation selection feature
- Professional UI polish
