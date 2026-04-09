# Services Architecture

This document describes the services layer, which provides abstraction over external APIs (Zooniverse Panoptes, Caesar ML, SAM2) and local image processing.

## Overview

The services layer is organized into five core modules:

- **apiClient.ts** — Generic HTTP client wrapper (Zooniverse endpoints)
- **panoptesService.ts** — Zooniverse REST API (subjects, workflows, classifications)
- **caesarService.ts** — Caesar ML GraphQL API (subject reductions/annotations)
- **imageService.ts** — Image loading and normalization
- **sam2Service.ts** — Segment Anything 2.0 integration

## apiClient.ts

Generic API wrapper for Zooniverse REST endpoints. Eliminates repetitive fetch/header/error handling boilerplate.

### Key Functions

#### `apiCall<T>(baseUrl, endpoint, options)`
- **Purpose**: Make authenticated API calls to Zooniverse endpoints
- **Parameters**:
  - `baseUrl`: Production or staging API base URL
  - `endpoint`: Relative endpoint path (e.g., `/subjects/queued`)
  - `options`: Request options (token, method, body)
- **Features**:
  - Automatic Bearer token authorization
  - Consistent header handling (JSON API format)
  - Error context extraction from response
  - Type-safe response handling

#### `buildQueryString(params)`
- Converts object to URL query string, filtering out undefined values
- Handles nested object filtering safely

### Example Usage

```typescript
import { apiCall } from '@/services/apiClient';

const response = await apiCall<{ subjects: Subject[] }>(
  API_BASE,
  '/subjects/queued',
  { token: accessToken }
);
```

## panoptesService.ts

Wrapper around Zooniverse Panoptes REST API. Handles all interactions with Zooniverse platform (projects, workflows, subjects, classifications, users).

### Configuration

Environment variables control API endpoints:
- `VITE_PANOPTES_API_BASE` — Production API URL (default: `https://www.zooniverse.org/api`)
- `VITE_PANOPTES_STAGING_BASE` — Staging API URL
- `VITE_ZOONIVERSE_USE_STAGING_APIS` — Use staging endpoints (default: `false`)
- `VITE_ZOONIVERSE_WORKFLOW_ID` — Workflow UUID (default: `29070`)
- `VITE_ZOONIVERSE_SUBJECT_SET_ID` — Optional subject set ID

### Key Functions

#### `getQueuedSubjects(workflowId, token?, options?)`
- **Purpose**: Fetch next available subjects from the queue
- **Parameters**:
  - `workflowId`: UUID of workflow
  - `token`: Optional OAuth bearer token
  - `options.staging`: Use staging API
  - `options.subjectSetId`: Restrict to subject set (required for some workflows)
- **Returns**: Array of Subject objects
- **Security**: Uses optional bearer token; anonymous calls available

#### `getWorkflow(workflowId, token?, staging?)`
- **Purpose**: Fetch workflow metadata (tasks, tools, configurations)
- **Parameters**: Workflow ID, optional token, staging flag
- **Returns**: Workflow object with task/tool definitions

#### `getUserDetails(userId, token)`
- **Purpose**: Fetch authenticated user profile
- **Returns**: User object with profile data

#### `headers(token?, contentType?)`
- **Purpose**: Build headers for API calls
- **Returns**: Headers with Accept, Content-Type, optional Authorization

### Types

All types imported from `@/types/panoptes`:
- `Subject` — Zooniverse subject with locations, metadata
- `Workflow` — Workflow definition with tasks and tools
- `Classification` — User classification submission
- `User` — User profile data

## caesarService.ts

GraphQL interface to Caesar ML reduction API. Fetches machine learning annotations for subjects.

### Security Highlights

**GraphQL Injection Prevention**: Uses GraphQL variables for all parameters, not string interpolation. This prevents injection vulnerabilities.

