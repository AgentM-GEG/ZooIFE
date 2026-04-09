# Login Component

## Overview

The `Login` component provides authentication controls for the application. It displays a **Login button** when the user is not authenticated, and a **Logout button** when authenticated. The component integrates with the Zooniverse authentication system via the `AuthContext`.

## Architecture

### Component Structure

```
Login/
├── Login.tsx          # Main component (display + logic)
├── types.ts           # Type definitions
├── styled.ts          # Styled components
├── constants.ts       # Button text constants
└── README.md         # This file
```

### Data Flow

```
AuthContext (useAuth)
    ↓
{token, login, logout}
    ↓
Login Component
    ↓
  Button (Login)      [if !token]
    or
  Button (Logout)     [if token]
```

## Component API

### Login Props

The `Login` component is **self-contained** and takes no props:

```typescript
export function Login() {
  // Internally manages auth state via useAuth()
}
```

### Internal Dependencies

- **`useAuth()`**: Hook from AuthContext providing:
  - `token`: Authentication token (string or null)
  - `login()`: Function to initiate login flow
  - `logout()`: Function to logout user

### Type Definitions

Located in `types.ts`:

```typescript
export interface LoginProps {
  // Component is self-contained, no props required
}

export interface AuthState {
  token?: string | null;
  login: () => void;
  logout: () => void;
}
```

## Styling

All styled components are defined in `styled.ts`:

- **`Container`**: Wrapper div
  - `display: inline-block` for proper button sizing
  - Allows flexible placement in headers/toolbars

- **`Button`**: Authentication button
  - Padding: `sm` (vertical) + `lg` (horizontal) from theme
  - Background: secondary color
  - Border: 1px solid primary color
  - Border radius: base from theme
  - Text color: inverse (white text on dark background)
  - Font: small size, medium weight from theme
  - Transitions: smooth on all properties
  - **Hover State**: 
    - Background switches to primary
    - Text becomes secondary color
  - **Active State**: 
    - Scale down 5% (0.95) for tactile feedback

## Constants

Defined in `constants.ts`:

```typescript
LOGIN_BUTTON_TEXT = 'Login to Zooniverse'      // Text shown when not authenticated
LOGOUT_BUTTON_TEXT = 'Logout of Zooniverse'    // Text shown when authenticated
```

## Usage Examples

### Basic Usage

```tsx
import { Login } from '@/components/Login';

export function Header() {
  return (
    <header>
      <Logo />
      <Login />
    </header>
  );
}
```

### In Navigation Bar

```tsx
import { Login } from '@/components/Login';

export function Navigation() {
  return (
    <nav>
      <div className="nav-left">
        <Link to="/home">Home</Link>
        <Link to="/projects">Projects</Link>
      </div>
      <div className="nav-right">
        <Login />
      </div>
    </nav>
  );
}
```

### With User Profile (Conditional)

```tsx
import { Login } from '@/components/Login';
import { UserProfile } from '@/components/UserProfile';
import { useAuth } from '@/auth/AuthContext';

export function HeaderControls() {
  const { token } = useAuth();

  return (
    <div className="header-controls">
      {token ? (
        <UserProfile />
      ) : (
        <Login />
      )}
    </div>
  );
}
```

## Behavior

### Initial State (Unauthenticated)
- Shows **Login Button**
- User can click to start OAuth flow with Zooniverse
- Triggers `login()` function from AuthContext

### Authenticated State
- Shows **Logout Button**
- User can click to clear authentication
- Triggers `logout()` function from AuthContext
- Typically redirects to login page or home

### State Transitions
```
Unauthenticated ─[click Login]──> OAuth Flow ─[success]──> Authenticated
      ↑                                                           │
      │ [click Logout]                                            │
      └────────────────────────────────────────────────────────┘
```

### Token Validation
- Component conditionally renders based on `token` existence
- `token` can be string or null/undefined
- Falsy check: `!token` works for all unauthenticated cases

## Testing Checklist

### Unit Tests
- [ ] Component renders login button when token is null
- [ ] Component renders logout button when token exists
- [ ] Component renders login button when token is undefined
- [ ] Clicking login button calls `login()` function
- [ ] Clicking logout button calls `logout()` function
- [ ] Button text displays correctly (from constants)
- [ ] Button styling applied correctly

### Integration Tests
- [ ] Component properly uses AuthContext
- [ ] Responds to token changes from AuthContext
- [ ] Works with OAuth flow from AuthContext
- [ ] Styled components render without errors

### Visual Tests
- [ ] Login button visible and clickable
- [ ] Logout button visible and clickable
- [ ] Hover state appears (color change)
- [ ] Active state appears (scale down)
- [ ] Button text readable (contrast adequate)
- [ ] Container properly sized for button

### Functional Tests
- [ ] Login button initiates OAuth when clicked
- [ ] Logout button clears auth when clicked
- [ ] Component re-renders when auth state changes
- [ ] Works on desktop and mobile

## Performance Characteristics

