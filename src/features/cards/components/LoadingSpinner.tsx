import "./LoadingSpinner.css";

interface LoadingSpinnerProps {
  /**
   * Text to display below the spinner.
   * If not provided, only the spinner is shown.
   */
  label?: string;
  /**
   * Optional CSS class for custom styling of the container.
   */
  className?: string;
  /**
   * Optional aria-live announcement for accessibility.
   * Defaults to "polite".
   */
  ariaLive?: "polite" | "assertive";
}

/**
 * A reusable spinning animation component for loading states.
 * Used when generating card previews and proofs.
 */
export default function LoadingSpinner({
  label,
  className = "",
  ariaLive = "polite",
}: LoadingSpinnerProps) {
  return (
    <div
      className={`loading-spinner-container ${className}`}
      role="status"
      aria-live={ariaLive}
      aria-label={label}
    >
      <span className="loading-spinner" aria-hidden="true" />
      {label && <p className="loading-spinner-label">{label}</p>}
    </div>
  );
}
