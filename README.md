# ZooIFE

Interactive image classification frontend for **Zooniverse / Panoptes**, with **SAM2** point-driven segmentation and **in-browser refinement** of the predicted mask.

## Features

- **Zooniverse subjects** — After login, load the next subject from Panoptes `GET /subjects/queued` (workflow ID is set in code; see below).
- **OAuth (dev)** — Small Python server exchanges the authorization code for tokens and returns them to the SPA via URL fragment.
- **Annotation tools** — Point prompts (positive / negative for SAM), freehand polylines, brush strokes.
- **SAM2** — Point-click segmentation via a **locally hosted** FastAPI server; Vite proxies `/api/sam2` to it.
  - Each SAM-generated mask is added to undo/redo history as a single entry
  - Can be undone like a brush stroke, then refined with additional points
- **Mask editing** — When a SAM mask is shown, **Modify prediction** adds or subtracts on the overlay with undo/redo.
  - Per-annotation mask history tracks every SAM result and brush stroke
  - Composite display shows all visible masks at current undo/redo state
- **Task sidebar** — Sample single/multiple choice and text tasks (workflow-driven tasks are not loaded yet).
- **Panoptes-shaped export** — **Submit Classification** builds annotations (including a compressed segmentation mask) and logs JSON; posting to `POST /classifications` is implemented in code but not wired to the button yet.

## Prerequisites

- **Node.js** ≥ 18 (`package.json` / `.nvmrc`)
- **Python** with PyTorch + SAM2 for the segmentation server (see [SAM2 local server](#sam2-local-server))
- **Python `requests`** if you run the OAuth helper (`pip install requests`)

## Quick start (full stack)

Typical order for Zooniverse + SAM2:

1. **OAuth config** — Add `server/oauth.json` (gitignored via `*oauth.json`). `oauth_server.py` always loads **`server/oauth.json`** next to the script, regardless of your shell’s working directory. Shape:

   ```json
   {
     "CLIENT_ID": "your-client-id",
     "CLIENT_SECRET": "your-client-secret",
     "REDIRECT_URI": "http://localhost:8080/callback",
     "VALID_SCOPES": ["user", "project", "classification", "subject", "public"]
   }
   ```

   **`REDIRECT_URI` must match** what is registered for the OAuth application **and** what this dev server expects. The handler at `http://localhost:8080/callback` only runs when Zooniverse redirects the browser there with `?code=…`. If you use `urn:ietf:wg:oauth:2.0:oob` (out-of-band), Panoptes shows a code on a page instead of redirecting to localhost, so this automatic flow will not complete until you switch to an `http://localhost:8080/callback` (or similar) redirect URI in both Zooniverse settings and `oauth.json`.

2. **OAuth server** (port **8080**):

   ```bash
   pip install requests
   python server/oauth_server.py
   ```

3. **SAM2 server** (port **3001**) — see [SAM2 local server](#sam2-local-server).

4. **Frontend** (port **5173**):

   ```bash
   npm install
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173), click **Login to Zooniverse**, complete OAuth, then **Next subject**. Use point tools and optional **Modify prediction** after SAM returns a mask.

### Workflow ID

Queued subjects are requested for a fixed workflow ID in `src/components/ImageLoader/ZooniverseImageLoader.tsx` (`WORKFLOW`). Change that constant for a different project or workflow.

### Local images only

`src/components/ImageLoader/ImageLoader.tsx` can load a file from disk into the same store as Zooniverse subjects, but it is **not** mounted in `App.tsx` today. To use it for offline testing, import it in `App.tsx` and render it in the header (or swap it temporarily for `ZooniverseImageLoader`).

## SAM2 local server

To enable live segmentation, run the Python SAM2 server with your own model checkpoints:

```bash
# 1. Install PyTorch (match your CUDA from pytorch.org)
pip install torch torchvision

# 2. Clone and install SAM2
git clone https://github.com/facebookresearch/sam2
pip install -e ./sam2

# 3. Install server deps
pip install -r server/requirements.txt

# 4. Run the server (model downloads from HuggingFace on first run)
python server/sam2_server.py
```

With `npm run dev`, the Vite dev server proxies `/api/sam2` to `http://localhost:3001`. **Left-click** adds a foreground point; **right-click** adds a background point. **Ctrl+Z / ⌘Z** (or **Undo** in the toolbar) removes the last point and re-runs SAM on the remaining prompts when possible.

Convenience script: `npm run sam2:server`.

## Zooniverse integration

- **Panoptes API** — `src/services/panoptesService.ts` (`getQueuedSubjects`, `getWorkflow`, `createClassification`), production and staging base URLs.
- **Architecture and lifecycle** — [docs/SOLUTION_ARCHITECTURE.md](docs/SOLUTION_ARCHITECTURE.md)
- **Project state and known gaps** — [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)

## Project structure

```
src/
├── auth/              AuthContext, tokenStore
├── components/
│   ├── ImageCanvas/   Konva stage, zoom/pan, annotations, SAM mask layer
│   ├── ImageLoader/   ZooniverseImageLoader (queued subjects), ImageLoader (local file, optional)
│   ├── ImageMask/     BrushEditableImage (mask paint/erase)
│   ├── Login/         Zooniverse login / logout
│   ├── TaskSidebar/   Sample tasks + submit (logs Panoptes-style payload)
│   └── ToolPalette/   Tools, SAM model, debug/coordinate options, mask modifier
├── services/          imageService, sam2Service, panoptesService
├── stores/            classificationStore (Zustand)
├── types/             panoptes, annotations, tools
├── utils/image/       maskCompositing (canvas context mask blending), compressImageMask, maskBounds
├── App.tsx
└── main.tsx
server/
├── sam2_server.py     FastAPI SAM2 inference
├── oauth_server.py    Dev OAuth redirect + token handoff
└── requirements.txt   SAM2 server Python deps (not oauth_server’s requests)
```

## Tech stack

- React 18 + TypeScript + Vite
- Zustand (state)
- react-konva / Konva (canvas)
- SAM2 (local Python server)
- Panoptes REST + OAuth (Zooniverse)