- **Memoization**: Currently not memoized (very lightweight)
- **Hook Subscriptions**: Single subscription to `useAuth()`
- **Re-render Triggers**: Only when `token` or auth functions change
- **DOM Updates**: Single button element, minimal rendering

### Optimization Opportunities (Future)

1. **Memoization**: Can wrap with `React.memo()` if parent header re-renders frequently
   ```typescript
   export const Login = React.memo(function Login() { ... });
   ```

2. **Loading State**: Add disabled state during OAuth flow
   ```typescript
   const [isLoading, setIsLoading] = useState(false);
   
   const handleLogin = async () => {
     setIsLoading(true);
     await login();
     setIsLoading(false);
   };
   
   <Button onClick={handleLogin} disabled={isLoading}>
     {isLoading ? 'Logging in...' : LOGIN_BUTTON_TEXT}
   </Button>
   ```

3. **Error Handling**: Display error messages if OAuth fails
   ```typescript
   const { token, login, logout, error } = useAuth();
   {error && <ErrorMessage>{error}</ErrorMessage>}
   ```

## Common Patterns

### Combining Login and UserProfile
```tsx
// Header component conditionally shows login or profile
<HeaderRight>
  {token ? <UserProfile /> : <Login />}
</HeaderRight>
```

### Protecting Routes
```tsx
// Use login state to gate route access
const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Login />;
};
```

### Login Callbacks
```tsx
// Run code after successful login
const handleLogin = async () => {
  await login();
  // Refresh data, navigate, etc.
};
```

### Loading During OAuth
```tsx
// Disable button while OAuth is processing
<Button onClick={login} disabled={isLoading}>
  {isLoading ? 'Authenticating...' : LOGIN_BUTTON_TEXT}
</Button>
```

## Debugging

### Button Not Responding
1. Check if `useAuth()` is properly initialized in root component
2. Verify `login()` and `logout()` functions exist in AuthContext
3. Check browser console for JavaScript errors
4. Verify event handler is firing (add logging)

### OAuth Not Starting
1. Check if OAuth provider is configured in AuthContext
2. Verify API keys/credentials are set
3. Check network requests in browser Network tab
4. Look for CORS errors if OAuth endpoint different domain

### Token Not Updating
1. Verify AuthContext is updating state after login/logout
2. Check if component properly subscribed to token changes
3. Look for stale context issues
4. Verify Redux/Zustand store if applicable

### Styling Issues
1. Check if theme is provided in root component
2. Verify styled-components are properly imported
3. Check browser DevTools for CSS rule application
4. Verify color values exist in theme

## Future Enhancements

1. **Loading Indicator**: Show spinner during OAuth
   ```typescript
   const [isLoading, setIsLoading] = useState(false);
   <Button disabled={isLoading}>
     {isLoading && <Spinner />}
     {LOGIN_BUTTON_TEXT}
   </Button>
   ```

2. **OAuth Provider Selection**: Multiple login options
   ```typescript
   <Button onClick={() => login('zooniverse')}>Zooniverse</Button>
   <Button onClick={() => login('google')}>Google</Button>
   ```

3. **Error Messages**: Display auth failures
   ```typescript
   {authError && <ErrorAlert>{authError}</ErrorAlert>}
   ```

4. **Remember Me**: Persist auth state
   ```typescript
   <label>
     <input type="checkbox" onChange={handleRememberMe} />
     Remember me
   </label>
   ```

5. **Two-Factor Auth**: Support 2FA flows
   ```typescript
   {needs2FA ? <TwoFactorPrompt /> : <LoginButton />}
   ```

6. **Social Login**: Add social provider buttons
   ```typescript
   <GoogleLoginButton />
   <FacebookLoginButton />
   ```

7. **Session Timeout Warning**: Warn before logout
   ```typescript
   <Alert severity="warning">
     Session expires in 5 minutes
   </Alert>
   ```

8. **Keyboard Support**: Add keyboard shortcuts
   ```typescript
   useEffect(() => {
     const handleKeyDown = (e) => {
       if (e.key === 'Enter') handleLogin();
     };
     // Attach listener
   }, [token]);
   ```

## Related Components

- **[AuthContext](../../auth/AuthContext.tsx)**: Manages authentication state and OAuth flow
- **[UserProfile](../UserProfile/UserProfile.tsx)**: Displays currently logged-in user
- **Header**: Typically parent component displaying Login

## Files Reference

- **Component**: [Login.tsx](./Login.tsx) (14 lines)
- **Types**: [types.ts](./types.ts) (10 lines)
- **Styles**: [styled.ts](./styled.ts) (27 lines)
- **Constants**: [constants.ts](./constants.ts) (5 lines)

**Total: 56 lines** (down from 48 lines pre-refactoring, +8 from enhanced structure)

## Summary

The Login component is a lightweight authentication UI control that seamlessly integrates with the Zooniverse OAuth system via AuthContext. Its modular structure makes it easy to add features like loading states, error messages, or multiple authentication providers while keeping the core component clean and maintainable.
