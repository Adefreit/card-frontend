import { useCallback, useEffect, useRef, useState } from "react";
import "./ImageEditor.css";

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (offsetX: number, offsetY: number, scale: number) => void;
  initialOffsetX?: number;
  initialOffsetY?: number;
  initialScale?: number;
  cardWidth?: number;
  cardHeight?: number;
}

export function ImageEditor({
  imageUrl,
  onClose,
  onSave,
  initialOffsetX = 0,
  initialOffsetY = 0,
  initialScale = 1,
  cardWidth = 240,
  cardHeight = 336,
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
    const CARD_WIDTH_INCHES = 2.5;
    const CARD_HEIGHT_INCHES = 3.5;
    const scaleX = (CARD_WIDTH_INCHES * DPI) / (2.44 * 100);
    const scaleY = (CARD_HEIGHT_INCHES * DPI) / (3.67 * 100);

    // Calculate scale factor to fit card nicely in canvas
    const displayScaleFactor = Math.min(
      (canvas.width * 0.8) / cardWidth,
      (canvas.height * 0.8) / cardHeight,
    );
    const displayWidth = cardWidth * displayScaleFactor;
    const displayHeight = cardHeight * displayScaleFactor;
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
    // At scale 1.0, image should fill the card dimensions while maintaining aspect ratio
    const imageAspect = imageRef.current.width / imageRef.current.height;
    const cardAspect = cardWidth / cardHeight;

    let imageScaleWidth: number;
    let imageScaleHeight: number;

    if (imageAspect > cardAspect) {
      // Image is wider: scale by height to fill card
      imageScaleHeight = cardHeight;
      imageScaleWidth = cardHeight * imageAspect;
    } else {
      // Image is taller or square: scale by width to fill card
      imageScaleWidth = cardWidth;
      imageScaleHeight = cardWidth / imageAspect;
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
    ctx.fillText("Card Area", cardLeft + 8, cardTop + 16);
  }, [offsetX, offsetY, scale, cardWidth, cardHeight]);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      drawPreview();
    };
    img.src = imageUrl;
  }, [imageUrl, drawPreview]);

  // Redraw when transform changes
  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

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
    const CARD_WIDTH_INCHES = 2.5;
    const CARD_HEIGHT_INCHES = 3.5;
    const scaleX = (CARD_WIDTH_INCHES * DPI) / (2.44 * 100);
    const scaleY = (CARD_HEIGHT_INCHES * DPI) / (3.67 * 100);

    // Calculate display scale factor
    const displayScaleFactor = Math.min(
      (canvas.width * 0.8) / cardWidth,
      (canvas.height * 0.8) / cardHeight,
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

  function handleSave() {
    onSave(offsetX, offsetY, scale);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog image-editor-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">
            Image Position & Zoom (Work in Progress)
          </h3>
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
              <p>
                <strong>Drag</strong> to reposition • <strong>Scroll</strong> to
                zoom
              </p>
            </div>
          </div>

          <div className="image-editor-controls">
            <div className="control-group">
              <label>
                X Offset: <span className="value">{offsetX.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="-200"
                max="200"
                step="1"
                value={offsetX}
                onChange={(e) => setOffsetX(parseFloat(e.target.value))}
                className="control-slider"
              />
            </div>

            <div className="control-group">
              <label>
                Y Offset: <span className="value">{offsetY.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="-200"
                max="200"
                step="1"
                value={offsetY}
                onChange={(e) => setOffsetY(parseFloat(e.target.value))}
                className="control-slider"
              />
            </div>

            <div className="control-group">
              <label>
                Zoom: <span className="value">{scale.toFixed(2)}x</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="control-slider"
              />
            </div>

            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={handleReset}
              style={{ width: "100%" }}
            >
              Reset
            </button>
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
