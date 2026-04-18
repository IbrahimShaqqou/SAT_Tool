/**
 * ThetaBar — IRT ability progress bar with level zone bands.
 *
 * Visual range: −3 to +3 (theta scale).
 * Bands:
 *   −3 → 0    blue     (Familiar zone)
 *    0 → 1    emerald  (Proficient zone)
 *    1 → +3   gold     (Mastered zone)
 *
 * The marker position reflects raw theta; the level label reflects the
 * mastery_level enum. These can diverge intentionally.
 */

const THETA_MIN = -3;
const THETA_MAX = 3;
const THETA_SPAN = THETA_MAX - THETA_MIN; // 6

// Tick positions as percentages of the full bar
const TICK_0 = ((0 - THETA_MIN) / THETA_SPAN) * 100;       // 50%
const TICK_1 = ((1 - THETA_MIN) / THETA_SPAN) * 100;       // 66.67%

function thetaToPercent(theta) {
  return Math.max(0, Math.min(100, ((theta - THETA_MIN) / THETA_SPAN) * 100));
}

const LEVEL_COLORS = {
  0: { label: 'text-gray-500 dark:text-gray-400', bar: 'text-gray-400', name: 'Not Started' },
  1: { label: 'text-blue-600 dark:text-blue-400', bar: 'text-blue-500', name: 'Familiar' },
  2: { label: 'text-emerald-600 dark:text-emerald-400', bar: 'text-emerald-500', name: 'Proficient' },
  3: { label: 'text-yellow-600 dark:text-yellow-400', bar: 'text-yellow-500', name: 'Mastered' },
};

export const ThetaBar = ({
  theta = null,
  masteryLevel = 0,
  se = null,
  isStale = false,
  size = 'compact',   // 'compact' | 'full'
  showSE = false,
}) => {
  const levelConfig = LEVEL_COLORS[masteryLevel] ?? LEVEL_COLORS[0];
  const isNotStarted = theta === null || theta === undefined;
  const markerPct = isNotStarted ? null : thetaToPercent(theta);

  const staleLabel = isStale ? 'Needs Review' : levelConfig.name;
  const staleLabelClass = isStale
    ? 'text-orange-600 dark:text-orange-400'
    : levelConfig.label;

  const containerClass = size === 'full' ? 'w-full' : 'w-40';

  return (
    <div className={`${containerClass} select-none`}>
      {/* Level label */}
      <div className={`text-xs font-semibold mb-1 ${staleLabelClass}`}>
        {staleLabel}
        {showSE && !isNotStarted && (
          <span className="font-normal ml-1">
            {se !== null && se !== undefined ? `± ${se.toFixed(2)}` : ''}
            {se !== null && se !== undefined && se > 0.5 && (
              <span className="text-gray-400 dark:text-gray-500 ml-1">(low confidence)</span>
            )}
          </span>
        )}
        {showSE && isNotStarted && (
          <span className="font-normal text-gray-400 dark:text-gray-500 ml-1">0 responses</span>
        )}
      </div>

      {/* Bar */}
      <div
        className={`
          relative h-2.5 rounded-full overflow-visible
          ${isNotStarted
            ? 'bg-gray-200 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600'
            : isStale
              ? 'bg-orange-100 dark:bg-orange-900/30'
              : 'bg-gray-100 dark:bg-gray-800'
          }
        `}
      >
        {!isNotStarted && (
          <>
            {/* Blue band: −3 → 0 (0%–50%) */}
            <div
              className={`absolute top-0 left-0 h-full rounded-l-full ${
                isStale ? 'bg-orange-300 dark:bg-orange-700/60' : 'bg-blue-400 dark:bg-blue-500'
              }`}
              style={{ width: `${TICK_0}%` }}
            />
            {/* Emerald band: 0 → 1 (50%–66.67%) */}
            <div
              className={`absolute top-0 h-full ${
                isStale ? 'bg-orange-400 dark:bg-orange-600/60' : 'bg-emerald-400 dark:bg-emerald-500'
              }`}
              style={{ left: `${TICK_0}%`, width: `${TICK_1 - TICK_0}%` }}
            />
            {/* Gold band: 1 → +3 (66.67%–100%) */}
            <div
              className={`absolute top-0 h-full rounded-r-full ${
                isStale ? 'bg-orange-500 dark:bg-orange-500/60' : 'bg-yellow-400 dark:bg-yellow-500'
              }`}
              style={{ left: `${TICK_1}%`, width: `${100 - TICK_1}%` }}
            />

            {/* Tick at θ=0 */}
            <div
              className="absolute top-0 bottom-0 w-px bg-white/80 dark:bg-gray-900/60 z-10"
              style={{ left: `${TICK_0}%` }}
            />
            {/* Tick at θ=1 */}
            <div
              className="absolute top-0 bottom-0 w-px bg-white/80 dark:bg-gray-900/60 z-10"
              style={{ left: `${TICK_1}%` }}
            />

            {/* Marker dot */}
            <div
              className="absolute top-1/2 z-20 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${markerPct}%` }}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-white dark:bg-gray-100 shadow-md border-2 border-gray-700 dark:border-gray-900 flex items-center justify-center" />
            </div>
          </>
        )}
      </div>

      {/* Theta label below marker */}
      {!isNotStarted && (
        <div className="relative h-4 mt-0.5">
          <span
            className="absolute text-[10px] font-medium text-gray-600 dark:text-gray-400 -translate-x-1/2"
            style={{ left: `${markerPct}%` }}
          >
            θ {theta > 0 ? '+' : ''}{theta?.toFixed(2)}
            {showSE && se !== null && se !== undefined ? ` ± ${se.toFixed(2)}` : ''}
          </span>
        </div>
      )}
    </div>
  );
};

export default ThetaBar;
