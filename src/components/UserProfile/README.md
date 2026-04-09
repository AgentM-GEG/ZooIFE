# UserProfile Component

## Overview

The `UserProfile` component displays the currently logged-in user's profile information in the application header. It shows the user's avatar (or a default user icon) along with their display name or login handle.

## Architecture

### Component Structure

```
UserProfile/
├── UserProfile.tsx          # Main component (display only)
├── types.ts                 # Type definitions
├── styled.ts                # Styled components
├── constants.ts             # Magic numbers and configuration
└── README.md               # This file
```

### Data Flow

```
useUserStore()
    ↓
{user, isLoading}
    ↓
UserProfile Component
    ↓
Avatar (if avatar_url provided)
DefaultAvatar (if no avatar_url)
    +
DisplayName
```

## Component API

### UserProfile Props

The `UserProfile` component is **self-contained** and takes no props:

```typescript
export function UserProfile() {
  // Internally fetches user data from useUserStore()
}
```

### Internal Dependencies

- **`useUserStore()`**: Zustand store providing:
  - `user`: User object with `avatar_url`, `display_name`, and `login`
  - `isLoading`: Boolean indicating loading state

### Type Definitions

Located in `types.ts`:

```typescript
export interface UserProfileProps {
  // Component is self-contained, no props required
}

export interface UserDisplayInfo {
  avatar_url?: string;
  display_name?: string;
  login: string;
}
```

## Styling

All styled components are defined in `styled.ts`:

- **`UserProfileContainer`**: Flex container for layout
  - Uses `display: flex` with centered alignment
  - Applies `gap: sm` spacing from theme
  
- **`Avatar`**: Image element for user avatar
  - Fixed size: 36×36px
  - Circular with `border-radius: 50%`
  - 2px border using theme's inverse text color
  - `object-fit: cover` to maintain aspect ratio

- **`DefaultAvatar`**: Fallback container when `avatar_url` unavailable
  - Same 36×36px size as Avatar for consistency
  - Matches Avatar styling (border, color)
  - Flex centering for SVG icon
  - Dark background from theme
  - Flex-shrink prevention

- **`DisplayName`**: Text label for user name
  - Small font size from theme
  - Medium font weight
  - Inverse text color
  - No text wrapping (`white-space: nowrap`)

## Constants

Defined in `constants.ts`:

```typescript
AVATAR_SIZE = 36                    // Avatar width and height in pixels
AVATAR_BORDER_WIDTH = 2             // Avatar border thickness
DEFAULT_AVATAR_ICON_SIZE = 20       // SVG icon size inside default avatar
USER_ICON_PATH = '...'              // SVG path (unused but available)
```

## Usage Examples

### Basic Usage

```tsx
import { UserProfile } from '@/components/UserProfile';

export function Header() {
  return (
    <header>
      <UserProfile />
    </header>
  );
}
```

### Integration with Layout

```tsx
import { UserProfile } from '@/components/UserProfile';

export function AppHeader() {
  return (
    <div className="header">
      <Logo />
      <nav>Navigation</nav>
      <UserProfile />  {/* Displays on right side */}
    </div>
  );
}
```

## Behavior

### Loading State
- Component returns `null` if `user` is not loaded or `isLoading` is true
- No placeholder shown during load (parent header handles layout shift)

### Avatar Display Priority
1. If `user.avatar_url` exists → Display image
2. Otherwise → Show default user icon

### Display Name Priority
1. If `display_name` exists → Show `display_name`
2. Otherwise → Show `login` (username)

### Accessibility
- Avatar images have `alt` text with user's name
- Titles on avatar elements show on hover
- Icon is contained in semantic `div` (not interactive)

## Testing Checklist

### Unit Tests
- [ ] Component renders null when `user` is undefined
- [ ] Component renders null when `isLoading` is true
- [ ] Avatar image displays when `user.avatar_url` provided
- [ ] Default avatar displays when `user.avatar_url` is null/undefined
- [ ] Display name shows `display_name` when available
- [ ] Falls back to `login` when `display_name` unavailable
- [ ] Alt text and titles set correctly on avatar

### Integration Tests
- [ ] UserProfile properly consumes `useUserStore()`
- [ ] Updates when `useUserStore()` updates
- [ ] Styled components render without errors
- [ ] Layout aligns correctly in header context

