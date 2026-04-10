/**
 * Convert ImageData → binary mask (0/1), based on blue channel > 0
 * @param imageData - ImageData object from canvas rendering
 * @returns Uint8Array of binary mask values (0 or 1 per pixel)
 */
export function maskFromBlueChannel(imageData: ImageData): Uint8Array {
    const { data, width, height } = imageData;
    const totalPixels = width * height;

    const mask = new Uint8Array(totalPixels);

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const blue = data[i + 2];
        mask[p] = blue > 0 ? 1 : 0;
    }

    return mask;
}

/**
 * Bit‑pack a binary mask (0/1 per pixel) into bytes.
 * 8 pixels → 1 byte.
 * @param mask - Uint8Array of binary values (0 or 1)
 * @returns Uint8Array of bit-packed bytes
 */
export function packBits(mask: Uint8Array): Uint8Array {
    const out = new Uint8Array(Math.ceil(mask.length / 8));

    for (let i = 0; i < mask.length; i++) {
        const byteIndex = i >> 3;        // i / 8
        const bitIndex  = 7 - (i & 7);   // 7..0
        if (mask[i]) {
            out[byteIndex] |= (1 << bitIndex);
        }
    }

    return out;
}

/**
 * RLE encode a Uint8Array of bytes (e.g., bit‑packed mask).
 * Output format: [count, value, count, value, ...]
 * @param bytes - Uint8Array to encode
 * @returns RLE-encoded Uint8Array
 */
export function rleEncode(bytes: Uint8Array): Uint8Array {
    if (bytes.length === 0) return new Uint8Array();

    const out: number[] = [];
    let prev = bytes[0];
    let count = 1;

    for (let i = 1; i < bytes.length; i++) {
        const v = bytes[i];
        if (v === prev && count < 255) {
            count++;
        } else {
            out.push(count, prev);
            prev = v;
            count = 1;
        }
    }

    out.push(count, prev);
    return Uint8Array.from(out);
}

/**
 * Final compressed output class
 * Includes custom toJSON() so JSON.stringify produces valid Panoptes annotations.
 */
export type MaskEncoding =
  | "array"        // JSON number[]
  | "base64"       // Base64 of raw RLE bytes
  | "gzip-base64"; // Gzip → Base64

/**
 * Convert Uint8Array → Base64 string
 */
function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Gzip a Uint8Array using the browser's CompressionStream API.
 * @param bytes - Uint8Array to compress
 * @returns Promise resolving to gzip-compressed Uint8Array
 */
async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(new Uint8Array(bytes));
    writer.close();

    const compressed = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(compressed);
}

/**
 * New: CompressedMask class with configurable JSON serialization
 */
export class CompressedMask {
    constructor(
        public width: number,
        public height: number,
        public rle: Uint8Array,
        public encoding: MaskEncoding = "array"   // default
    ) {}

    private _preparedJson: any = null;

    /**
     * Prepare JSON-safe serialization.
     * Must be called BEFORE JSON.stringify().
     */
    async prepareForJson() {
        if (this.encoding === "array") {
            // Most compatible with Panoptes
            this._preparedJson = {
                width: this.width,
                height: this.height,
                rle: Array.from(this.rle)
            };
        }

        else if (this.encoding === "base64") {
            this._preparedJson = {
                width: this.width,
                height: this.height,
                rle: bytesToBase64(this.rle)
            };
        }

        else if (this.encoding === "gzip-base64") {
            const gz = await gzip(this.rle);
            this._preparedJson = {
                width: this.width,
                height: this.height,
                rle: bytesToBase64(gz)
            };
        }
    }

    /**
     * Get JSON representation of the mask.
     * @returns JSON-serializable object (must call prepareForJson() first)
     */
    toJSON() {
        if (!this._preparedJson) {
            throw new Error(
                "CompressedMask must be prepared first: await mask.prepareForJson()"
            );
        }
        return this._preparedJson;
    }
}


/**
 * Full compression pipeline:
 * ImageData → binary mask → bit‑pack → RLE encode → CompressedMask
 * @param imageData - ImageData object from canvas rendering
 * @param encoding - Encoding type for output ("array", "base64", or "gzip-base64")
 * @returns Promise resolving to CompressedMask object ready for JSON serialization
 */
export async function compressSegmentationMask(
    imageData: ImageData,
    encoding: MaskEncoding = "gzip-base64"
): Promise<CompressedMask> {

    const mask      = maskFromBlueChannel(imageData);
    const packed    = packBits(mask);
    const rlePacked = rleEncode(packed);

    const cm = new CompressedMask(
        imageData.width,
        imageData.height,
        rlePacked,
        encoding
    );

    // Prepare JSON-safe output according to encoding
    await cm.prepareForJson();

    return cm;
}

/**
 * Composite multiple ImageData masks by overlaying them on top of each other.
 * Later masks in the array are drawn on top of earlier ones.
 * 
 * @param masks - Array of ImageData masks to composite (must all have same dimensions)
 * @returns Composite ImageData with all masks overlaid, or null if empty array
 */
export function compositeImageDataMasks(masks: ImageData[]): ImageData | null {
    if (masks.length === 0) return null;
    if (masks.length === 1) return masks[0];

    const firstMask = masks[0];
    const { width, height } = firstMask;

    // Create composite by ORing all mask pixels together
    // This combines all masks into one without any overwriting
    const compositeData = new Uint8ClampedArray(firstMask.data);

    for (let i = 1; i < masks.length; i++) {
        const mask = masks[i];
        
        if (mask.width !== width || mask.height !== height) {
            console.warn(`[compositeImageDataMasks] Mask dimension mismatch: expected ${width}x${height}, got ${mask.width}x${mask.height}`);
            continue;
        }

        // OR each pixel value from this mask with the composite
        // This preserves all mask data - if either mask has a pixel, it appears in composite
        for (let j = 0; j < mask.data.length; j++) {
            compositeData[j] = compositeData[j] | mask.data[j];
        }
    }

    const composite = new ImageData(compositeData, width, height);
    console.log(`[compositeImageDataMasks] Composited ${masks.length} masks via bitwise OR, result=${width}x${height}`);
    
    return composite;
}