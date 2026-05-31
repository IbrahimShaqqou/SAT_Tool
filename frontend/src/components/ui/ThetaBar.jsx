/**
 * ThetaBar — IRT ability progress bar with mastery zone bands. (Study Hall)
 *
 * Visual range: −3 to +3 (theta scale).
 * Bands read as a warm low → high progression, reinforced by the always-present
 * text label (so meaning never rests on color alone):
 *   −3 → 0    sand     (Familiar zone)
 *    0 → 1    pine     (Proficient zone)
 *    1 → +3   bronze   (Mastered zone)
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

const LEVEL_LABELS = {
  0: { name: 'Not Started', label: 'text-ink-faint' },
  1: { name: 'Familiar',    label: 'text-ink-subtle' },
  2: { name: 'Proficient',  label: 'text-accent-700 dark:text-accent-400' },
  3: { name: 'Mastered',    label: 'text-brand-700 dark:text-brand-400' },
};

// Warm zone fills (light → high). Sand → pine → bronze.
const ZONE_FAMILIAR   = 'bg-brand-200 dark:bg-brand-300/35';
const ZONE_PROFICIENT = 'bg-accent-400 dark:bg-accent-500';
const ZONE_MASTERED   = 'bg-brand-500 dark:bg-brand-400';

// Stale ("needs review") — warm rust, distinct but in-family.
const STALE_FAMILIAR   = 'bg-orange-200 dark:bg-orange-900/40';
const STALE_PROFICIENT = 'bg-orange-300 dark:bg-orange-700/60';
const STALE_MASTERED   = 'bg-orange-400 dark:bg-orange-600/60';

export const ThetaBar = ({
  theta = null,
  masteryLevel = 0,
  se = null,
  isStale = false,
  size = 'compact',   // 'compact' | 'full'
  showSE = false,
}) => {
  const levelConfig = LEVEL_LABELS[masteryLevel] ?? LEVEL_LABELS[0];
  const isNotStarted = theta === null || theta === undefined;
  const markerPct = isNotStarted ? null : thetaToPercent(theta);

  const staleLabel = isStale ? 'Needs Review' : levelConfig.name;
  const staleLabelClass = isStale
    ? 'text-orange-700 dark:text-orange-400'
    : levelConfig.label;

  const containerClass = size === 'full' ? 'w-full' : 'w-40';

  const ariaLabel = isNotStarted
    ? 'Mastery: not started'
    : `Mastery: ${staleLabel}${theta != null ? `, ability ${theta > 0 ? '+' : ''}${theta.toFixed(2)}` : ''}`;

  return (
    <div className={`${containerClass} select-none`} role="img" aria-label={ariaLabel}>
      {/* Level label */}
      <div className={`text-xs font-semibold mb-1 ${staleLabelClass}`}>
        {staleLabel}
        {showSE && !isNotStarted && (
          <span className="font-normal ml-1">
            {se !== null && se !== undefined ? `± ${se.toFixed(2)}` : ''}
            {se !== null && se !== undefined && se > 0.5 && (
              <span className="text-ink-faint ml-1">(low confidence)</span>
            )}
          </span>
        )}
        {showSE && isNotStarted && (
          <span className="font-normal text-ink-faint ml-1">0 responses</span>
        )}
      </div>

      {/* Bar */}
      <div
        className={`
          relative h-2.5 rounded-full overflow-visible
          ${isNotStarted
            ? 'bg-surface-muted border border-dashed border-edge-strong'
            : isStale
              ? 'bg-orange-100 dark:bg-orange-900/25'
              : 'bg-surface-muted'
          }
        `}
      >
        {!isNotStarted && (
          <>
            {/* Familiar band: −3 → 0 (0%–50%) */}
            <div
              className={`absolute top-0 left-0 h-full rounded-l-full ${isStale ? STALE_FAMILIAR : ZONE_FAMILIAR}`}
              style={{ width: `${TICK_0}%` }}
            />
            {/* Proficient band: 0 → 1 (50%–66.67%) */}
            <div
              className={`absolute top-0 h-full ${isStale ? STALE_PROFICIENT : ZONE_PROFICIENT}`}
              style={{ left: `${TICK_0}%`, width: `${TICK_1 - TICK_0}%` }}
            />
            {/* Mastered band: 1 → +3 (66.67%–100%) */}
            <div
              className={`absolute top-0 h-full rounded-r-full ${isStale ? STALE_MASTERED : ZONE_MASTERED}`}
              style={{ left: `${TICK_1}%`, width: `${100 - TICK_1}%` }}
            />

            {/* Zone-boundary ticks (in surface color so they read as hairlines) */}
            <div className="absolute top-0 bottom-0 w-px bg-surface-card/80 z-10" style={{ left: `${TICK_0}%` }} />
            <div className="absolute top-0 bottom-0 w-px bg-surface-card/80 z-10" style={{ left: `${TICK_1}%` }} />

            {/* Marker dot */}
            <div className="absolute top-1/2 z-20 -translate-y-1/2 -translate-x-1/2" style={{ left: `${markerPct}%` }}>
              <div className="w-3.5 h-3.5 rounded-full bg-white shadow-card-md border-2 border-brand-700 dark:border-brand-300" />
            </div>
          </>
        )}
      </div>

      {/* Theta label below marker */}
      {!isNotStarted && (
        <div className="relative h-4 mt-0.5">
          <span
            className="absolute text-[10px] font-medium tabular-nums text-ink-subtle -translate-x-1/2"
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
