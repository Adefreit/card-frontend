import { config } from "../../../config";

// #region Types
export interface ParsedDataUrl {
  mimeType: string;
  base64: string;
}

export interface ImagePayloadValues {
  backgroundImage: string;
  foregroundImage: string;
}

export type ImagePayloadPrefix = "background" | "foreground";
// #endregion

// #region MIME and Data URL Helpers
/**
 * Tries to infer image MIME type from well-known base64 signatures.
 */
function inferMimeTypeFromBase64(value: string): string | null {
  if (!value) {
    return null;
  }

  if (value.startsWith("iVBORw0KGgo")) {
    return "image/png";
  }

  if (value.startsWith("/9j/")) {
    return "image/jpeg";
  }

  if (value.startsWith("R0lGOD")) {
    return "image/gif";
  }

  if (value.startsWith("UklGR") && value.includes("V0VCUA")) {
    return "image/webp";
  }

  return null;
}

/**
 * Keeps MIME metadata aligned with the actual encoded bytes when possible.
 */
function normalizeParsedDataUrl(parsed: ParsedDataUrl): ParsedDataUrl {
  const inferredMimeType = inferMimeTypeFromBase64(parsed.base64);

  if (!inferredMimeType || inferredMimeType === parsed.mimeType) {
    return parsed;
  }

  console.warn("[ImageUpload] MIME mismatch detected in data URL", {
    declaredMimeType: parsed.mimeType,
    inferredMimeType,
  });

  return {
    ...parsed,
    mimeType: inferredMimeType,
  };
}

/**
 * Parses a base64 data URL into MIME type and raw base64 payload.
 */
export function parseDataUrl(value: string): ParsedDataUrl | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(value);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    base64: match[2],
  };
}
// #endregion

// #region Utility Helpers
/**
 * Estimates byte length for a base64 payload by accounting for trailing padding.
 */
function base64ToByteLength(value: string) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

/**
 * Extracts a file extension from a MIME type, with a safe fallback.
 */
function getExtensionFromMimeType(mimeType: string, fallback = "img") {
  return mimeType.split("/")[1]?.toLowerCase() || fallback;
}

/**
 * Normalizes parsed data URL values into the base64 payload shape expected by APIs.
 */
function toBase64Payload(parsed: ParsedDataUrl, prefix: ImagePayloadPrefix) {
  const normalized = normalizeParsedDataUrl(parsed);

  return {
    [`${prefix}ImageBase64`]: normalized.base64,
    [`${prefix}ImageMimeType`]: normalized.mimeType,
  };
}

/**
 * Returns the preferred output MIME type order for optimization attempts.
 * PNG is prioritized to preserve alpha transparency.
 */
function getPreferredMimeTypes() {
  return ["image/png"];
}

/**
 * Converts a Blob to a data URL string.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Returns a valid 2D canvas context or throws a consistent processing error.
 */
function getCanvas2DContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to process the selected image.");
  }

  return context;
}

/**
 * Builds a stable image file name from blob, URL, or unknown input sources.
 */
function getImageFileName(value: string, mimeType: string) {
  const fallbackExtension = getExtensionFromMimeType(mimeType);

  if (value.startsWith("blob:")) {
    return `preview-image.${fallbackExtension}`;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      const fileName = url.pathname.split("/").filter(Boolean).pop();
      return fileName
        ? decodeURIComponent(fileName)
        : `preview-image.${fallbackExtension}`;
    } catch {
      return `preview-image.${fallbackExtension}`;
    }
  }

  return `preview-image.${fallbackExtension}`;
}
// #endregion

// #region Image Loading and Conversion
/**
 * Fetches an image URL and returns the response as a Blob.
 */
async function fetchImageForPreview(value: string) {
  const response = await fetch(value);

  if (!response.ok) {
    throw new Error("Failed to load the selected image for preview.");
  }

  return response.blob();
}

/**
 * Loads an image file using an object URL and resolves when decoded.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load the selected image."));
    };

    image.src = objectUrl;
  });
}

/**
 * Loads an image for canvas resizing using createImageBitmap when available.
 */
