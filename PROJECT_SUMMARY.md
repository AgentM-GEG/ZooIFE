# ZooIFE Project Summary

ZooIFE is a React-based Incubator Front End (IFE) for interactive image classification workflows with optional ML-assisted segmentation via a local SAM2 inference service.

## Core Purpose
- Build a browser annotation tool for image-based classification.
- Support local image annotation now, with a roadmap toward full Zooniverse Panoptes interoperability.
- Combine human annotations (point/freehand/brush) with model-assisted mask suggestions from SAM2/SAM1.

## Tech Stack
- Frontend: React 18, TypeScript, Vite 5, Zustand, react-konva/konva.
- Backend (local ML service): Python FastAPI server running segment-anything models.
- External target integrations: Zooniverse Panoptes API (`zooniverse.org`, `panoptes-staging.zooniverse.org`).

## High-Level Architecture
- Frontend handles UI, annotation state, and API service orchestration.
- Local Python server provides segmentation via `POST /api/sam2/segment`.
- Zustand stores image, annotations, task answers, and generated classification payload data.
- Image and annotation overlays are rendered in a canvas component with zoom/pan interaction.
- Panoptes-facing types and services are in place to support future production submission flow.

## Repository Structure

### `src/`
- `components/`
  - `ImageLoader` — local file loading and image preprocessing hook-up.
  - `ToolPalette` — tool selection, model selection, coordinate/debug options.
  - `ImageCanvas` — image rendering, drawing interactions, pan/zoom, annotation overlays, and debug mask handling.
  - `TaskSidebar` — sample single/multiple choice/text tasks and classification payload generation.
- `stores/`
  - `classificationStore` — centralized global state for subject/image, annotations, task answers, masks, and export helpers.
- `services/`
  - `imageService` — image file reading, EXIF-safe normalization, size detection, and Zooniverse location parsing.
  - `sam2Service` — request builder for local segmentation service, prompt handling, coordinate fixes, model selection.
  - `panoptesService` — API helpers for workflow, queued subjects, and classifications.
- `types/`
  - `annotations` — point/polyline/brush/sam2 mask annotation models and tool types.
  - `panoptes` — Panoptes Subject/Workflow/Classification contracts.
- `App.tsx` — application composition and main interaction wiring.

### `server/`
- `sam2_server.py` — FastAPI inference endpoint:
  - `POST /api/sam2/segment`: accepts prompts + image and returns overlay mask data URI.
  - `GET /api/sam2/health`: health check.
- `requirements.txt` — Python dependencies for inference server.

### Docs and config
- `README.md` — setup and feature overview.
- `docs/SOLUTION_ARCHITECTURE.md` — full architecture and interoperability plan.
- `package.json` and Vite config — scripts, dependencies, and proxy to local SAM2 server.
- TypeScript configs and lint setup for strict frontend checks.

## Runtime Flow (Current)
1. User loads an image locally via `ImageLoader`.
2. `ImageCanvas` displays the image and captures annotations from selected tool.
3. Point clicks invoke `segmentWithPoints`, sending request to local `/api/sam2/segment`.
4. Server returns mask/debug image; result is overlaid on canvas.
5. Task responses are collected in sidebar and merged with annotations.
6. `buildPanoptesAnnotations()` prepares task-style annotation structures for future API submit paths.

## Current State of Functionality
- ✅ Local image annotation UX implemented.
- ✅ Point, freehand, and brush tools implemented in canvas.
- ✅ Local image-to-model loop for segmentation is wired.
- ✅ Panoptes-aligned data structures and API helpers are present.
- ⚠️ Full OAuth-based Panoptes login and live subject queue navigation are not yet fully wired into the UI.
- ⚠️ Current “Submit Classification” path logs payload to console rather than posting to backend.
- ✅ Debug options (point visibility, coordinate fixes, debug overlays) aid segmentation alignment and troubleshooting.

## Planned Interoperability Path
- Load subjects from `/subjects/queued` by workflow ID.
- Render workflow-driven tasks dynamically from API response.
- Submit completed classifications to Panoptes with metadata (`links`, `task` identifiers, `started_at`/`finished_at`, etc.).
- Add auth flow for token-based API access and staging/prod selection.
