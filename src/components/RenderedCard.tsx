import { useState } from "react";
import "./RenderedCard.css";
import { config } from "../config";
import LoadingSpinner from "./LoadingSpinner";

interface RenderedCardProps {
  imageUrl: string | null;
  isLoading?: boolean;
  alt?: string;
  dpi?: number;
}

// Calculate dimensions in pixels (constant regardless of DPI)
const calculateCardDimensions = () => ({
  width: config.CARDS.WIDTH_INCHES * config.CARDS.DEFAULT_PREVIEW_DPI,
  height: config.CARDS.HEIGHT_INCHES * config.CARDS.DEFAULT_PREVIEW_DPI,
});

// Determines the CSS class based on the DPI
const calculateCardCSS = (dpi: number) => {
  return dpi === config.CARDS.DEFAULT_PREVIEW_DPI
    ? "rendered-card__image_150_DPI"
    : "rendered-card__image_300_DPI";
};

export const RenderedCard: React.FC<RenderedCardProps> = ({
  imageUrl,
  isLoading = false,
  alt = "Card preview",
  dpi = config.CARDS.DEFAULT_PREVIEW_DPI,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const dimensions = calculateCardDimensions();
  const renderedCardCSS = calculateCardCSS(dpi);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  const showLoading = isLoading || !imageLoaded;
  const showError = !imageUrl || imageError;

  return (
    <div
      className="rendered-card"
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
    >
      {showError ? (
        <div className="rendered-card__placeholder">
          <div className="rendered-card__placeholder-text">
            No preview available
          </div>
        </div>
      ) : (
        <>
          <img
            src={imageUrl}
            alt={alt}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={renderedCardCSS}
          />
          {showLoading && (
            <div className="rendered-card__loading-overlay">
              <LoadingSpinner label="Generating preview..." />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RenderedCard;
