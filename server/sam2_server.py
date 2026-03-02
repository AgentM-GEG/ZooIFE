#!/usr/bin/env python3
"""
SAM2 local inference server.
Loads model checkpoints and serves segmentation via HTTP.

Setup:
  1. Clone SAM2: git clone https://github.com/facebookresearch/sam2
  2. Install: pip install -e ./sam2
  3. pip install -r server/requirements.txt
  4. Run: python server/sam2_server.py

Model is downloaded from HuggingFace on first run (facebook/sam2-hiera-small).
"""

import base64
import io
import logging
import traceback
from typing import Any

import numpy as np

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

_predictor = None


def get_predictor():
    global _predictor
    if _predictor is None:
        try:
            from sam2.sam2_image_predictor import SAM2ImagePredictor

            # Supported: tiny, small, base-plus, large (no "base" - use small or base-plus)
            _predictor = SAM2ImagePredictor.from_pretrained("facebook/sam2-hiera-small")
        except ImportError as e:
            if "huggingface_hub" in str(e) or "No module named 'huggingface_hub'" in str(e):
                raise RuntimeError(
                    "huggingface_hub not installed. Run: pip install huggingface_hub"
                ) from e
            raise RuntimeError(
                "SAM2 not installed. Clone https://github.com/facebookresearch/sam2 "
                "and run: pip install -e ./sam2"
            ) from e
    return _predictor


app = FastAPI(title="SAM2 Inference")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PointPrompt(BaseModel):
    x: int
    y: int
    label: int  # 1 = foreground, 0 = background


class SegmentRequest(BaseModel):
    image_url: str  # URL or data:image/...;base64,...
    prompts: list[PointPrompt]


def load_image_from_request(image_url: str) -> np.ndarray:
    """Load image from URL or data URI."""
    from PIL import Image

    if image_url.startswith("data:"):
        # data:image/jpeg;base64,xxxx
        header, b64 = image_url.split(",", 1)
        data = base64.b64decode(b64)
        img = Image.open(io.BytesIO(data)).convert("RGB")
        return np.array(img)
    else:
        # HTTP URL - fetch synchronously for simplicity (or use aiohttp in async)
        import urllib.request

        with urllib.request.urlopen(image_url, timeout=30) as resp:
            data = resp.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
        return np.array(img)


def mask_to_data_uri(mask: np.ndarray, alpha: float = 0.45) -> str:
    """Convert binary mask to vivid semi-transparent overlay (green/cyan)."""
    from PIL import Image

    # mask: (C, H, W) or (H, W) - boolean or float
    if mask.ndim == 3:
        mask = mask[0]
    m = np.asarray(mask, dtype=float)
    h, w = m.shape
    # RGBA: segmented region = vivid cyan/green, rest = transparent
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, 0] = 0  # R
    rgba[:, :, 1] = 255  # G (vivid green)
    rgba[:, :, 2] = 200  # B (slight blue for cyan tint)
    rgba[:, :, 3] = (m * 255 * alpha).astype(np.uint8)
    out = Image.fromarray(rgba)
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


@app.post("/api/sam2/segment")
async def segment(request: SegmentRequest) -> dict[str, Any]:
    if not request.prompts:
        raise HTTPException(400, "At least one prompt required")

    try:
        image = load_image_from_request(request.image_url)
    except Exception as e:
        raise HTTPException(400, f"Failed to load image: {e}") from e

    point_coords = np.array([[p.x, p.y] for p in request.prompts], dtype=np.float32)
    point_labels = np.array([p.label for p in request.prompts], dtype=np.int64)

    try:
        predictor = get_predictor()

        if torch.cuda.is_available():
            with torch.inference_mode(), torch.autocast("cuda", dtype=torch.bfloat16):
                predictor.set_image(image)
                masks, iou_preds, _ = predictor.predict(
                    point_coords=point_coords,
                    point_labels=point_labels,
                    multimask_output=True,
                    normalize_coords=False,
                )
        else:
            with torch.inference_mode():
                predictor.set_image(image)
                masks, iou_preds, _ = predictor.predict(
                    point_coords=point_coords,
                    point_labels=point_labels,
                    multimask_output=True,
                    normalize_coords=False,
                )

        # Pick best mask by IoU (masks: CxHxW, iou_preds: C or 1xC)
        # Handle both torch tensors and numpy
        if hasattr(iou_preds, "cpu"):
            iou_preds = iou_preds.cpu().numpy()
        iou_flat = np.asarray(iou_preds).ravel()
        best_idx = int(np.argmax(iou_flat))
        best_mask = masks[best_idx]
        if hasattr(best_mask, "cpu"):
            best_mask = best_mask.cpu().numpy()
        mask_url = mask_to_data_uri(best_mask)

        return {"image": {"url": mask_url}}

    except RuntimeError as e:
        log.exception("SAM2 inference error")
        raise HTTPException(500, str(e)) from e
    except Exception as e:
        log.exception("SAM2 inference error")
        raise HTTPException(500, f"Inference failed: {e}") from e


@app.get("/api/sam2/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=3001)