```typescript
// ✅ SAFE: Uses variables
const FETCH_REDUCTIONS_QUERY = gql`
  query FetchSubjectReductions($workflowId: ID!, $subjectId: ID!, $reducerKey: String!) {
    workflow(id: $workflowId) {
      subject_reductions(subjectId: $subjectId, reducerKey: $reducerKey) {
        data
      }
    }
  }
`;

// ❌ UNSAFE: String interpolation (don't do this)
const query = `workflow(id: ${workflowId})`;
```

### Configuration

Environment variables:
- `VITE_CAESAR_API_BASE` — Production GraphQL endpoint (default: `https://caesar.zooniverse.org/graphql`)
- `VITE_CAESAR_STAGING_BASE` — Staging GraphQL endpoint
- `VITE_CEASAR_DEFAULT_TOOL_TYPE` — Default annotation type (default: `"default"`)

Note: Caesar uses staging/production parallel to Panoptes, controlled by `VITE_ZOONIVERSE_USE_STAGING_APIS`.

### Key Functions

#### `createCaesarClient(token, options)`
- **Purpose**: Create memoized GraphQL client
- **Parameters**:
  - `token`: Zooniverse OAuth token
  - `options.staging`: Use staging endpoint
  - `options.defaultToolType`: Default annotation tool type
- **Returns**: GraphQL client (from `graphql-request`)
- **Note**: Should be memoized in React using `useCaesarClient` hook

#### `fetchCaesarReductions(caesarClient, reducerKey, subjectId, workflowId)`
- **Purpose**: Fetch ML annotations for a subject
- **Parameters**:
  - `reducerKey`: Reduction type (typically `"machineLearnt"`)
  - `subjectId`: Zooniverse subject ID
  - `workflowId`: Zooniverse workflow ID
- **Returns**: Array of SubjectReduction objects
- **Error Handling**: Returns empty array on failure; logs errors for debugging

### Types

#### `CaesarReductionOptions`
```typescript
type CaesarReductionOptions = {
  staging: boolean;
  defaultToolType: "rectangle" | "default";
};
```

#### `SubjectReduction`
```typescript
interface SubjectReduction {
  data: CaesarAnnotations[];
}
```

Nested array structure (may contain arrays within arrays) is flattened by `useCaesarReductions` hook.

## imageService.ts

Image loading, normalization, and dimension detection.

### Key Functions

#### `loadImageAsDataUrl(file, timeoutMs?)`
- **Purpose**: Load image file or URL as base64 data URI
- **Parameters**:
  - `file`: File object or URL string
  - `timeoutMs`: Timeout duration (default: 30000ms = 30 seconds)
- **Returns**: Data URL string (`data:image/jpeg;base64,...`)
- **Error Handling**: 
  - File read timeout → aborts FileReader, throws error
  - URL fetch timeout → aborts fetch, throws error
  - Network errors → wrapped with context

#### `normalizeImageForDisplay(dataUrl, timeoutMs?)`
- **Purpose**: Normalize image to fix EXIF coordinate mismatches
- **Context**: 
  - Zooniverse subjects may have EXIF rotation metadata
  - Canvas/SAM2 don't respect EXIF, causing coordinate system mismatches
  - This normalizes the image so display and SAM2 see identical pixels
- **Returns**: Normalized data URL
- **Timeout**: Default 10 seconds (lower than load timeout)

#### `getImageDimensions(dataUrl, timeoutMs?)`
- **Purpose**: Extract pixel dimensions from image
- **Returns**: Object with `width` and `height`
- **Use Case**: Store dimensions with classification for metadata

### Timeout Strategy

- **File loading timeout**: 30 seconds (accounts for slow networks)
- **URL fetch timeout**: 30 seconds
- **Image normalization timeout**: 10 seconds (expectation: fast operation)
- **Dimension detection timeout**: 10 seconds

All timeouts are cancellable via AbortController.

## sam2Service.ts

Interface to local SAM2 backend (Python server with model checkpoints). Used for image segmentation on-demand.

### Key Functions