### Visual Regression Tests
- [ ] Avatar displays at 36×36px
- [ ] Border is 2px thick
- [ ] Default icon is 20×20px
- [ ] Text color matches inverse theme color
- [ ] Spacing and alignment match design system

### Responsive Design
- [ ] Component scales appropriately in header
- [ ] Text doesn't wrap (`white-space: nowrap` works)
- [ ] Avatar doesn't distort on any size

## Performance Characteristics

- **Memoization**: Currently not memoized (lightweight component)
- **Store Subscriptions**: Single subscription to `useUserStore()`
- **Re-render Triggers**: Only when user object or loading state changes
- **DOM Updates**: Minimal when display name or avatar changes

### Optimization Opportunities (Future)

1. **Memoization**: Can wrap with `React.memo()` if header re-renders frequently
   ```typescript
   export const UserProfile = React.memo(function UserProfile() { ... });
   ```

2. **Avatar Image Optimization**:
   - Add `loading="lazy"` attribute
   - Implement image preloading in `useUserStore()`
   - Add image error handling with fallback

3. **Store Selector**: Create typed selector in `useUserStore()` for subset:
   ```typescript
   const user = useUserStore(state => ({
     avatar_url: state.user?.avatar_url,
     displayName: state.user?.display_name || state.user?.login,
     isLoading: state.isLoading
   }));
   ```

## Common Patterns

### Updating User Profile
User profile automatically updates when `useUserStore` is updated after login/logout:

```typescript
// In auth flow
const { setUser } = useUserStore();
setUser(userData);  // UserProfile re-renders automatically
```

### Hiding on Mobile
If responsive design requires hiding on small screens:

```tsx
// In parent header component
<div className="profile-wrapper">
  <UserProfile /> {/* Wrap with media query styles */}
</div>
```

## Debugging

### Component Not Displaying
1. Check if `useUserStore()` is properly initialized
2. Verify user object has `login` field (required fallback)
3. Check if parent is rendering the component

### Avatar Not Loading
1. Verify `user.avatar_url` is a valid URL
2. Check browser Network tab for 404s
3. Verify CORS if image from external domain

### Style Issues
1. Check if theme is provided in root (`_app.tsx`)
2. Verify styled-components are properly imported
3. Inspect element to verify CSS rules applied

## Future Enhancements

1. **User Menu Integration**: Add click handler to open profile menu
   ```typescript
   const [isMenuOpen, setIsMenuOpen] = useState(false);
   <UserProfileContainer onClick={() => setIsMenuOpen(!isMenuOpen)}>
     ...
   </UserProfileContainer>
   ```

2. **Avatar Upload**: Allow user to change their avatar
   - Add input field within component
   - Trigger image upload to backend
   - Update store after upload

3. **Status Indicator**: Add online/offline status badge
   ```typescript
   <StatusBadge status={user.status} />
   ```

4. **User Preferences Dropdown**: Quick access to settings
   - Settings link
   - Preferences link
   - Logout button

5. **Skeleton Loading**: Better UX during load
   ```typescript
   if (isLoading) return <Skeleton width={120} height={36} />;
   ```

6. **Avatar Fallback Widget**: Generate avatar from initials
   ```typescript
   <InitialsAvatar name={user.display_name} />
   ```

## Related Components

- **[AuthContext](../auth/AuthContext.tsx)**: Manages authentication state
- **[UserProfile Store](../../stores/userStore.ts)**: Zustand store for user state
- **Header**: Parent component that displays UserProfile

## Files Reference

- **Component**: [UserProfile.tsx](./UserProfile.tsx) (21 lines)
- **Types**: [types.ts](./types.ts) (13 lines)
- **Styles**: [styled.ts](./styled.ts) (35 lines)
- **Constants**: [constants.ts](./constants.ts) (12 lines)
  
**Total: 81 lines** (down from 82 lines pre-refactoring)

## Summary

The UserProfile component is a lightweight display component that integrates with the `useUserStore()` to show user information in the header. Its modular structure separates concerns (types, styles, constants) to improve maintainability and enable easy future enhancements like status indicators or interactive menu options.
