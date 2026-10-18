import { useState } from "react";
import "./RenderedCard.css";
import { config } from "../config";
import LoadingSpinner from "./LoadingSpinner";
import { XPBar } from "../features/cards/components/XPBar";

interface RenderedCardProps {
  imageUrl: string | null;
  backImageUrl?: string | null;
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
  backImageUrl,
  isLoading = false,
  alt = "Card preview",
  xpInfo,
  minted = false,
  showXPBar = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [backError, setBackError] = useState(false);
  const canFlip = !!backImageUrl && !backError && !!imageUrl;
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

  return (
    <div className="rendered-card-shell">
      <div
        className={`rendered-card${canFlip ? " rendered-card--flippable" : ""}`}
        style={{ maxWidth: `${dimensions.width}px` }}
        {...(canFlip
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": flipped
                ? "Showing card back. Click to show front"
                : "Showing card front. Click to show back",
              onClick: () => setFlipped((f) => !f),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFlipped((f) => !f);
                }
              },
            }
          : {})}
      >
        <div
          className={`rendered-card__flipper${flipped && canFlip ? " is-flipped" : ""}`}
        >
          <div className="rendered-card__face">
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
          {canFlip && (
            <div className="rendered-card__face rendered-card__face--back">
              <img
                src={backImageUrl as string}
                alt={`${alt} (back)`}
                onError={() => setBackError(true)}
                className="rendered-card__image"
              />
            </div>
          )}
        </div>
        {canFlip && (
          <span className="rendered-card__flip-hint" aria-hidden="true">
            ⟲ Click to Flip
          </span>
        )}
      </div>
      {showXPBar && xpInfo ? (
        <div className="rendered-card__xp">
          <XPBar xpInfo={xpInfo} minted={minted} />
        </div>
      ) : null}
    </div>
  );
};

export default RenderedCard;
