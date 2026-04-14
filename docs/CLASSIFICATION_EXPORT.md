# Classification Export Format

Documentation for the Panoptes-compatible annotations exported by `buildPanoptesAnnotations()`.

## Overview

A classification submission contains three types of annotations:

1. **Rect Annotations** — Per-rect SAM data (primary format)
2. **Drawing Annotations** — Raw user-drawn marks
3. **Task Answers** — Sidebar classification responses

## Rect Annotations (Recommended)

**Task:** `rect-annotations`

Bundles SAM prompts, predictions, and refinements for each classified region.

### Structure

```typescript
interface RectAnnotationsValue {
  annotationId: string;              // Caesar rect ID, '-1', or user rect ID ('-2', '-3', ...)
  samPoints: Array<{
    x: number;
    y: number;
    label: 0 | 1;                    // 0=background, 1=foreground
  }>;
  samPointHistory: {
    allSamPoints: Array<{
      x: number;
      y: number;
      label: 0 | 1;
    }>;
    activePointsPerHistoryIndex: number[][];
  };
  latestSamMask: CompressedMask | null;   // Most recent SAM prediction
  compositeMask: CompressedMask | null;   // Current composite (SAM + edits)
}[]
```

### Field Descriptions

#### annotationId
- **Type:** `string`
- **Purpose:** Identifies which Caesar rect this data belongs to
- **Values:**
  - Caesar rect markId (e.g., `'mark_12345'`)
  - `'-1'` for whole-image or unmarked objects
  - Values `< -1` (e.g., `'-2'`, `'-3'`) for user-defined rectangles created in the UI
- **Required:** Yes

#### samPoints
- **Type:** `Array<{x, y, label, pointId}>`
- **Purpose:** All SAM2 prompts placed for this rect in order
- **Label values:**
  - `0` = Background/negative prompt
  - `1` = Foreground/positive prompt
- **pointId:** Index tracking order of placement (0-indexed within rect)
- **Empty array allowed** if no points placed
- **Required:** Yes

#### samPointHistory
- **Type:** `{ allSamPoints: SamPoint[]; activePointsPerHistoryIndex: number[][] }`
- **Purpose:** Full undo/redo SAM point history for this rect
- **allSamPoints:** Pool of unique SAM points seen in this rect over time
- **activePointsPerHistoryIndex:** For each mask history index, list of indices into `allSamPoints` that were active
- **Fallback behavior:** If no stored history exists yet, export synthesizes a minimal history from current `samPoints`
- **Use case:** Reconstruct prompt timeline and replay point-state transitions
- **Required:** Yes

#### latestSamMask
- **Type:** `CompressedMask | null`
- **Purpose:** The most recent SAM2 prediction mask for this rect
- **Null cases:** No SAM predictions generated, or user deleted history
- **Use case:** Analyze mask quality and prompt effectiveness
- **Required:** No

#### compositeMask
- **Type:** `CompressedMask | null`
- **Purpose:** Combined mask after all edits (SAM + modifier brush strokes)
- **Contents:** Bitwise OR of all mask history entries up to `historyIndex`
- **Null cases:** User reached a point with no segmentation data
- **Use case:** Final approved segmentation state
- **Required:** No

### CompressedMask Format

```typescript
interface CompressedMask {
  width: number;                       // Image width in pixels
  height: number;                      // Image height in pixels
  rle: number[] | string;              // RLE-encoded binary mask
  encoding: 'array' | 'base64' | 'gzip-base64';
  maskType: 'sam' | 'modifier_brush' | 'composite';
}
```

#### maskType Field

Indicates the origin and nature of the mask:

**`'sam'`** — SAM2 model prediction
- Unmodified output from SAM2 model
- Use to analyze model accuracy vs user refinements

**`'modifier_brush'`** — User brush stroke
- User refinement mask (not from model)
- Use to identify where user heavily edited vs accepted SAM

**`'composite'`** — Combined mask
- Bitwise OR of all masks (SAM + brush strokes) up to `historyIndex`
- Final approved segmentation state

#### Example CompressedMask
```json
{
  "width": 800,
  "height": 600,
  "encoding": "gzip-base64",
  "maskType": "sam",
  "rle": "H4sIAB5K4WYC/xXBwQmAQBCAwUH2oCEpUIFMQIh..."
}
```

### Example Rect Annotation

