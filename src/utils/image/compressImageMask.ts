/**
 * Convert ImageData → binary mask (0/1), based on blue channel > 0
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
 * RLE encode a Uint8Array of bytes (e.g., bit‑packed mask)
 * Output format: [count, value, count, value, ...]
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
 */
async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(bytes);
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

    // Now JSON.stringify() will read this
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
 * Full pipeline:
 * ImageData → binary mask → bit‑pack → RLE encode → CompressedMask
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