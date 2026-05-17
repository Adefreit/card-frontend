import { useState } from "react";

interface GameCarouselProps {
  images: string[];
  className?: string;
}

export function GameCarousel({ images, className = "" }: GameCarouselProps) {
  const [index, setIndex] = useState(0);
  const validImages = images.filter(Boolean);
  const current = validImages[index] || "/games/missing.jpg";

  function prev() {
    setIndex((i) => (i === 0 ? validImages.length - 1 : i - 1));
  }
  function next() {
    setIndex((i) => (i === validImages.length - 1 ? 0 : i + 1));
  }

  if (!validImages.length) {
    return (
      <div className={`game-carousel ${className}`}>
        <img
          src="/games/missing.jpg"
          alt="Missing"
          className="game-carousel-image"
        />
        <div className="game-carousel-caption">No images available</div>
      </div>
    );
  }

  return (
    <div className={`game-carousel ${className}`}>
      <div className="game-carousel-stage">
        <button
          className="game-carousel-nav"
          onClick={prev}
          aria-label="Previous image"
        >
          &#8592;
        </button>
        <img
          src={current}
          alt="Game preview"
          className="game-carousel-image"
          onError={(e) => (e.currentTarget.src = "/games/missing.jpg")}
        />
        <button
          className="game-carousel-nav"
          onClick={next}
          aria-label="Next image"
        >
          &#8594;
        </button>
      </div>
      <div className="game-carousel-dots">
        {validImages.map((_, i) => (
          <button
            key={i}
            className={i === index ? "active" : ""}
            onClick={() => setIndex(i)}
            aria-label={`Go to image ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