#### `segmentWithPoints(imageUrl, prompts, baseUrl?, options?)`
- **Purpose**: Segment image using point prompts (foreground/background clicks)
- **Parameters**:
  - `imageUrl`: Data URI or URL to image
  - `prompts`: Array of point coordinates with labels
    - `x, y`: Pixel coordinates
    - `label`: 1 = foreground, 0 = background
  - `options.modelId`: Which SAM2 model to use (see `SEGMENT_MODELS`)
  - `options.coordinateFix`: Coordinate system transformation
- **Returns**: `Sam2Output` with:
  - `image.url`: Segmentation mask image as data URI
  - `debug_url`: Optional debug visualization
- **Endpoint**: `POST /api/sam2/segment` on SAM2 server

#### `segmentImageWithVideo(videoUrl, frameIndices, prompts, baseUrl?, options?)`
- **Purpose**: Segment multiple video frames with temporal consistency
- **Returns**: Array of segmentation outputs (one per frame)
- **Feature**: SAM2's video propagation maintains consistency across frames

### Available Models

```typescript
const SEGMENT_MODELS = [
  { id: 'sam2-hiera-tiny', label: 'SAM2 Tiny (fastest)' },
  { id: 'sam2-hiera-small', label: 'SAM2 Small' },
  { id: 'sam2-hiera-base-plus', label: 'SAM2 Base+' },
  { id: 'sam2-hiera-large', label: 'SAM2 Large (best)' },
  { id: 'sam1-vit_b', label: 'SAM1 ViT-B' },
  { id: 'sam1-vit_l', label: 'SAM1 ViT-L' },
  { id: 'sam1-vit_h', label: 'SAM1 ViT-H (largest)' },
];
```

Model choice trades speed vs accuracy:
- **Tiny**: Fast, suitable for real-time feedback
- **Large**: Best quality, slower for exploratory use

### Coordinate Fixes

SAM2 inference may require coordinate transformations due to:
- Image normalization (EXIF rotation)
- Canvas scaling differences
- Display scaling

Use `coordinateFix` parameter to apply transformations (defined in `@/utils/coordinates.ts`).

## Error Handling Patterns

All services follow consistent error patterns:

### Caesar (GraphQL)
- Logs errors with context
- Returns empty array on failure (safe default)
- Includes validation checks for required parameters

### Panoptes (REST)
- Attempts to extract error message from response
- Throws descriptive errors with HTTP status
- Propagates to caller for handling

### Image Loading
- Timeout errors are explicit (`"... timeout after XXms"`)
- Network errors are wrapped with context
- Normalization errors include original image data for debugging

### SAM2
- Server errors include detailed context
- Coordinate validation prevents invalid requests
- Timeout protection on all operations

## Usage in Components

### Example: Loading Subject with Caesar Annotations

```typescript
import { useSubjectLoader } from '@/components/ImageLoader/useSubjectLoader';
import { useCaesarReductions } from '@/components/ImageLoader/useCaesarReductions';

// In component:
const { loadNextSubject } = useSubjectLoader(accessToken, async (subjectId) => {
  // Callback after subject image loaded
  await processCaesarReductions(subjectId);
});

// Load next subject and process Caesar ML annotations
await loadNextSubject();
```

### Example: Custom Segmentation Request

```typescript
import { segmentWithPoints } from '@/services/sam2Service';

const result = await segmentWithPoints(
  imageDataUrl,
  [
    { x: 100, y: 100, label: 1 }, // foreground click
    { x: 50, y: 50, label: 0 },   // background click
  ],
  '',
  {
    modelId: 'sam2-hiera-small',
    coordinateFix: 'normalizedToDisplay',
  }
);

// result.image.url is data URI of segmentation mask
```

## Future Enhancements

- [ ] Add request caching with TTL (for repeated queries)
- [ ] Implement exponential backoff retry logic
- [ ] Add request/response logging middleware
- [ ] Support streaming responses for large data
- [ ] Add GraphQL subscription support for real-time updates
