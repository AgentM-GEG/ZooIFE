# ZooIFE: Solution Architecture

A React-based **Incubator Front End (IFE)** for interactive image annotation with ML-assisted segmentation, designed for eventual Zooniverse/Panoptes interoperability.

---

## 1. Overview

This document outlines the architecture for a custom classification interface that supports:

1. **Image display** — locally hosted initially, API-fetched (Zooniverse subjects) later
2. **Annotation tools** — point selection, freehand lines, brush-style highlighting
3. **SAM2 integration** — live interactive segmentation from point clicks
4. **Task sidebar** — region-aware questions (single/multiple choice) + free-text comments
5. **Zooniverse compatibility** — aligns with CSSI IFE Interoperability and Panoptes API

---

## 2. Alignment with CSSI IFE Interoperability

Per the **CSSI IFE Interoperability** document, IFEs should:

| Requirement | Implementation |
|-------------|----------------|
| **Panoptes API** | Primary API; support production & staging (`zooniverse.org`, `panoptes-staging.zooniverse.org`) |
| **OAuth 2.0** | Doorkeeper auth; client credentials for backend; bearer tokens for API calls |
| **Subject Selection** | Use `/subjects/queued` endpoint for subjects to classify |
| **Subject Media** | Use `locations` (MIME → URL) from subject records |
| **Classifications** | POST with `annotations`, `metadata`, `links` (subjects, workflow, project) |
| **Annotation Format** | `{ "task": "task-key", "value": <flexible> }` — no need for workflow tasks to match exactly |
| **Workflow/Tasks** | Load optional; tasks can be `single`, `multiple`, or `drawing` |

**Classification lifecycle** (from doc):

```
Authentication → Load Workflow/Tasks (optional) → Subject Selection → Subject Loading 
→ Construct Annotation → Saving Classifications
```

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ZooIFE React Application                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────────────────────────────────────┐  │
│  │  Task Sidebar   │  │              Image Canvas + Annotations            │  │
│  │                 │  │  ┌─────────────────────────────────────────────┐  │  │
│  │ • Single choice │  │  │  Image Layer (subject from local/API)        │  │  │
│  │ • Multi choice  │  │  └─────────────────────────────────────────────┘  │  │
│  │ • Free text     │  │  ┌─────────────────────────────────────────────┐  │  │
│  │ • Region-aware  │  │  │  Annotation Layer (points, lines, brush)     │  │  │
│  │                 │  │  └─────────────────────────────────────────────┘  │  │
│  └─────────────────┘  │  ┌─────────────────────────────────────────────┐  │  │
│                       │  │  SAM2 Mask Overlay (segmentation results)     │  │  │
│  ┌─────────────────┐  │  └─────────────────────────────────────────────┘  │  │
│  │ Tool Palette    │  └──────────────────────────────────────────────────┘  │
│  │ • Point        │                                                         │
│  │ • Freehand     │  ┌──────────────────────────────────────────────────┐  │
│  │ • Brush        │  │  Services / API Layer                              │  │
│  │ • SAM2 trigger │  │  • ImageService (local / Zooniverse)               │  │
│  └─────────────────┘  │  • SAM2Service (local Python server + checkpoints)   │  │
│                       └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Breakdown

### 4.1 Image Source (Phase 1 → 2)

| Phase | Source | Implementation |
|-------|--------|----------------|
| **1 (now)** | Local files | `file://` or static assets in `public/`; file picker for dev |
| **2 (future)** | Zooniverse API | `GET /subjects/queued`, use `locations` URLs from subject payload |

**Subject locations format** (from Panoptes):

```json
{
  "locations": [
    { "image/jpeg": "https://..." },
    { "image/png": "https://..." }
  ]
}
```

### 4.2 Annotation Tools

| Tool | Behavior | Storage Format |
|------|----------|----------------|
| **Point** | Single click → x,y + label (foreground/background) | `{ type: "point", x, y, label }` |
| **Freehand** | Path of points | `{ type: "polyline", points: [{x,y},...] }` |
| **Brush** | Strokes with radius | `{ type: "brush", strokes: [{points, radius}] }` |

Recommended libraries:

