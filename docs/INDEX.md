# Documentation Index

Welcome to ZooIFE documentation! This guide helps you navigate the project documentation.

## Quick Links

### Getting Started
- **[Main README](../README.md)** — Project overview, prerequisites, quick start guide

### Architecture & Design

#### [SOLUTION_ARCHITECTURE.md](SOLUTION_ARCHITECTURE.md)
High-level system architecture with diagrams and component relationships. Start here for understanding the big picture.

#### [AUTH.md](AUTH.md) ⭐
**Complete guide to authentication system** — OAuth 2.0 flow, token management, refresh scheduling.

**Key sections**:
- OAuth flow and callback handling
- Token refresh with automatic scheduling and exponential backoff
- User details fetching
- Configuration and environment variables
- Security considerations
- Usage in components

**Use this when**:
- Implementing login/logout
- Understanding how tokens work
- Debugging authentication issues
- Configuring OAuth endpoints
- Adding authentication to new components

#### [SERVICES.md](SERVICES.md) ⭐ 
**Complete reference for the services layer** — API clients, integrations, types, and utilities.

**Key sections**:
- `apiClient.ts` — Generic HTTP wrapper for Zooniverse endpoints
- `panoptesService.ts` — Zooniverse REST API (subjects, workflows, classifications)
- `caesarService.ts` — Caesar ML GraphQL API with security fixes
- `imageService.ts` — Image loading and normalization with timeout protection
- `sam2Service.ts` — Segment Anything 2.0 integration

**Use this when**:
- Adding new API endpoints
- Understanding how services integrate
- Debugging API calls
- Looking up function signatures

#### [COMPONENTS.md](COMPONENTS.md) ⭐
**Reference for key components and hooks** — Data flow, component patterns, hooks usage.

**Key sections**:
- `ZooniverseImageLoader.tsx` — Subject loading component
- `useSubjectLoader.ts` — Subject queue management hook
- `useCaesarReductions.ts` — Caesar ML annotation fetching
- `CaesarAnnotationOverlay.tsx` — Annotation rendering (critical hooks refactoring)
- React hooks best practices and patterns

**Use this when**:
- Understanding component data flow
- Creating new components that load subjects
- Learning React hooks patterns
- Checking component prop signatures

#### [CLASSIFICATION_EXPORT.md](CLASSIFICATION_EXPORT.md) ⭐
**Complete reference for classification export format and rect-annotations** — Data structures, examples, and processing guidelines.

**Key sections**:
- Rect annotations structure (primary format)
- Drawing annotations and task answers
- CompressedMask format and encoding options
- Example classifications
- Backend processing guidelines
- Compression and mask decoding examples
- FAQ

**Use this when**:
- Exporting classifications to Panoptes
- Understanding the annotation data structure
- Processing compressed masks
- Integrating with backend systems
- Analyzing user annotations programmatically

### Debugging & Troubleshooting

#### [HOOKS_DEBUGGING.md](HOOKS_DEBUGGING.md) ⭐ 
**Comprehensive guide to React hooks violations and solutions** — Real case study from this project.

**Key sections**:
- Error message guide
- Root cause analysis (3 problem patterns we found)
- Solutions with before/after code
- Prevention best practices
- Diagnostic checklist
- Common patterns to avoid

**Use this when**:
- You see "rendered fewer hooks" or "rendered more hooks" errors
- You want to understand why hooks have strict rules
- You're writing new components with hooks
- You need to debug state/rendering issues

#### [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md)
**Summary of refactoring work completed** — What changed, why, and what was fixed.

**Two phases**:
1. **Services Layer Refactoring** (100+ lines of boilerplate removed, security fix)
2. **React Hooks Debugging** (Critical bugs fixed for multi-subject workflow)

**Use this when**:
- Understanding recent code changes
- Learning about security improvements (GraphQL injection fix)
- Understanding hooks problems and solutions
- Reviewing refactoring decisions

## By Role

