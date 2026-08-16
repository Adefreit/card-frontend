import { useState } from "react";
import "./RenderedCard.css";
import { config } from "../config";
import LoadingSpinner from "./LoadingSpinner";
import { XPBar } from "../features/cards/components/XPBar";

interface RenderedCardProps {
  imageUrl: string | null;
  isLoading?: boolean;
  alt?: string;
  dpi?: number;
  xpInfo?: {
    xp: number;
    level: number;
    nextLevelXP: number;
  };
  minted?: boolean;
  showXPBar?: boolean;
}

// Calculate dimensions in pixels (constant regardless of DPI)
const calculateCardDimensions = () => ({
  width: config.CARDS.WIDTH_INCHES * config.CARDS.DEFAULT_PREVIEW_DPI,
  height: config.CARDS.HEIGHT_INCHES * config.CARDS.DEFAULT_PREVIEW_DPI,
});

export const RenderedCard: React.FC<RenderedCardProps> = ({
  imageUrl,
  isLoading = false,
  alt = "Card preview",
  xpInfo,
  minted = false,
  showXPBar = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const dimensions = calculateCardDimensions();

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  const showLoading = isLoading || !imageLoaded;
  const showError = !imageUrl || imageError;
  const shouldRenderXPBar = Boolean(showXPBar && xpInfo);

  return (
    <div className="rendered-card-shell">
      <div
        className="rendered-card"
        style={{ maxWidth: `${dimensions.width}px` }}
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
              className="rendered-card__image"
            />
            {showLoading && (
              <div className="rendered-card__loading-overlay">
                <LoadingSpinner label="Generating preview..." />
              </div>
            )}
          </>
        )}
      </div>
      {shouldRenderXPBar && xpInfo ? (
        <div className="rendered-card__xp">
          <XPBar xpInfo={xpInfo} minted={minted} />
        </div>
      ) : null}
    </div>
  );
};

export default RenderedCard;
