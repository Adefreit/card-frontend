import { useCallback, useEffect, useRef, useState } from "react";
import "./ImageEditor.css";
import { config } from "../../../config";
import {
  estimateUploadedImageBytes,
  optimizeImageValueForUpload,
} from "../components/image-processing";

interface CroppedImageData {
  dataUri: string;
  offsetX: number;
  offsetY: number;
  scale: number;
}

interface ImageEditorProps {
  imageUrl: string;
  originalImageUrl?: string;
  onClose: () => void;
  onSave: (data: CroppedImageData) => void;
  maxUploadBytes?: number;
  initialOffsetX?: number;
  initialOffsetY?: number;
  initialScale?: number;
  targetWidth?: number;
  targetHeight?: number;
  targetText?: string;
}

export function ImageEditor({
  imageUrl,
  originalImageUrl,
  onClose,
  onSave,
  maxUploadBytes = config.UPLOADS.MAX_UPLOAD_SIZE,
  initialOffsetX = 0,
  initialOffsetY = 0,
  initialScale = 1,
  targetWidth = 240,
  targetHeight = 336,
  targetText = "Crop Area",
}: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [offsetX, setOffsetX] = useState(initialOffsetX);
  const [offsetY, setOffsetY] = useState(initialOffsetY);
  const [scale, setScale] = useState(initialScale);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // DPI conversion factors (at 96 DPI)
    // From backend: scaleX = (widthInInches * dpi) / (2.44 * 100)
    // scaleY = (heightInInches * dpi) / (3.67 * 100)
    const DPI = 96;
    const TARGET_WIDTH_INCHES = 2.5;
    const TARGET_HEIGHT_INCHES = 3.5;
    const scaleX = (TARGET_WIDTH_INCHES * DPI) / (2.44 * 100);
    const scaleY = (TARGET_HEIGHT_INCHES * DPI) / (3.67 * 100);

    // Calculate scale factor to fit target nicely in canvas
    const displayScaleFactor = Math.min(
      (canvas.width * 0.8) / targetWidth,
      (canvas.height * 0.8) / targetHeight,
    );
    const displayWidth = targetWidth * displayScaleFactor;
    const displayHeight = targetHeight * displayScaleFactor;
    const cardCenterX = canvas.width / 2;
    const cardCenterY = canvas.height / 2;
    const cardLeft = cardCenterX - displayWidth / 2;
    const cardTop = cardCenterY - displayHeight / 2;

    // Draw background
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#cccccc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Draw the image with proper DPI-aware scaling
    ctx.save();
    ctx.translate(cardCenterX, cardCenterY);

    // Scale to fit card in display space
    ctx.scale(displayScaleFactor, displayScaleFactor);

    // Apply offset: convert from logical units to pixels using DPI factors
    ctx.translate(offsetX * scaleX, offsetY * scaleY);

    // Calculate image dimensions at 1.0x zoom (xMidYMid slice behavior)
    // At scale 1.0, image should fill the target dimensions while maintaining aspect ratio
    const imageAspect = imageRef.current.width / imageRef.current.height;
    const targetAspect = targetWidth / targetHeight;

    let imageScaleWidth: number;
    let imageScaleHeight: number;

    if (imageAspect > targetAspect) {
      // Image is wider: scale by height to fill target
      imageScaleHeight = targetHeight;
      imageScaleWidth = targetHeight * imageAspect;
    } else {
      // Image is taller or square: scale by width to fill target
      imageScaleWidth = targetWidth;
      imageScaleHeight = targetWidth / imageAspect;
    }

    // Apply user zoom to image dimensions (not as a canvas transform)
    // This makes the image scale from top-left, matching SVG backend behavior
    const scaledImageWidth = imageScaleWidth * scale;
    const scaledImageHeight = imageScaleHeight * scale;

    // Draw image with top-left corner fixed at (-imageScaleWidth/2, -imageScaleHeight/2)
    // At offset 0,0 and scale 1.0, image fills and centers on the card
    // When scale changes, the top-left corner stays fixed and image scales right/down
    ctx.drawImage(
      imageRef.current,
      -imageScaleWidth / 2,
      -imageScaleHeight / 2,
      scaledImageWidth,
      scaledImageHeight,
    );
    ctx.restore();

    // Draw card silhouette
    ctx.strokeStyle = "#ff6b35";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    // Offset by 0.5 to align stroke to pixel grid for sharpness
    ctx.strokeRect(
      cardLeft + 0.5,
      cardTop + 0.5,
      displayWidth - 1,
      displayHeight - 1,
    );
    ctx.setLineDash([]);

    // Draw label
    ctx.fillStyle = "#ff6b35";
    ctx.font = "12px sans-serif";
    ctx.fillText(targetText, cardLeft + 8, cardTop + 16);
  }, [offsetX, offsetY, scale, targetWidth, targetHeight, targetText]);

  // Load image - use originalImageUrl if provided, otherwise use imageUrl
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      drawPreview();
    };
    img.src = originalImageUrl || imageUrl;
  }, [imageUrl, originalImageUrl, drawPreview]);

  // Redraw when transform changes
  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    // DPI conversion factors (match the DPI used in drawPreview)
    const DPI = 96;
    const TARGET_WIDTH_INCHES = 2.5;
    const TARGET_HEIGHT_INCHES = 3.5;
    const scaleX = (TARGET_WIDTH_INCHES * DPI) / (2.44 * 100);
    const scaleY = (TARGET_HEIGHT_INCHES * DPI) / (3.67 * 100);

    // Calculate display scale factor
    const displayScaleFactor = Math.min(
      (canvas.width * 0.8) / targetWidth,
      (canvas.height * 0.8) / targetHeight,
    );

    // Convert canvas pixel movement to logical units
    // Canvas transform stack is now:
    // 1. Center canvas
    // 2. Display scale
    // 3. Offset translation (in logical units * DPI factors)
    // User zoom is applied to image dimensions only, not as a canvas transform
    const deltaX = (e.clientX - dragStart.x) / (displayScaleFactor * scaleX);
    const deltaY = (e.clientY - dragStart.y) / (displayScaleFactor * scaleY);

    setOffsetX((prev) => prev + deltaX);
    setOffsetY((prev) => prev + deltaY);
    setDragStart({ x: e.clientX, y: e.clientY });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.025 : 0.025;
    const newScale = Math.max(0.1, Math.min(3, scale + delta));
    setScale(newScale);
  }

  function handleReset() {
    setOffsetX(0);
    setOffsetY(0);
    setScale(1);
  }

  async function handleSave() {
    const image = imageRef.current;
    if (!image) return;

    // Calculate DPI-aware scaling to use original image resolution
    // This ensures the exported image uses the highest quality available
    const DPI = 96;
    const TARGET_WIDTH_INCHES = 2.5;
    const TARGET_HEIGHT_INCHES = 3.5;
    const scaleX = (TARGET_WIDTH_INCHES * DPI) / (2.44 * 100);
    const scaleY = (TARGET_HEIGHT_INCHES * DPI) / (3.67 * 100);

    // Export canvas must always follow the requested crop aspect ratio.
    // Scale it up to preserve detail while keeping the same target shape.
    const imageAspect = image.width / image.height;
    const targetAspect = targetWidth / targetHeight;

    const exportScale = Math.max(
      1,
      Math.min(image.width / targetWidth, image.height / targetHeight),
    );
    const scaledCardWidth = Math.max(1, Math.round(targetWidth * exportScale));
    const scaledCardHeight = Math.max(
      1,
      Math.round(targetHeight * exportScale),
    );

    // Create export canvas at the scaled dimensions
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = Math.round(scaledCardWidth);
    exportCanvas.height = Math.round(scaledCardHeight);
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;

    // Draw the image at full resolution with the same transforms
    exportCtx.save();
    exportCtx.translate(scaledCardWidth / 2, scaledCardHeight / 2);

    // Scale offsetX/offsetY from logical units to pixels for the export
    const scalingFactor = exportScale;
    exportCtx.translate(
      offsetX * scaleX * scalingFactor,
      offsetY * scaleY * scalingFactor,
    );

    // Calculate image dimensions at 1.0x zoom in logical target units
    let imageScaleWidth: number;
    let imageScaleHeight: number;

    if (imageAspect > targetAspect) {
      // Image is wider: scale by height to fill target
      imageScaleHeight = targetHeight;
      imageScaleWidth = targetHeight * imageAspect;
    } else {
      // Image is taller or square: scale by width to fill target
      imageScaleWidth = targetWidth;
      imageScaleHeight = targetWidth / imageAspect;
    }

    // Convert logical dimensions to export pixels, then apply user zoom.
    const baseImageWidthPx = imageScaleWidth * exportScale;
    const baseImageHeightPx = imageScaleHeight * exportScale;
    const scaledImageWidth = baseImageWidthPx * scale;
    const scaledImageHeight = baseImageHeightPx * scale;

    // Draw image
    exportCtx.drawImage(
      image,
      -baseImageWidthPx / 2,
      -baseImageHeightPx / 2,
      scaledImageWidth,
      scaledImageHeight,
    );
    exportCtx.restore();

    // Convert to data URI and save with transforms
    const croppedImageDataUri = exportCanvas.toDataURL("image/png");
    const croppedImageBytes = estimateUploadedImageBytes(croppedImageDataUri);
    const optimizedImageDataUri =
      croppedImageBytes > maxUploadBytes
        ? await optimizeImageValueForUpload(croppedImageDataUri, maxUploadBytes)
        : croppedImageDataUri;
    onSave({
      dataUri: optimizedImageDataUri,
      offsetX,
      offsetY,
      scale,
    });
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ overflowY: "auto" }}
    >
      <div
        className="modal-dialog image-editor-dialog"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        style={{ overflowY: "auto" }}
      >
        <div className="modal-header">
          <h3 className="modal-title">Crop Image</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="modal-body image-editor-body">
          <div className="image-editor-canvas-container">
            <canvas
              ref={canvasRef}
              width={600}
              height={400}
              className="image-editor-canvas"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            />
            <div className="image-editor-hint">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <p style={{ margin: 0 }}>
                  <strong>Pan / Zoom</strong> the image. Only the portion within
                  the cropping area will be saved.
                </p>
                <button
                  type="button"
                  className="btn-secondary btn-xs"
                  onClick={handleReset}
                  title="Reset position and zoom"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
