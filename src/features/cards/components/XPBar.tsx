import "./XPBar.css";

interface XPBarProps {
  xpInfo?: {
    xp: number;
    level: number;
    nextLevelXP: number;
  };
  minted?: boolean;
}

export function XPBar({ xpInfo, minted }: XPBarProps) {
  if (!xpInfo) {
    return null;
  }

  const { xp, level, nextLevelXP } = xpInfo;

  // Calculate total XP needed for current level
  // Using the formula: level * (level - 1) * 50
  const totalXPForCurrentLevel = level * (level - 1) * 50;
  const progressXP = xp - totalXPForCurrentLevel;
  const totalXPToNextLevel = nextLevelXP + progressXP;

  // Calculate progress percentage (0-100)
  const progressPercent =
    totalXPToNextLevel > 0 ? (progressXP / totalXPToNextLevel) * 100 : 100;

  const isMaxLevel = nextLevelXP === 0;

  // Determine tier based on level
  const getTier = (lvl: number) => {
    if (lvl >= 15) return "legendary";
    if (lvl >= 10) return "prestigious";
    return "common";
  };

  const tier = getTier(level);

  return (
    <div
      className={`xp-bar-container ${!minted ? "xp-bar-container--disabled" : ""}`}
    >
      <div className="xp-bar-track">
        <div
          className="xp-bar-fill"
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>

      <div className="xp-bar-info">
        <div className="xp-info-section">
          <span className="xp-info-value">LVL {level}</span>
        </div>
        <div className="xp-info-section">
          {isMaxLevel ? (
            <span className="xp-info-value">MAX</span>
          ) : (
            <span className="xp-info-value">
              XP {progressXP}/{totalXPToNextLevel}
            </span>
          )}
        </div>
        <div className="xp-info-section">
          <span className={`xp-info-value xp-tier xp-tier--${tier}`}>
            {tier}
          </span>
        </div>
      </div>
    </div>
  );
}