async function loadResizibleImage(
  file: File,
): Promise<{ image: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);

      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
      };
    } catch {
      // Fall back to HTMLImageElement if bitmap decoding is unavailable.
    }
  }

  const image = await loadImage(file);
  return {
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

/**
 * Encodes an HTML canvas into a Blob using target MIME type and optional quality.
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to process the selected image."));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}
// #endregion

// #region Optimization Pipeline
/**
 * Renders an image source to canvas and returns an encoded data URL.
 */
async function renderSourceToDataUrl(
  source: { image: CanvasImageSource; width: number; height: number },
  mimeType: string,
  quality?: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;

  const context = getCanvas2DContext(canvas);

  context.drawImage(
    source.image,
    0,
    0,
    source.width,
    source.height,
    0,
    0,
    source.width,
    source.height,
  );

  return blobToDataUrl(await canvasToBlob(canvas, mimeType, quality));
}

/**
 * Optimizes an image for upload by scaling and re-encoding until size fits budget.
 */
export async function optimizeImageForUpload(file: File, maxBytes: number) {
  const source = await loadResizibleImage(file);

  if (file.size <= maxBytes) {
    if (file.type?.toLowerCase() === "image/jpeg") {
      console.info("[ImageUpload] Normalizing JPEG upload orientation");
      return renderSourceToDataUrl(source, "image/jpeg", 0.92);
    }

    console.info("[ImageUpload] No optimization needed for image upload");
    return blobToDataUrl(file);
  }

  console.info("[ImageUpload] Downsizing image upload", {
    fileName: file.name,
    originalType: file.type || "unknown",
    originalBytes: file.size,
    maxAllowedBytes: maxBytes,
  });

  const largestSide = Math.max(source.width, source.height);
  const baseScale = largestSide > 2200 ? 2200 / largestSide : 1;
  const scaleSteps = [1, 0.85, 0.72, 0.6, 0.48, 0.36];
  const qualitySteps = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44];
  const mimeTypes = getPreferredMimeTypes();
  let bestBlob: Blob | null = null;

  for (const scaleStep of scaleSteps) {
    const scale = Math.min(baseScale * scaleStep, 1);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = getCanvas2DContext(canvas);

    context.drawImage(
      source.image,
      0,
      0,
      source.width,
      source.height,
      0,
      0,
      width,
      height,
    );

    for (const mimeType of mimeTypes) {
      const encodeSteps = mimeType === "image/png" ? [undefined] : qualitySteps;

      for (const quality of encodeSteps) {
        const blob = await canvasToBlob(canvas, mimeType, quality);

        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob;
        }

        if (blob.size <= maxBytes) {
          console.info("[ImageUpload] Downsizing complete", {
            fileName: file.name,
            outputType: blob.type || mimeType,
            outputBytes: blob.size,
            maxAllowedBytes: maxBytes,
          });
          return blobToDataUrl(blob);
        }
      }
    }
  }

  if (bestBlob && bestBlob.size <= maxBytes) {
    return blobToDataUrl(bestBlob);
  }

  throw new Error(
    "Unable to shrink the selected image enough to stay under upload limit.",
  );
}

/**
 * Converts an image value into a File for optimization and upload workflows.
 */
async function valueToFile(value: string) {
  const parsed = parseDataUrl(value);
  if (parsed) {
    const mimeType = parsed.mimeType || "image/jpeg";
    const response = await fetch(value);
    const blob = await response.blob();
    return new File(
      [blob],
      `preview-image.${getExtensionFromMimeType(mimeType)}`,
      {
        type: blob.type || mimeType,
      },
    );
  }

  const blob = await fetchImageForPreview(value);
  return new File([blob], getImageFileName(value, blob.type), {
    type: blob.type || "image/jpeg",
  });
}

/**
 * Optimizes an image value by first resolving it to a File.
 */
export async function optimizeImageValueForUpload(
  value: string,
  maxBytes: number,
) {
  if (!value) {
    return value;
  }

  const file = await valueToFile(value);
  return optimizeImageForUpload(file, maxBytes);
}

/**
 * Produces a parsed data URL for preview, optimizing remote values when needed.
 */
async function optimizeImageValueForPreview(value: string, maxBytes: number) {
  const parsed = parseDataUrl(value);
  if (parsed) {
    return parsed;
  }

  const file = await valueToFile(value);
  const optimizedDataUrl = await optimizeImageForUpload(file, maxBytes);
  const optimizedParsed = parseDataUrl(optimizedDataUrl);

  if (!optimizedParsed) {
    throw new Error("Failed to process the selected image for preview.");
  }

  return optimizedParsed;
}
// #endregion