- **react-konva** or **fabric.js** — canvas overlay for drawings
- **react-image-annotate** — existing annotation UX (optional)
- **Custom Canvas** — full control for SAM2 integration

Coordinates must be **normalized** (0–1) or stored with image dimensions for Zooniverse export.

### 4.3 SAM2 (Segment Anything 2.0) Integration

**Implementation:** Locally hosted Python server with SAM2 model checkpoints.

| Aspect | Implementation |
|--------|----------------|
| **Model** | `facebook/sam2-hiera-base` from HuggingFace (or local checkpoint) |
| **Server** | FastAPI at `server/sam2_server.py`, port 3001 |
| **Input** | `{ image_url, prompts: [{x, y, label}] }` — URL or data URI |
| **Output** | `{ image: { url: "data:image/png;base64,..." } }` — mask as semi-transparent overlay |

**Request format:**

```json
{
  "image_url": "data:image/jpeg;base64,...",
  "prompts": [
    { "x": 500, "y": 375, "label": 1 }
  ]
}
```

- `label: 1` = foreground, `0` = background  
- Coordinates are in image pixel space.

**Setup:** Clone [facebookresearch/sam2](https://github.com/facebookresearch/sam2), install with `pip install -e ./sam2`, then run `python server/sam2_server.py`.

### 4.3b Mask Layer Architecture

The canvas uses a sophisticated multi-layer approach to support per-annotation mask editing with real-time visual feedback:

| Layer | Purpose | Opacity | Editable |
|-------|---------|---------|----------|
| **Base Image** | Subject image | 1.0 | No |
| **Composite Reference** | All visible masks EXCEPT the active annotation | 0.9 | No |
| **Per-Annotation Editable** | Current annotation's mask for brush editing | 1.0 | Yes |
| **Annotation Overlays** | Points, lines, Caesar marks | Varies | No |
| **Debug Layers** (optional) | Debug visualizations | Varies | No |

**Key Design Decisions:**

- **Per-Annotation Masks:** Each annotation (rect or whole-image "-1") maintains its own mask history with full undo/redo support. Masks are stored in `classificationStore` with `{ maskUrl, history[], historyIndex, samPointHistory? }`, where `samPointHistory` tracks active SAM prompt points per history step for overlay sync.

- **Composite Reference (Excluding Active):** A semi-transparent overlay computed from all visible per-annotation masks **except the currently active one**. This is the key to enabling real-time visual feedback when using the subtract tool:
  - When you select a rect to edit, the reference layer updates to show everything **except** that rect
  - When you subtract/erase from the active mask, the underlying reference composite becomes visible beneath it
  - This provides immediate visual confirmation of what other rects' masks are there
  - The 0.9 opacity level distinguishes the reference from active rect marks; underlying mask pixels already contain alpha channel values

- **Brush Editing:** Only the current per-annotation mask can be edited. Brush strokes (add or subtract) operate on the editable layer only, preventing cross-contamination with other rects' masks.

- **Export:** When saving classifications, each annotation exports only its own per-annotation mask (from its history), not any composite. This ensures clean, rect-specific segmentation data.

**Real-Time Feedback Flow:**
1. User selects a rect → active annotation ID changes
2. Reference composite recomputes, excluding that rect's mask
3. User draws with subtract tool → pixels removed from active mask
4. Visual result: underlying masks (from other rects) become visible where erased
5. User sees immediate context of what they're removing

**Rationale:** This architecture provides intuitive visual feedback for editing while maintaining perfect isolation between annotations. The exclude-active pattern is more efficient (single recomputation per rect selection) and more intuitive (you see exactly what you're editing against) than showing all masks or constant real-time updates.

### 4.4 Task Sidebar

Mirror **Panoptes workflow tasks**:

- **single** — radio buttons, one answer
- **multiple** — checkboxes, multiple answers
- **text** — free-form (can map to custom task type or `value` as string)

**Region-aware:** Associate questions with annotation regions (e.g., “For this highlighted area: What do you see?”). Store as:

```json
{
  "task": "region-1-question",
  "value": "selected_answer",
  "region_id": "annotation-uuid"
}
```

**Free-text:**

```json
{
  "task": "comment",
  "value": "User's freeform text..."
}
```

### 4.5 Classification → Panoptes

When user submits (or autosaves):

```json
{
  "classifications": {
    "completed": true,
    "metadata": {
      "started_at": "ISO8601",
      "finished_at": "ISO8601",
      "user_agent": "...",
      "user_language": "en",
      "workflow_version": "<from workflow>"
    },
    "annotations": [
      { "task": "drawing-1", "value": [...] },
      { "task": "question-1", "value": "answer" },
      { "task": "comment", "value": "free text" }
    ],
    "links": {
      "subjects": ["<subject_id>"],
      "workflow": "<workflow_id>",
      "project": "<project_id>"
    }
  }
}
```

**Important:** `task` keys can be custom; Panoptes stores them without requiring matching workflow tasks.

---

## 5. Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 18+ (Vite) |
| **State** | Zustand or React Context for classification state |
| **Canvas/Annotation** | Konva + react-konva, or Fabric.js |
| **SAM2** | Local Python server (FastAPI + SAM2 checkpoints) |
| **Zooniverse** | REST (fetch/axios) to Panoptes API |
| **Auth** | OAuth 2.0 with Doorkeeper (Zooniverse) |

---

## 6. Data Flow

```
1. User authenticates (Zooniverse OAuth) [optional for local dev]
2. App fetches subjects from /subjects/queued (or loads local image)
3. User sees image; selects tool (point / freehand / brush)
4. User annotates; point clicks → SAM2 inference (if enabled)
5. SAM2 returns mask → overlay on canvas
6. Task sidebar shows questions; user answers
7. On submit: build annotations array → POST classification to Panoptes
```

---

## 7. File Structure (Proposed)

```
ZooIFE/
├── public/
│   └── sample-images/          # Local test images
├── src/
│   ├── components/
│   │   ├── ImageCanvas/        # Image + annotation layers
│   │   │   ├── ImageLayer.tsx
│   │   │   ├── AnnotationLayer.tsx
│   │   │   └── MaskOverlay.tsx
│   │   ├── ToolPalette/        # Point, freehand, brush
│   │   ├── TaskSidebar/        # Questions, free text
│   │   │   ├── SingleChoiceTask.tsx
│   │   │   ├── MultipleChoiceTask.tsx
│   │   │   └── TextTask.tsx
│   │   └── SubjectNavigator/   # Prev/Next subject
│   ├── services/
│   │   ├── imageService.ts     # Local / API image loading
│   │   ├── sam2Service.ts      # local SAM2 server
│   │   ├── panoptesService.ts  # Zooniverse API
│   │   └── authService.ts
│   ├── stores/
│   │   └── classificationStore.ts
│   ├── types/
│   │   ├── panoptes.ts         # Subject, Classification, Workflow
│   │   └── annotations.ts
│   └── App.tsx
├── docs/
│   └── SOLUTION_ARCHITECTURE.md (this file)
└── package.json
```

---

## 8. Zooniverse Readiness Checklist

- [ ] OAuth 2.0 flow (Doorkeeper)
- [ ] `GET /subjects/queued` for subject selection
- [ ] Subject `locations` for image URLs
- [ ] Classification POST with `annotations`, `metadata`, `links`
- [ ] Annotation `task` keys and `value` formats consistent with exports
- [ ] `workflow_version` from workflow resource in metadata
- [ ] Support for `completed: false` (incomplete classifications)

---

## 9. Next Steps

1. **Scaffold** — Vite + React + TypeScript
2. **Image + canvas** — Display image, basic point click
3. **SAM2 server** — Local Python server loads model; frontend sends coords
4. **Annotation tools** — Point, freehand, brush
5. **Task sidebar** — Single/multiple choice + text
6. **Panoptes integration** — Auth, subject fetch, classification POST

---

## 10. References

- [CSSI IFE Interoperability](./CSSI%20IFE%20Interoperability.docx) (local)
- [Panoptes API](https://zooniverse.github.io/panoptes/)
- [SAM2 GitHub](https://github.com/facebookresearch/sam2)
- [Zooniverse OAuth Applications](https://panoptes.zooniverse.org/oauth/applications)
