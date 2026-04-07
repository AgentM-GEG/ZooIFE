# ZooIFE Project Summary

**Current status (branch `snapshot_alignment`):** ZooIFE is a React-based Incubator Front End (IFE) that now connects to **live Zooniverse Panoptes** for authenticated subject loading (`/subjects/queued`), while retaining a **local SAM2** segmentation loop and **in-browser mask refinement** on top of model predictions. A small **Python OAuth helper** exchanges authorization codes for tokens and returns them to the SPA via URL fragment. Local file loading via `ImageLoader` remains in the codebase but is **not** mounted in `App.tsx`—the primary header flow is **Login** + **Next subject**. **Workflow / subject set** for the queue are configurable via **Vite env** (see `.env.example`). The task sidebar includes **Go to Talk**, which opens the subject’s Zooniverse Talk page in a new tab when `VITE_ZOONIVERSE_PROJECT_SLUG` is set (CSSI IFE URL pattern).

---

## Core purpose

- Classify Zooniverse subjects in a custom UI with point-driven SAM2 masks, freehand/brush strokes, and optional paint/erase edits on the predicted mask.
- Produce **Panoptes-shaped annotation payloads** (including a compressed segmentation mask) for downstream submission work.
- Keep staging/production API bases and OAuth endpoints aligned with Zooniverse’s Panoptes stack.

---

## Tech stack

| Layer | Technology |
|--------|------------|
| Frontend | React 18, TypeScript, Vite 5, Zustand, react-konva / Konva |
| Local ML | Python FastAPI (`server/sam2_server.py`) — `POST /api/sam2/segment`, `GET /api/sam2/health` |
| Zooniverse | Panoptes REST (`https://www.zooniverse.org/api`, `https://panoptes-staging.zooniverse.org/api`), OAuth authorize + token (`zooniverse.org/oauth/authorize`, `panoptes.zooniverse.org/oauth/token`) |
| OAuth dev helper | `server/oauth_server.py` — stdlib `HTTPServer` + `requests`, reads **`server/oauth.json`** via path next to the script (gitignored; see `.gitignore`). Optional `REDIRECT_URI` key; defaults to `http://localhost:8080/callback` if omitted. |

**Notable npm dependencies:** `konva`, `react-konva`, `zustand`, `rle-data` (declared in `package.json`; current mask compression uses custom RLE/bit-pack code in `compressImageMask.ts`, not this package).

**Node:** `>=18` (see `package.json` / `.nvmrc`).

---

## High-level architecture

1. **Auth:** `AuthProvider` (`src/main.tsx`) wraps the app. **Login** redirects the browser to `http://localhost:8080/auth-start`. The OAuth server completes the code exchange and redirects to `http://localhost:5173/auth/callback#token=…` (base64url JSON). `AuthContext` decodes the fragment, stores tokens in React state and `tokenStore` (`src/auth/tokenStore.ts`).
2. **Subjects:** When logged in, **Next subject** (`ZooniverseImageLoader`) calls `getQueuedSubjects(workflowId, access_token, opts?)` (optional `subject_set_id` when `VITE_ZOONIVERSE_SUBJECT_SET_ID` is set), then fetches the subject’s first `image/jpeg` URL, normalizes pixels for display/SAM alignment, and calls `setSubject` in Zustand. Defaults: `VITE_ZOONIVERSE_WORKFLOW_ID` → `29070` if unset.
3. **Canvas:** `ImageCanvas` shows the image, point/polyline/brush annotations, SAM mask overlay, and debug overlay. With a mask present, **Modify prediction** (`modifier_brush`) drives `BrushEditableImage` to add/subtract on the mask raster with undo/redo history in the store.
4. **Export:** `buildPanoptesAnnotations()` builds an array of `{ task, value }` entries: compressed mask (`compressSegmentationMask` → `CompressedMask`, default **gzip-base64** JSON), drawing annotations, and sidebar task answers. Today it **logs** JSON; `createClassification` in `panoptesService` is available but **not** invoked from the sidebar submit handler.

---

## Repository layout (authoritative sweep)

### `src/`