// #region Display, Budget, and Payload Builders
/**
 * Derives a user-friendly image display name from data URLs and remote URLs.
 */
export function getImageDisplayName(value: string): string {
  if (!value) {
    return "No file uploaded";
  }

  if (value.startsWith("data:")) {
    const parsed = parseDataUrl(value);
    if (!parsed) {
      return "Uploaded image";
    }

    const extension = getExtensionFromMimeType(parsed.mimeType, "file");
    return `uploaded-image.${extension}`;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      const name = url.pathname.split("/").filter(Boolean).pop();
      return name ? decodeURIComponent(name) : "remote-image";
    } catch {
      return "remote-image";
    }
  }

  return "Uploaded image";
}

/**
 * Estimates uploaded image size in bytes when a data URL value is provided.
 */
export function estimateUploadedImageBytes(value: string) {
  const parsed = parseDataUrl(value);
  if (!parsed) {
    return 0;
  }

  return base64ToByteLength(parsed.base64);
}

/**
 * Creates either base64 payload fields or URL payload fields for a given image.
 */
function createImagePayload(
  value: string,
  prefix: ImagePayloadPrefix,
  emptyValue: Record<string, string>,
  urlKey: "Image" | "ImageUrl",
) {
  if (!value) {
    return emptyValue;
  }

  const parsed = parseDataUrl(value);
  if (parsed) {
    return toBase64Payload(parsed, prefix);
  }

  return {
    [`${prefix}${urlKey}`]: value,
  };
}

/**
 * Calculates available preview optimization budget for one image given the other.
 */
export function getPreviewImageBudget(value: string, otherValue: string) {
  const otherUploadedBytes = estimateUploadedImageBytes(otherValue);

  if (otherUploadedBytes > 0) {
    return Math.max(0, config.UPLOADS.MAX_UPLOAD_SIZE - otherUploadedBytes);
  }

  if (value && otherValue) {
    return Math.floor(config.UPLOADS.MAX_UPLOAD_SIZE / 2);
  }

  return config.UPLOADS.MAX_UPLOAD_SIZE;
}

/**
 * Builds payload fields for a card image value without preview optimization.
 */
export function buildImagePayload(value: string, prefix: ImagePayloadPrefix) {
  return createImagePayload(
    value,
    prefix,
    { [`${prefix}ImageUrl`]: "" },
    "Image",
  );
}

/**
 * Builds payload fields for preview images with optimization and safe URL fallback.
 */
export function buildOptimizedPreviewImagePayload(
  value: string,
  prefix: ImagePayloadPrefix,
  maxBytes: number,
) {
  if (!value) {
    return Promise.resolve({});
  }

  return optimizeImageValueForPreview(value, maxBytes)
    .then((parsed) => toBase64Payload(parsed, prefix))
    .catch((error) => {
      console.warn("[ImageUpload] Falling back to image URL for preview", {
        imageValue: value,
        reason: error instanceof Error ? error.message : "unknown",
      });

      return {
        [`${prefix}ImageUrl`]: value,
      };
    });
}

/**
 * Builds combined payload values for background and foreground card images.
 */
export function buildCardImagePayloads(values: ImagePayloadValues) {
  return {
    ...buildImagePayload(values.backgroundImage, "background"),
    ...buildImagePayload(values.foregroundImage, "foreground"),
  };
}

/**
 * Builds optimized preview payload values for background and foreground images.
 */
export async function buildCardPreviewImagePayloads(
  values: ImagePayloadValues,
) {
  const backgroundImageBudget = getPreviewImageBudget(
    values.backgroundImage,
    values.foregroundImage,
  );
  const foregroundImageBudget = getPreviewImageBudget(
    values.foregroundImage,
    values.backgroundImage,
  );

  return {
    ...(await buildOptimizedPreviewImagePayload(
      values.backgroundImage,
      "background",
      backgroundImageBudget,
    )),
    ...(await buildOptimizedPreviewImagePayload(
      values.foregroundImage,
      "foreground",
      foregroundImageBudget,
    )),
  };
}
// #endregion