### I'm a **Frontend Developer** working on Components
1. Start with [COMPONENTS.md](COMPONENTS.md)
2. Understand hooks patterns from [HOOKS_DEBUGGING.md](HOOKS_DEBUGGING.md)
3. Use [SERVICES.md](SERVICES.md) to understand data dependencies
4. Use [AUTH.md](AUTH.md) for authentication

### I'm **Adding a New Service or API Endpoint**
1. Read the relevant section in [SERVICES.md](SERVICES.md)
2. Look at similar services for patterns
3. Check [SOLUTION_ARCHITECTURE.md](SOLUTION_ARCHITECTURE.md) for integration points

### I'm **Working on Authentication or User Login**
1. Start with [AUTH.md](AUTH.md)
2. Understand the OAuth flow diagram
3. Check [COMPONENTS.md](COMPONENTS.md) for using `useAuth()` hook
4. Review configuration in [AUTH.md](AUTH.md) constants section

### I'm a **Backend Developer** working with classifications
1. Start with [CLASSIFICATION_EXPORT.md](CLASSIFICATION_EXPORT.md) — Understand the export format
2. Learn about rect-annotations structure and CompressedMask encoding
3. Use the decoding examples for processing masks
4. Review the complete classification example and FAQ

### I'm **Debugging an Error**
1. If it's a React hooks error → [HOOKS_DEBUGGING.md](HOOKS_DEBUGGING.md)
2. If it's an API error → [SERVICES.md](SERVICES.md)
3. If it's an auth error → [AUTH.md](AUTH.md)
4. For overall system behavior → [COMPONENTS.md](COMPONENTS.md) or [SOLUTION_ARCHITECTURE.md](SOLUTION_ARCHITECTURE.md)

### I'm **Onboarding and Learning the Codebase**
1. [Main README](../README.md) — Project overview
2. [SOLUTION_ARCHITECTURE.md](SOLUTION_ARCHITECTURE.md) — System design
3. [AUTH.md](AUTH.md) — Authentication system
4. [SERVICES.md](SERVICES.md) — API layer
5. [COMPONENTS.md](COMPONENTS.md) — UI layer
6. [HOOKS_DEBUGGING.md](HOOKS_DEBUGGING.md) — Best practices

## Documentation Files

| File | Purpose | Length | Audience |
|------|---------|--------|----------|
| [AUTH.md](AUTH.md) | Authentication system reference | 400+ lines | All developers using login |
| [SERVICES.md](SERVICES.md) | Services architecture reference | 450+ lines | Developers working with APIs |
| [COMPONENTS.md](COMPONENTS.md) | Component and hooks reference | 400+ lines | Frontend developers |
| [CLASSIFICATION_EXPORT.md](CLASSIFICATION_EXPORT.md) | Classification export format reference | 500+ lines | Backend developers, data analysts |
| [HOOKS_DEBUGGING.md](HOOKS_DEBUGGING.md) | React hooks guide | 500+ lines | All developers using hooks |
| [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md) | What changed and why | 300+ lines | Code reviewers, maintainers |
| [SOLUTION_ARCHITECTURE.md](SOLUTION_ARCHITECTURE.md) | System architecture | Varies | System designers, architects |

## Key Concepts

### Services Layer

The **services layer** (`src/services/`) provides abstraction over:
- **Panoptes REST API** — Zooniverse subjects, workflows, classifications
- **Caesar GraphQL API** — Machine learning annotations
- **Image processing** — Loading, normalization, EXIF handling
- **SAM2 integration** — Point-driven segmentation

All services use consistent error handling and timeout protection. See [SERVICES.md](SERVICES.md).

### Components & Hooks

The **component layer** uses specialized hooks for managing:
- **Data loading** — `useSubjectLoader` for Panoptes queue
- **ML integration** — `useCaesarReductions` for Caesar API
- **GraphQL client** — `useCaesarClient` for Apollo/graphql-request

All hooks follow React's rules of hooks. See [COMPONENTS.md](COMPONENTS.md) and [HOOKS_DEBUGGING.md](HOOKS_DEBUGGING.md).