```json
{
  "task": "rect-annotations",
  "value": [
    {
      "annotationId": "caesar-rect-abc123",
      "samPoints": [
        { "x": 200, "y": 300, "label": 1 },
        { "x": 150, "y": 150, "label": 0 },
        { "x": 180, "y": 280, "label": 1 }
      ],
      "samPointHistory": {
        "allSamPoints": [
          { "x": 200, "y": 300, "label": 1 },
          { "x": 150, "y": 150, "label": 0 },
          { "x": 180, "y": 280, "label": 1 }
        ],
        "activePointsPerHistoryIndex": [[0], [0, 1], [0, 1, 2]]
      },
      "latestSamMask": {
        "width": 800,
        "height": 600,
        "encoding": "gzip-base64",
        "maskType": "sam",
        "rle": "H4sIA..."
      },
      "compositeMask": {
        "width": 800,
        "height": 600,
        "encoding": "gzip-base64",
        "maskType": "composite",
        "rle": "H4sIA..."
      }
    },
    {
      "annotationId": "-1",
      "samPoints": [
        { "x": 400, "y": 200, "label": 1 }
      ],
      "samPointHistory": {
        "allSamPoints": [
          { "x": 400, "y": 200, "label": 1 }
        ],
        "activePointsPerHistoryIndex": [[0]]
      },
      "latestSamMask": null,
      "compositeMask": null
    },
    {
      "annotationId": "-2",
      "samPoints": [
        { "x": 500, "y": 210, "label": 1 }
      ],
      "samPointHistory": {
        "allSamPoints": [
          { "x": 500, "y": 210, "label": 1 }
        ],
        "activePointsPerHistoryIndex": [[0]]
      },
      "latestSamMask": null,
      "compositeMask": null
    }
  ]
}
```

**What this means:**
- User refined mask for rect `abc123` with 3 SAM points, generated a prediction, then edited with brush
- User placed 1 point for unmarked object but hasn't generated a SAM prediction yet
- User also created a custom rectangle (`annotationId = -2`) and added one foreground point

## Drawing Annotations

**Task:** `drawing-{index}`

Raw user-drawn marks that may or may not have generated SAM predictions.

### Types

#### Point Annotation
```json
{
  "task": "drawing-0",
  "value": {
    "type": "point",
    "x": 150,
    "y": 200,
    "label": 1,
    "annotationId": "caesar-rect-123"
  }
}
```

#### Brush Annotation
```json
{
  "task": "drawing-1",
  "value": {
    "type": "brush",
    "strokes": [
      {
        "points": [
          { "x": 10, "y": 20 },
          { "x": 15, "y": 25 }
        ],
        "radius": 5
      }
    ],
    "annotationId": "-1"
  }
}
```

#### SAM2 Mask Annotation
```json
{
  "task": "drawing-2",
  "value": {
    "type": "sam2_mask",
    "prompts": [
      { "x": 100, "y": 200, "label": 1 },
      { "x": 50, "y": 100, "label": 0 }
    ],
    "maskUrl": "data:image/png;base64,iVBORw0K...",
    "annotationId": "caesar-rect-456"
  }
}
```

## Task Answers

**Task:** `{taskId}`

User responses to sidebar classification questions.

### Example

```json
[
  { "task": "species-id", "value": "monarch" },
  { "task": "confidence", "value": "high" },
  { "task": "patterns", "value": ["orange", "black", "white"] }
]
```

## Complete Classification Example

```json
{
  "annotations": [
    {
      "task": "rect-annotations",
      "value": [
        {
          "annotationId": "caesar-rect-1",
          "samPoints": [
            { "x": 200, "y": 300, "label": 1 }
          ],
          "samPointHistory": {
            "allSamPoints": [
              { "x": 200, "y": 300, "label": 1 }
            ],
            "activePointsPerHistoryIndex": [[0]]
          },
          "latestSamMask": { /* CompressedMask */ },
          "compositeMask": { /* CompressedMask */ }
        }
      ]
    },
    {
      "task": "drawing-0",
      "value": {
        "type": "point",
        "x": 150,
        "y": 200,
        "label": 1,
        "annotationId": "caesar-rect-1"
      }
    },
    {
      "task": "species-id",
      "value": "monarch"
    }
  ],
  "metadata": {
    "started_at": "2024-01-15T10:30:00Z",
    "finished_at": "2024-01-15T10:45:30Z",
    "user_agent": "Mozilla/5.0...",
    "user_language": "en",
    "workflow_version": "1.0"
  },
  "subject_id": "12345",
  "workflow_id": "29070"
}
```

## Processing Guidelines

