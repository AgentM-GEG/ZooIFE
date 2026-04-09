# React Hooks Debugging Guide

This document captures the lessons learned from debugging React hooks violations during the ZooIFE refactoring, including what went wrong, how to diagnose it, and how to avoid it.

## The Problem: Hook Count Violations

### Error Messages

You might see one of these errors in development:

```
Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
```

```
Error: Rendered more hooks than during the previous render.
```

```
Error: React has detected a change in the order of Hooks called by ComponentName.
```

### Root Cause

React tracks hook instances by their **execution order in the render function**. If hooks are called conditionally or in different orders between renders, React can't match them correctly.

```
Render 1: hook1() → hook2() → hook3()
Render 2: hook1() → hook2()              ← hook3 missing! ERROR
```

## Real-World Case Study: ZooniverseImageLoader

### Phase 1: The Guard Clause Problem

Initial implementation:

```typescript
export function ZooniverseImageLoader() {
  const { token } = useAuth();
  
  // ❌ PROBLEM: Guard before hooks
  if (!token?.access_token) {
    return <Container />;
  }

  // ❌ These hooks only called when authenticated
  const caesarClient = useCaesarClient(accessToken, CAESAR_REDUCTION_OPTS);
  const processCaesarReductions = useCaesarReductions(...);
  const { loadNextSubject } = useSubjectLoader(...);
  
  return <Container><Button>Next subject</Button></Container>;
}
```