| Area | Role |
|------|------|
| `App.tsx` | Layout, SAM point handler, undo-with-reinference, brush/mask tool state, composes header (`ZooniverseImageLoader`, `Login`) + `ToolPalette` + `ImageCanvas` + `TaskSidebar`. |
| `main.tsx` | Renders app inside `AuthProvider`. |
| `components/Login/Login.tsx` | Login / logout buttons using `useAuth`. |
| `components/ImageLoader/ImageLoader.tsx` | Local file picker → `setSubject` (still useful for offline dev; **not** used in `App` currently). |
| `components/ImageLoader/ZooniverseImageLoader.tsx` | **Next subject** button; `getQueuedSubjects`, `loadImageAsDataUrl` on remote URL, normalize + dimensions. Workflow ID from `VITE_ZOONIVERSE_WORKFLOW_ID` (default `29070`); optional `VITE_ZOONIVERSE_SUBJECT_SET_ID` for grouped workflows or explicit set selection. |
| `components/ImageCanvas/ImageCanvas.tsx` | Konva stage: zoom/pan, tools, SAM/debug/mask layers, pointer routing to mask editor. |
| `components/ImageMask/BrushEditableImage.tsx` | Offscreen canvas for mask pixels; mask history via store; imperative handle for pointer events. |
| `components/ToolPalette/ToolPalette.tsx` | Point / freehand / brush, SAM model select, coordinate fix & debug, **Modify prediction** UI when `currentMaskUrl` is set. |
| `components/TaskSidebar/TaskSidebar.tsx` | Static sample tasks; submit calls `buildPanoptesClassification()` and logs; **Go to Talk** links to `…/projects/<slug>/talk/subjects/<id>` when env slug + Panoptes subject are present. |
| `auth/AuthContext.tsx` | OAuth callback fragment handling, `login`/`logout`. |
| `auth/tokenStore.ts` | Module-level token for non-React consumers. |
| `stores/classificationStore.ts` | Subject, image, annotations, tasks, SAM mask URL, debug image, **mask history** + undo/redo, `buildPanoptesAnnotations`. |
| `services/panoptesService.ts` | `getQueuedSubjects` (supports optional `subject_set_id` + backward-compatible `staging` boolean or options object), `getWorkflow`, `createClassification` (prod/staging base URLs). |
| `services/sam2Service.ts` | SAM2 API client (proxied by Vite). |
| `services/imageService.ts` | File/URL → data URL, EXIF-safe normalization, dimensions, `getSubjectImageUrl` helper. |
| `utils/image/compressImageMask.ts` | Mask from blue channel → bit-pack → RLE → `CompressedMask` + JSON serialization. |
| `utils/zooniverseTalk.ts` | Builds Zooniverse subject Talk URLs; `isPanoptesSubjectId` skips `local-*` subjects. |
| `types/panoptes.ts`, `types/annotations.ts`, `types/tools.ts` | Panoptes and drawing models; `BrushProps` / tool unions including `modifier_brush`. |

### `server/`

| File | Role |
|------|------|
| `sam2_server.py` | SAM2 FastAPI app (see `server/requirements.txt`: FastAPI, uvicorn, Pillow, numpy, huggingface_hub, etc.). |
| `oauth_server.py` | Dev OAuth redirect server on **port 8080**; requires `requests` (not listed in `server/requirements.txt`—install separately if you run this script). Loads **`oauth.json`** from the same directory. |
| `oauth.json` | Local OAuth client id/secret, scopes, and `REDIRECT_URI` (not committed). |
| `requirements.txt` | SAM2 server dependencies only. |

### Docs & config

- `README.md` — quick start, OAuth + SAM2 + Zooniverse flow (local **Load Image** still optional / not mounted in `App`).
- `docs/SOLUTION_ARCHITECTURE.md` — CSSI / Panoptes alignment and lifecycle (still describes “phase 2” API subjects in places; implementation has begun).
- `vite.config.ts` — dev proxy: `/api/sam2` → `http://localhost:3001`.
- `.env.example` — documents `VITE_ZOONIVERSE_WORKFLOW_ID`, optional `VITE_ZOONIVERSE_SUBJECT_SET_ID`, and optional `VITE_ZOONIVERSE_PROJECT_SLUG` / `VITE_ZOONIVERSE_SITE_ORIGIN` for Talk links (copy to `.env` / `.env.local` as needed; see `.gitignore`).
- `package.json` — scripts: `dev`, `build`, `lint`, `preview`, `sam2:server`.
- `.gitignore` — excludes `*oauth.json`, `node_modules`, `dist`, `.env*`, `sam2` clone, etc.

### Other

- `public/vite.svg`, `index.html`, TS configs, ESLint — standard Vite/React tooling.
- `src/utils/image/test.json` — test/fixture artifact in tree.

---

## Runtime flows

### Typical developer session (Zooniverse + SAM2)