### React Hooks Rules

This project follows strict React hooks patterns:

1. **Call hooks unconditionally** — Always at the top level of components
2. **Consistent order** — Same hooks in same order on every render
3. **No hooks in loops** — Extract to child components if needed
4. **No hooks in conditions** — Move conditions after hooks

See [HOOKS_DEBUGGING.md](HOOKS_DEBUGGING.md) for detailed explanations and common mistakes.

## Recent Changes

### Phase 1: Services Refactoring
- ✅ Created `apiClient.ts` (generic HTTP wrapper)
- ✅ Security: Fixed GraphQL injection vulnerability
- ✅ Extracted `utils/coordinates.ts` for SAM2 utilities
- ✅ Modernized `imageService` (promise chains → async/await)

### Phase 2: Hooks Debugging
- ✅ Fixed `CaesarAnnotationOverlay` (hooks in loop)
- ✅ Fixed `ZooniverseImageLoader` (guards before hooks)
- ✅ Fixed `useSubjectLoader` (state-driven hook counts)
- ✅ Multi-subject workflow now works without errors

See [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md) for full details.

## FAQ

**Q: Where do I add a new API call?**
A: Add it to the appropriate service file in `src/services/`. Use the patterns shown in [SERVICES.md](SERVICES.md). Likely use `apiClient.apiCall()` for REST or GraphQLClient for GraphQL.

**Q: I'm getting a "rendered fewer hooks" error**
A: Most common causes are listed in [HOOKS_DEBUGGING.md](HOOKS_DEBUGGING.md) with solutions.

**Q: How do I load the next subject?**
A: Use the `useSubjectLoader` hook. Example in [COMPONENTS.md](COMPONENTS.md).

**Q: How do I implement login/logout in my component?**
A: Use the `useAuth()` hook. See [AUTH.md](AUTH.md) "Usage in Components" section.

**Q: Where is the OAuth / authentication handled?**
A: See [AUTH.md](AUTH.md) and `src/auth/` folder. Also see [Main README](../README.md) for OAuth server setup.

**Q: How do I get the current user?**
A: Use `useUserStore()` from Zustand. See [AUTH.md](AUTH.md) "Usage in Components" section.

**Q: How do I configure OAuth endpoints?**
A: Edit environment variables in `.env` or `src/auth/constants.ts`. See [AUTH.md](AUTH.md) "Configuration" section.

**Q: How does Caesar ML integration work?**
A: See "Caesar Annotation Overlay" section in [COMPONENTS.md](COMPONENTS.md) and "caesarService.ts" in [SERVICES.md](SERVICES.md).

**Q: Where are the images coming from?**
A: Zooniverse `subjects` are queued via `panoptesService.getQueuedSubjects()`. See [SERVICES.md](SERVICES.md) for details.

## Contributing

When making changes:

1. **Check relevant documentation** — Understand the pattern before changing it
2. **Follow existing patterns** — Keep consistency for maintainability
3. **Update documentation** — If you change architecture or add new patterns
4. **Test carefully** — Especially for hooks and state management
5. **Run linting** — `npm run lint` catches hooks issues

## Resources

- [React Hooks Rules](https://react.dev/reference/rules/rules-of-hooks)
- [React Hooks API](https://react.dev/reference/react)
- [Zooniverse Panoptes API](https://panoptes.zooniverse.org/apidocs)
- [Caesar Project](https://caesar.zooniverse.org/)
- [SAM2 Project](https://github.com/facebookresearch/sam2)

## Questions or Issues?

Refer to the appropriate documentation file above. Most answers are in:
- Hooks issues → [HOOKS_DEBUGGING.md](HOOKS_DEBUGGING.md)
- API issues → [SERVICES.md](SERVICES.md)
- Component issues → [COMPONENTS.md](COMPONENTS.md)
- Architecture questions → [SOLUTION_ARCHITECTURE.md](SOLUTION_ARCHITECTURE.md)