**What happened**: On first render, token is loaded from localStorage. On second render, token changes (refresh, AuthContext update), causing component to re-render. The guard condition might be true the first render (call hooks) but false the second (don't call hooks), or vice versa.

**Error pattern**: "Rendered fewer hooks than expected"

### Phase 2: The Hooks-in-Loop Problem

When annotations were being mapped:

```typescript
export function CaesarAnnotationOverlay({ annotations }) {
  return (
    <>
      {annotations.map((annotation) => {
        // ❌ PROBLEM: Hook call inside loop
        const tooltipHandlers = useCaesarAnnotationTooltip(...);
        return <Rect ... />;
      })}
    </>
  );
}
```

**What happened**: First click loads 5 annotations → `useCaesarAnnotationTooltip` called 5 times. Second click loads 6 annotations (different subject) → hook called 6 times. React detects mismatch.

**Error pattern**: "React has detected a change in the order of Hooks [...] change in the number of calls"

**Error message hint**: The diff showed hook 805 was `undefined` initially, then became `useCallback` on second render.

## Solutions

### Solution 1: Move Guards After Hooks ✅

```typescript
export function ZooniverseImageLoader() {
  const { token } = useAuth();

  // ✅ Call ALL hooks unconditionally first
  const accessToken = token?.access_token;
  const caesarClient = useCaesarClient(accessToken, CAESAR_REDUCTION_OPTS);
  const processCaesarReductions = useCaesarReductions(caesarClient, WORKFLOW_ID, accessToken);
  const { loadNextSubject } = useSubjectLoader(accessToken, processCaesarReductions);

  // ✅ THEN do conditional rendering
  if (!accessToken) {
    return <Container />;  // Safe: guard AFTER hooks
  }

  return (
    <Container>
      <Button onClick={() => loadNextSubject()}>Next subject</Button>
    </Container>
  );
}
```

**Why this works**: Hooks are called in the same order on every render, regardless of conditionals. React can reliably track them.

**Key insight**: Guards before hooks change whether hooks execute. Guards after hooks don't affect hook execution order.

### Solution 2: Extract Child Component for Loop Hooks ✅

```typescript
// ❌ WRONG: Hook in parent's loop
function CaesarAnnotationOverlay({ annotations }) {
  return (
    <>
      {annotations.map((annotation) => {
        const tooltipHandlers = useCaesarAnnotationTooltip(...);  // ERROR!
        return <Rect ... />;
      })}
    </>
  );
}

// ✅ CORRECT: Extract hook to child component
function CaesarAnnotationRect({ annotation, ... }) {
  // Hook is at top level of this component — always called once per instance
  const tooltipHandlers = useCaesarAnnotationTooltip(...);
  return <Rect ... />;
}

function CaesarAnnotationOverlay({ annotations }) {
  return (
    <>
      {annotations
        .filter((a) => a.toolType === 'rectangle')
        .map((annotation) => (
          <CaesarAnnotationRect
            key={annotation.markId}
            annotation={annotation}
            ...
          />
        ))}
    </>
  );
}
```

**Why this works**: Each `CaesarAnnotationRect` instance is a separate component with its own hook state. The parent loop doesn't change how many times each child's hooks are called — that's determined by React's component instance tracking via `key`.

**Key insight**: Hooks must be at the top level of a component. If you need a hook "per item," put the hook in a child component, one instance per item.

### Solution 3: Use Refs for Data That Shouldn't Trigger Renders

```typescript
// In useSubjectLoader.ts
const subjectsQueueRef = useRef<Subject[] | null>(null);  // Queue data (doesn't cause renders)
const [queueSize, setQueueSize] = useState(0);           // Display state (triggers renders)

const loadNextSubject = useCallback(async () => {
  // ... fetch and update ref ...
  subjectsQueueRef.current = newSubjects;
  setQueueSize(newSubjects.length);  // Only update what we display
}, []);
```

**Why this works**: Refs update without triggering re-renders, so hook counts stay stable.

**Key insight**: If state changes would affect hook counts (by changing dependencies), use refs instead.

## Diagnostic Checklist

When you see a hooks error, check in this order:

### ✅ Check 1: Is there a guard/conditional before hooks?

```typescript
if (condition) {
  return <Empty />;
}

const data = useHook();  // ❌ Only sometimes called
```

**Fix**: Move guard after hooks.

### ✅ Check 2: Are hooks called inside loops or conditionals?

```typescript
items.map(item => {
  const handler = useHook();  // ❌ Called N times
  return <Item ... />;
})

// OR

if (foo) {
  const data = useHook();  // ❌ Sometimes called
}
```

**Fix**: Extract to child component (for loops) or move guard after hooks (for conditionals).

### ✅ Check 3: Do hooks depend on state that varies?

```typescript
const [count, setCount] = useState(0);
const data = useMemo(() => compute(), [count]);  // Changed every render

// If compute() creates new objects, callback dependencies can change
const handler = useCallback(() => handle(data), [data]);  // Unstable
```

**Fix**: Use refs for non-display state, or memoize expensive computations.

### ✅ Check 4: Are multiple hooks cascading dependencies?

```typescript
const caesarClient = useMemo(() => createClient(token), [token]);  // Changes when token changes
const reductions = useMemo(() => fetch(caesarClient), [caesarClient]);  // Changes when client changes
const handler = useCallback(() => process(reductions), [reductions]);  // Changes when reductions change
```

**Fix**: Use refs to store intermediate values without triggering dependency chains.

### ✅ Check 5: Is React running in StrictMode?

Strict Mode (development only) double-invokes effects to catch bugs. If error only appears in Strict Mode:

```typescript
// In main.tsx or root component
<React.StrictMode>
  <App />
</React.StrictMode>
```

**Fix**: The error still indicates a real problem (caught by Strict Mode). Don't disable Strict Mode; fix the hooks violation.

## Prevention Best Practices

### 1. **Always Call Hooks Unconditionally**

```typescript
// ✅ Good
function Component() {
  const state = useState(0);
  const memo = useMemo(() => compute(), []);
  const effect = useEffect(() => {}, []);
  
  if (condition) return <Empty />;
  return <Content />;
}
```

### 2. **Keep Hook Order Consistent**

```typescript
// ✅ Good: Same hooks in same order regardless of input
function Component({ data }) {
  const state = useState(data);
  const computed = useMemo(() => compute(data), [data]);
  const callback = useCallback(() => handle(), []);
  
  return <Content />;
}

// ❌ Bad: Hook count changes with inputs
function Component({ data, isEnabled }) {
  if (isEnabled) {
    const computed = useMemo(...);  // Called sometimes
  }
  // ...
}
```

### 3. **Extract Hooks in Loops to Child Components**

```typescript
// ✅ Good
function ItemList({ items }) {
  return items.map((item) => (
    <Item key={item.id} item={item} />
  ));
}

function Item({ item }) {
  const handler = useItemHandler(item);  // One hook per instance
  return <div ... />;
}

// ❌ Bad
function ItemList({ items }) {
  return items.map((item) => {
    const handler = useItemHandler(item);  // Hook in loop
    return <div ... />;
  });
}
```

### 4. **Use Refs for Non-Display State**

```typescript
// ✅ Good
function Component() {
  const dataRef = useRef(null);  // State that doesn't trigger renders
  const [count, setCount] = useState(0);  // State that should render
  
  useEffect(() => {
    dataRef.current = fetchedData;  // Update ref, no render
  }, []);
  
  return <Content>{count}</Content>;
}
```

### 5. **Think About Dependencies Carefully**

```typescript
// ✅ Good: Stable dependencies
function Component() {
  const handler = useCallback(() => {
    // Use refs or passed values, not callback state
  }, []);  // Truly stable
  
  return <Content />;
}

// ❌ Bad: Changing dependencies unstable hooks
function Component({ data }) {
  const handler = useCallback(() => {
    return data;
  }, [data]);  // Changes every render if data is an object
}
```

## Common Patterns to Avoid

### ❌ Pattern 1: Conditional Hooks Based on Props

```typescript
function Component({ enabled }) {
  if (enabled) {
    const state = useState(0);  // ❌ Hook called sometimes
  }
  return <div />;
}
```

**Fix**: Always call hooks, use them conditionally:

```typescript
function Component({ enabled }) {
  const [state, setState] = useState(0);
  if (!enabled) {
    setState(0);  // Reset if disabled
  }
  return <div />;
}
```

### ❌ Pattern 2: Context Value Causing Cascades

```typescript
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  
  // ❌ New object every render if token changes
  const value = {
    token,
    login: () => {},
    logout: () => {},
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

**Fix**: Memoize context value:

```typescript
const value = useMemo(() => ({
  token,
  login,
  logout,
}), [token]);  // Only recreate when token changes
```

### ❌ Pattern 3: Hooks in Rendered Arrays

```typescript
function Items({ items }) {
  const rendered = items.map((item) => {
    const handler = useHandler();  // ❌ Hook in array
    return <Item handler={handler} />;
  });
  return <>{rendered}</>;
}
```

**Fix**: Use component per item:

```typescript
function Items({ items }) {
  return items.map((item) => (
    <ItemWrapper key={item.id} item={item} />
  ));
}

function ItemWrapper({ item }) {
  const handler = useHandler();  // ✅ Safe
  return <Item handler={handler} />;
}
```

## Debugging Tools

### 1. **React DevTools**

- Install [React DevTools browser extension](https://react-devtools-tutorial.vercel.app/)
- Use "Highlight updates" to see which components re-render
- Check component tree and props/state

### 2. **Error Boundaries**

Wrap components to catch rendering errors:

```typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong</h1>;
    }
    return this.props.children;
  }
}

// In app
<ErrorBoundary>
  <Component />
</ErrorBoundary>
```

### 3. **Console Logging**

```typescript
function Component() {
  console.log('Rendering Component');
  const [state, setState] = useState(0);
  console.log('After useState');
  const memo = useMemo(() => compute(), []);
  console.log('After useMemo');
  
  return <div />;
}
```

Look for missing logs on re-renders — indicates hooks not being called.

### 4. **Dependency Array Inspection**

Use VS Code's [ESLint plugin for hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks):

```typescript
"eslintConfig": {
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

This catches most violations at lint time.

## References

- [React Hooks Rules](https://react.dev/reference/rules/rules-of-hooks)
- [React Hooks API Reference](https://react.dev/reference/react)
- [Common Mistakes with React Hooks](https://kentcdodds.com/blog/common-mistakes-with-react-hooks)
- [React's useCallback and useMemo](https://react.dev/reference/react/useCallback)