1. Ensure `server/oauth.json` exists with `CLIENT_ID`, `CLIENT_SECRET`, `VALID_SCOPES`, and (recommended for this server) `REDIRECT_URI` set to `http://localhost:8080/callback` so the `/callback` handler receives the authorization code. Out-of-band `urn:ietf:wg:oauth:2.0:oob` does not hit that route and often triggers Panoptes **“The redirect uri included is not valid”** after sign-in unless that exact urn is registered; this project expects the localhost callback instead.
2. Run `python server/oauth_server.py` (port **8080**); install `requests` if missing.
3. Run `python server/sam2_server.py` (port **3001** per README/proxy).
4. Run `npm run dev` (Vite **5173**).
5. **Login to Zooniverse** → complete OAuth → **Next subject** → annotate → optional **Modify prediction** on mask → **Submit Classification** (console output) → optional **Go to Talk** (new tab) if `VITE_ZOONIVERSE_PROJECT_SLUG` matches the project’s `/projects/…` path.

### SAM point loop (unchanged conceptually)

Point clicks (left = foreground, right = background) append prompts and call `segmentWithPoints`; responses update `currentMaskUrl` or debug image per **Debug coords**.

---

## Functionality checklist

| Area | Status |
|------|--------|
| Panoptes queued subjects with bearer token | Implemented (`ZooniverseImageLoader` + `getQueuedSubjects`) |
| OAuth in browser | Implemented via `oauth_server.py` + fragment callback |
| `getWorkflow` / dynamic tasks from API | Service exists; UI still uses **sample** tasks in `TaskSidebar` |
| POST classification to Panoptes | `createClassification` implemented; **not** wired to Submit button |
| Subject Talk deep link | **Go to Talk** in `TaskSidebar` when `VITE_ZOONIVERSE_PROJECT_SLUG` + queued subject id |
| Local file **Load Image** | Component exists; **not** in `App` header |
| Point / freehand / brush tools | Implemented |
| SAM2 mask overlay + modifier brush + mask undo/redo | Implemented |
| `buildPanoptesAnnotations` incl. compressed mask | Implemented (async); sidebar should `await` for correct logging order |
| Token persistence across reload | **In-memory only** (plus fragment on callback); no localStorage |

---

## Risks, gaps, and follow-ups

- **Secrets:** `oauth.json` must never be committed; scopes and `REDIRECT_URI` must match the Zooniverse OAuth app. **`urn:ietf:wg:oauth:2.0:oob` is incompatible** with the current `oauth_server.py` redirect/callback flow unless you add a manual code path; use `http://localhost:8080/callback` (or another registered https URL that lands on this server) for the automated dev flow.
- **Wrong workflow vs subject set:** Panoptes queues by **workflow**; subject sets are linked to that workflow. For a *different* image pool, use another workflow that links the desired sets, or set `VITE_ZOONIVERSE_SUBJECT_SET_ID` when the workflow is **grouped** (API requires it) or when you need to pin a set.
- **Hardcoded hosts** in `AuthContext` and `oauth_server.py` (`localhost:8080`, `localhost:5173`).
- **`rle-data`** dependency appears unused by current source; safe to remove later if confirmed.
- **Staging flag** on Panoptes helpers exists but the loader always uses production URL pattern via default `staging = false`.

---

## Files touched in recent documentation updates

- `src/utils/zooniverseTalk.ts` — **new** — `buildZooniverseSubjectTalkUrl`, `isPanoptesSubjectId`.
- `src/components/TaskSidebar/TaskSidebar.tsx` — **Go to Talk** button (new tab); disabled with tooltip when slug or Panoptes subject missing.
- `src/vite-env.d.ts` — `VITE_ZOONIVERSE_PROJECT_SLUG`, `VITE_ZOONIVERSE_SITE_ORIGIN`, `VITE_ZOONIVERSE_PROJECT_ID`.
- `.env.example` — documents optional Talk link env vars.
- `PROJECT_SUMMARY.md` — this sync section.

Earlier batch:

- `src/services/panoptesService.ts` — `getQueuedSubjects` builds query with optional `subject_set_id`; third argument may be `boolean` (staging) or `{ staging?, subjectSetId? }`.
- `src/components/ImageLoader/ZooniverseImageLoader.tsx` — reads `VITE_ZOONIVERSE_WORKFLOW_ID` / `VITE_ZOONIVERSE_SUBJECT_SET_ID`.

Earlier (reference):

- `server/oauth.json` (local, gitignored) — Panoptes OAuth client config; use `REDIRECT_URI` `http://localhost:8080/callback` (not `urn:ietf:wg:oauth:2.0:oob`) so the dev server receives the code and Panoptes accepts the redirect.
- `README.md` — quick start, OAuth, SAM2, Zooniverse flow.
- `server/oauth_server.py` — loads config from `server/oauth.json`; uses `REDIRECT_URI` from file; authorize URL built with `urlencode`; logs config path on startup.