### For Backend Consumers

1. **Rect annotations** are the primary source of segmentation data
   - Use `compositeMask` as the final approved segmentation
   - Optional: Analyze `latestSamMask` vs `compositeMask` to quantify user refinements

2. **Drawing annotations** provide raw interaction history
   - Primarily informational for audit/replay purposes
   - Each annotation's `annotationId` links it to a specific rect

3. **Task answers** provide additional classification context

### Compression

Default encoding is `'gzip-base64'`:
- Smallest format (~5-10% overhead from RLE)
- Requires decompression: `gzip_decompress(base64_decode(rle))`

Fallback to `'base64'` if gzip unavailable:
- Requires: `rle_decode(base64_decode(rle))`

### Mask Decoding Example (Python)

```python
import gzip
import base64
import numpy as np

def decode_mask(compressed_mask):
    """
    Decode CompressedMask to binary array (0/1).
    Handles all encoding formats: 'array', 'base64', 'gzip-base64'
    """
    width = compressed_mask['width']
    height = compressed_mask['height']
    rle_data = compressed_mask['rle']
    encoding = compressed_mask.get('encoding', 'gzip-base64')  # Default to gzip-base64
    
    # Step 1: Decode encoding format
    if encoding == 'array':
        # Already a plain array
        rle_bytes = np.array(rle_data, dtype=np.uint8)
    elif encoding == 'base64':
        # Base64-encoded RLE bytes
        rle_bytes = np.frombuffer(base64.b64decode(rle_data), dtype=np.uint8)
    elif encoding == 'gzip-base64':
        # Gzipped then base64-encoded
        rle_bytes = np.frombuffer(
            gzip.decompress(base64.b64decode(rle_data)),
            dtype=np.uint8
        )
    else:
        raise ValueError(f"Unknown encoding: {encoding}")
    
    # Step 2: RLE decode
    binary = []
    for i in range(0, len(rle_bytes), 2):
        count = int(rle_bytes[i])
        value = int(rle_bytes[i + 1])
        binary.extend([value] * count)
    
    # Step 3: Unpack bits (reverse of 8-pixels-per-byte packing)
    flat_mask = np.zeros(width * height, dtype=np.uint8)
    idx = 0
    for byte in binary:
        for bit in range(7, -1, -1):
            if idx >= width * height:
                break
            flat_mask[idx] = (byte >> bit) & 1
            idx += 1
    
    # Step 4: Reshape to 2D
    return flat_mask.reshape((height, width))
```

## FAQ

**Q: What does the `encoding` field mean?**
A: It specifies how the RLE data is compressed. Use its value to determine decompression:
   - `'array'` — RLE is plain number array, no decoding needed
   - `'base64'` — Base64-decode the RLE first
   - `'gzip-base64'` — Gzip-decompress first, then base64-decode (default, smallest)

**Q: What is `maskType` in CompressedMask?**
A: Identifies the origin and nature of the mask:
   - `'sam'` — Raw SAM2 model prediction (unmodified)
   - `'modifier_brush'` — User-drawn brush refinement
   - `'composite'` — Final mask (SAM + all brush edits combined via bitwise OR)
   Use this to analyze model accuracy vs user refinement extent.

**Q: What is `pointId` in samPoints?**
A: Zero-indexed order within the rect showing which point was placed first. Useful for replay/audit of annotation sequence.

**Q: Can a rect have `latestSamMask` but no `samPoints`?**
A: No, samPoints must exist for a mask to be generated. If no mask, samPoints should be empty.

**Q: What does `annotationId = '-1'` mean?**
A: Unmarked object annotations (whole image classification without selecting a specific Caesar rect).

**Q: What do `annotationId` values less than `-1` mean?**
A: They are user-defined rectangles created in the UI. Example: `-2`, `-3`, `-4`.

**Q: Why export both `samPoints` and `samPointHistory`?**
A: `samPoints` is the currently visible point list, while `samPointHistory` preserves undo/redo timeline state (`allSamPoints` pool plus active indices per history step).

**Q: Why are there both drawing annotations AND rect annotations?**
A: Drawing annotations preserve raw interaction history; rect annotations provide the processed, final data structure for analysis.

**Q: Can compositeMask be null while latestSamMask is not?**
A: Yes — user may undo all edits back to the SAM prediction, clearing the composite.

**Q: What's the maximum size of a CompressedMask?**
A: Depends on image resolution and mask complexity. Gzip compression typically achieves 95-98% reduction on binary masks.
