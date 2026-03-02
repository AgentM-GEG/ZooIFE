# ZooIFE

Interactive image classification frontend for Zooniverse interoperability, with ML-assisted segmentation (SAM2).

## Features

- **Image display** — Load local images (Phase 1) or fetch from Zooniverse API (Phase 2)
- **Annotation tools** — Point selection, freehand drawing (brush coming soon)
- **SAM2 integration** — Point-click segmentation via **locally hosted** SAM2 model
- **Task sidebar** — Single/multiple choice questions + free-text comments
- **Panoptes-ready** — Classification format aligned with Zooniverse API

## Quick Start

```bash
npm install
npm run dev
```

Then open http://localhost:5173 and click **Load Image** to select a local image.

## SAM2 Local Server

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

Then run `npm run dev` — the Vite proxy forwards `/api/sam2` to the local server (port 3001). Click points on the image to trigger segmentation.

## Zooniverse Integration

See [docs/SOLUTION_ARCHITECTURE.md](docs/SOLUTION_ARCHITECTURE.md) for:

- CSSI IFE Interoperability alignment
- Panoptes API usage
- Classification lifecycle
- Task/workflow structure

## Project Structure

```
src/
├── components/     ImageCanvas, ToolPalette, TaskSidebar, ImageLoader
├── services/       imageService, sam2Service, panoptesService
├── stores/         classificationStore (Zustand)
├── types/          panoptes, annotations
└── App.tsx
```

## Tech Stack

- React 18 + TypeScript + Vite
- Zustand (state)
- react-konva (canvas annotations)
- SAM2 (locally hosted Python server)
