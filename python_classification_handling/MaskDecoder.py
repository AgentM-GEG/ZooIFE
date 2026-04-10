import base64
import gzip
import numpy as np
from typing import Union, Sequence


class MaskDecoder:
    """
    Decoder for custom segmentation mask format:
      1. RLE of bytes: [count, value, count, value, ...]
      2. Each value is a BYTE containing 8 packed binary pixels.
      3. Output is a 2D numpy array of shape (height, width) with values {0, 1}.
    
    Supports three encoding formats for the RLE data:
      - 'array': Plain RLE array (largest)
      - 'base64': RLE bytes as base64 (medium)
      - 'gzip-base64': RLE bytes gzipped then base64-encoded (smallest, ~5-10% overhead)
    """

    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.total_pixels = width * height

    # ---------------------------------------------------------
    # Step 0 — Decode encoding format (base64, gzip-base64)
    # ---------------------------------------------------------
    def decode_encoded_rle(
        self, rle_data: Union[str, np.ndarray, Sequence[int]], encoding: str = 'gzip-base64'
    ) -> np.ndarray:
        """
        Decode RLE from the specified encoding format.
        
        Args:
            rle_data: Encoded RLE (string for base64/gzip-base64, array for 'array')
            encoding: Format - 'array', 'base64', or 'gzip-base64'
        
        Returns:
            Decoded RLE as numpy array of bytes
        """
        if encoding == 'array':
            # Already a plain array
            return np.asarray(rle_data, dtype=np.uint8)
        elif encoding == 'base64':
            # Base64-encoded RLE bytes
            rle_bytes = base64.b64decode(rle_data)
            return np.frombuffer(rle_bytes, dtype=np.uint8)
        elif encoding == 'gzip-base64':
            # Gzipped then base64-encoded
            rle_bytes = base64.b64decode(rle_data)
            rle_bytes = gzip.decompress(rle_bytes)
            return np.frombuffer(rle_bytes, dtype=np.uint8)
        else:
            raise ValueError(f"Unknown encoding: {encoding}")

    # ---------------------------------------------------------
    # Step 1 — Decode RLE (byte runs)
    # ---------------------------------------------------------
    def rle_decode(self, rle: np.ndarray) -> np.ndarray:
        """
        Decode RLE of the form [count, value, count, value, ...]
        returning a flat array of bytes.
        """
        rle = np.asarray(rle, dtype=np.uint8)

        out = []
        for i in range(0, len(rle), 2):
            count = int(rle[i])
            value = int(rle[i + 1])
            out.extend([value] * count)

        return np.array(out, dtype=np.uint8)

    # ---------------------------------------------------------
    # Step 2 — Unpack bits (reverse of bit‑packing)
    # ---------------------------------------------------------
    def unpack_bits(self, packed: np.ndarray) -> np.ndarray:
        """
        Unpack bit‑packed bytes into a 0/1 flat mask of length total_pixels.
        """
        out = np.zeros(self.total_pixels, dtype=np.uint8)
        idx = 0

        for byte in packed:
            for bit in range(7, -1, -1):
                if idx >= self.total_pixels:
                    break
                out[idx] = (byte >> bit) & 1
                idx += 1

        return out

    # ---------------------------------------------------------
    # Step 3 — Full decode pipeline
    # ---------------------------------------------------------
    def decode(
        self,
        rle_data: Union[str, np.ndarray, Sequence[int]],
        encoding: str = 'gzip-base64'
    ) -> np.ndarray:
        """
        Decode:
            encoded RLE  →  RLE byte-runs  →  unpack bits  →  reshape (H,W)
        
        Args:
            rle_data: Encoded RLE data (string for base64/gzip-base64, array for 'array')
            encoding: Format - 'array', 'base64', or 'gzip-base64' (default)
        
        Returns:
            2D numpy array of shape (height, width) with values {0, 1}
        """
        # Step 0: Handle encoding
        encoded_rle = self.decode_encoded_rle(rle_data, encoding)
        
        # Step 1: Decode RLE byte-runs
        packed = self.rle_decode(encoded_rle)
        
        # Step 2: Unpack bits
        flat_mask = self.unpack_bits(packed)
        
        # Step 3: Reshape to 2D
        return flat_mask.reshape((self.height, self.width))