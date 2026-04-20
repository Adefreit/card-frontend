import { useRef, useState } from "react";

export const MAX_TOTAL_UPLOAD_BYTES = 3 * 1024 * 1024;

interface ParsedDataUrl {
  mimeType: string;
  base64: string;
}

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

function parseDataUrl(value: string): ParsedDataUrl | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(value);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    base64: match[2],
  };
}

function base64ToByteLength(value: string) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

function getPreferredMimeTypes(fileType: string) {
  const mimeTypes = [fileType];

  if (fileType !== "image/webp") {
    mimeTypes.push("image/webp");
  }

  if (fileType !== "image/jpeg") {
    mimeTypes.push("image/jpeg");
  }

  return mimeTypes.filter(Boolean);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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

async function optimizeImageForUpload(file: File, maxBytes: number) {
  if (maxBytes <= 0) {
    throw new Error(
      "Uploaded images must total 3 MB or less. Clear another image first.",
    );
  }

  if (file.size <= maxBytes) {
    console.info("[ImageUpload] No optimization needed for image upload");
    return blobToDataUrl(file);
  }

  console.info("[ImageUpload] Downsizing image upload", {
    fileName: file.name,
    originalType: file.type || "unknown",
    originalBytes: file.size,
    maxAllowedBytes: maxBytes,
  });

  const image = await loadImage(file);
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const baseScale = largestSide > 2200 ? 2200 / largestSide : 1;
  const scaleSteps = [1, 0.85, 0.72, 0.6, 0.48, 0.36];
  const qualitySteps = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44];
  const mimeTypes = getPreferredMimeTypes(file.type || "image/jpeg");
  let bestBlob: Blob | null = null;

  for (const scaleStep of scaleSteps) {
    const scale = Math.min(baseScale * scaleStep, 1);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to process the selected image.");
    }

    context.drawImage(image, 0, 0, width, height);

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
    "Unable to shrink the selected image enough to stay under the 3 MB total upload limit.",
  );
}

function getImageDisplayName(value: string): string {
  if (!value) {
    return "No file uploaded";
  }

  if (value.startsWith("data:")) {
    const parsed = parseDataUrl(value);
    if (!parsed) {
      return "Uploaded image";
    }

    const extension = parsed.mimeType.split("/")[1]?.toLowerCase() || "file";
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

export function estimateUploadedImageBytes(value: string) {
  const parsed = parseDataUrl(value);
  if (!parsed) {
    return 0;
  }

  return base64ToByteLength(parsed.base64);
}

export function buildImagePayload(
  value: string,
  prefix: "background" | "foreground",
) {
  if (!value) {
    return {
      [`${prefix}ImageUrl`]: "",
    };
  }

  const parsed = parseDataUrl(value);
  if (parsed) {
    const normalized = normalizeParsedDataUrl(parsed);
    return {
      [`${prefix}ImageBase64`]: normalized.base64,
      [`${prefix}ImageMimeType`]: normalized.mimeType,
    };
  }

  return {
    [`${prefix}Image`]: value,
  };
}

export function buildPreviewImagePayload(
  value: string,
  prefix: "background" | "foreground",
) {
  if (!value) {
    return {};
  }

  const parsed = parseDataUrl(value);
  if (parsed) {
    const normalized = normalizeParsedDataUrl(parsed);
    return {
      [`${prefix}ImageBase64`]: normalized.base64,
      [`${prefix}ImageMimeType`]: normalized.mimeType,
    };
  }

  return {
    [`${prefix}ImageUrl`]: value,
  };
}

interface ImageInputProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onClear: () => void;
  maxUploadBytes: number;
  error?: string;
  disabled?: boolean;
}

export function ImageInput({
  label,
  value,
  onChange,
  onClear,
  maxUploadBytes,
  error,
  disabled,
}: ImageInputProps) {
  const [fileName, setFileName] = useState<string>("");
  const [copiedFileName, setCopiedFileName] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSelectedFile(file?: File | null) {
    if (disabled) {
      return;
    }

    if (!file) {
      return;
    }

    setUploadError(null);

    try {
      const dataUrl = await optimizeImageForUpload(file, maxUploadBytes);
      setFileName(file.name);
      setCopiedFileName(false);
      onChange(dataUrl);
    } catch (uploadIssue) {
      setUploadError(
        uploadIssue instanceof Error
          ? uploadIssue.message
          : "Unable to process the selected image.",
      );
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    await handleSelectedFile(e.target.files?.[0]);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (!isDragActive) {
      setIsDragActive(true);
    }
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    await handleSelectedFile(e.dataTransfer.files?.[0]);
  }

  const currentDisplayName = fileName || getImageDisplayName(value);
  const hasFile = Boolean(value);

  async function handleCopyFileName() {
    if (disabled) {
      return;
    }

    if (!hasFile) {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentDisplayName);
      setCopiedFileName(true);
      window.setTimeout(() => setCopiedFileName(false), 1200);
    } catch {
      // Ignore clipboard failures to avoid interrupting form usage.
    }
  }

  function handleClear() {
    if (disabled) {
      return;
    }

    setFileName("");
    setCopiedFileName(false);
    setUploadError(null);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
    onClear();
  }

  return (
    <div className="image-input-group">
      <div className="image-input-label-row">
        <span className="image-input-label">{label}</span>
        <button
          type="button"
          className={`image-status-chip${hasFile ? " image-status-chip--uploaded" : " image-status-chip--empty"}`}
          onClick={handleCopyFileName}
          disabled={!hasFile || disabled}
          title={
            hasFile
              ? `Click to copy file name: ${currentDisplayName}`
              : "No file uploaded"
          }
        >
          {hasFile ? (copiedFileName ? "Copied" : "File Uploaded") : "No File"}
        </button>
      </div>

      <div
        className={`file-drop-zone file-drop-zone--compact${isDragActive ? " file-drop-zone--active" : ""}`}
        onClick={() => {
          if (disabled) {
            return;
          }

          fileRef.current?.click();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="file-drop-hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
        {fileName ? (
          <span className="file-drop-name">Selected: {fileName}</span>
        ) : (
          <>
            <span className="file-drop-text">
              Drag an image here or click to upload
            </span>
            <span className="file-drop-hint">PNG, JPG, WEBP</span>
          </>
        )}
      </div>

      <div className="image-input-actions">
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={handleClear}
          disabled={!value || disabled}
        >
          Clear Image
        </button>
      </div>

      {uploadError || error ? (
        <small className="field-error">{uploadError || error}</small>
      ) : null}
    </div>
  );
}
