/* eslint-disable react-refresh/only-export-components */
import { useRef, useState } from "react";
import { ImageEditor } from "./ImageEditor";
import {
  getImageDisplayName as sharedGetImageDisplayName,
  optimizeImageForUpload as sharedOptimizeImageForUpload,
} from "../components/image-processing";

// #region Helpers
function isNewFile(value: string): boolean {
  if (!value) return false;
  // New files are data URLs or blob URLs; existing/previously-uploaded files are regular URLs
  return value.startsWith("data:") || value.startsWith("blob:");
}
// #endregion

// #region Component
interface ImageInputProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onClear: () => void;
  onTransformChange?: (offsetX: number, offsetY: number, scale: number) => void;
  maxUploadBytes: number;
  error?: string;
  disabled?: boolean;
  transformOffsetX?: number;
  transformOffsetY?: number;
  transformScale?: number;
  targetWidth?: number;
  targetHeight?: number;
  targetText?: string;
}

export function ImageInput({
  label,
  value,
  onChange,
  onClear,
  onTransformChange,
  maxUploadBytes,
  error,
  disabled,
  transformOffsetX = 0,
  transformOffsetY = 0,
  transformScale = 1,
  targetWidth = 240,
  targetHeight = 336,
  targetText = "Crop Area",
}: ImageInputProps) {
  const [fileName, setFileName] = useState<string>("");
  const [copiedFileName, setCopiedFileName] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string>(value);
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
      const dataUrl = await sharedOptimizeImageForUpload(file, maxUploadBytes);
      setFileName(file.name);
      setCopiedFileName(false);
      // Store the original uploaded image for the editor
      setOriginalImageUrl(dataUrl);
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

  const currentDisplayName = fileName || sharedGetImageDisplayName(value);
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

    setShowClearConfirm(true);
  }

  function handleConfirmClear() {
    setFileName("");
    setCopiedFileName(false);
    setUploadError(null);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
    setShowClearConfirm(false);
    onClear();
  }

  function handleTransformSave(data: {
    dataUri: string;
    offsetX: number;
    offsetY: number;
    scale: number;
  }) {
    setShowImageEditor(false);
    // Update the image value with the cropped version
    onChange(data.dataUri);
    // Save the transform values so they persist when reopening
    onTransformChange?.(data.offsetX, data.offsetY, data.scale);
  }

  return (
    <div className="image-input-group">
      <div className="image-input-label-row">
        <span className="image-input-label">{label}</span>
        <div style={{ position: "relative", display: "inline-block" }}>
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
            {hasFile
              ? copiedFileName
                ? "Copied"
                : "File Uploaded"
              : "No File"}
          </button>
          {hasFile && !disabled && (
            <button
              type="button"
              className="image-status-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              title="Clear image"
              aria-label="Clear image"
            >
              ✕
            </button>
          )}
        </div>
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

      {hasFile && !disabled && isNewFile(value) && (
        <button
          type="button"
          className="image-edit-btn"
          onClick={() => setShowImageEditor(true)}
          title="Edit image position and zoom"
          aria-label="Edit image"
        >
          ✎ Edit Position & Zoom
        </button>
      )}

      {uploadError || error ? (
        <small className="field-error">{uploadError || error}</small>
      ) : null}

      {showClearConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowClearConfirm(false)}
        >
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Clear Image?</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowClearConfirm(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to remove this image?</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmClear}
              >
                Clear Image
              </button>
            </div>
          </div>
        </div>
      )}

      {showImageEditor && hasFile && (
        <ImageEditor
          imageUrl={value}
          originalImageUrl={originalImageUrl}
          onClose={() => setShowImageEditor(false)}
          onSave={handleTransformSave}
          maxUploadBytes={maxUploadBytes}
          initialOffsetX={transformOffsetX}
          initialOffsetY={transformOffsetY}
          initialScale={transformScale}
          targetWidth={targetWidth}
          targetHeight={targetHeight}
          targetText={targetText}
        />
      )}
    </div>
  );
}
// #endregion
