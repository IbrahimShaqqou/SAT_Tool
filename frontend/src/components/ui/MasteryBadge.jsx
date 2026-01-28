/**
 * MasteryBadge component for displaying Khan Academy-style mastery levels
 *
 * Levels:
 * - 0: Not Started (gray)
 * - 1: Familiar (blue)
 * - 2: Proficient (green)
 * - 3: Mastered (gold)
 */

import {
  CircleDot,
  BookOpen,
  CheckCircle2,
  Trophy,
  AlertCircle
} from 'lucide-react';

// Mastery level configuration
export const MASTERY_LEVELS = {
  0: {
    name: 'Not Started',
    color: 'gray',
    bgClass: 'bg-gray-100 dark:bg-gray-700',
    textClass: 'text-gray-600 dark:text-gray-400',
    borderClass: 'border-gray-200 dark:border-gray-600',
    iconBgClass: 'bg-gray-200 dark:bg-gray-600',
    progressBgClass: 'bg-gray-200 dark:bg-gray-600',
    Icon: CircleDot,
  },
  1: {
    name: 'Familiar',
    color: 'blue',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
    textClass: 'text-blue-700 dark:text-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-800',
    iconBgClass: 'bg-blue-100 dark:bg-blue-900/40',
    progressBgClass: 'bg-blue-500 dark:bg-blue-400',
    Icon: BookOpen,
  },
  2: {
    name: 'Proficient',
    color: 'green',
    bgClass: 'bg-green-50 dark:bg-green-900/20',
    textClass: 'text-green-700 dark:text-green-400',
    borderClass: 'border-green-200 dark:border-green-800',
    iconBgClass: 'bg-green-100 dark:bg-green-900/40',
    progressBgClass: 'bg-green-500 dark:bg-green-400',
    Icon: CheckCircle2,
  },
  3: {
    name: 'Mastered',
    color: 'gold',
    bgClass: 'bg-amber-50 dark:bg-amber-900/20',
    textClass: 'text-amber-700 dark:text-amber-400',
    borderClass: 'border-amber-200 dark:border-amber-800',
    iconBgClass: 'bg-amber-100 dark:bg-amber-900/40',
    progressBgClass: 'bg-amber-500 dark:bg-amber-400',
    Icon: Trophy,
  },
};

/**
 * Compact mastery badge showing icon and level name
 */
export const MasteryBadge = ({
  level = 0,
  showLabel = true,
  size = 'md',
  isStale = false,
  className = ''
}) => {
  const config = MASTERY_LEVELS[level] || MASTERY_LEVELS[0];
  const { Icon, name, bgClass, textClass, borderClass } = config;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-sm gap-1.5',
    lg: 'px-3 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${bgClass} ${textClass} ${borderClass}
        ${sizeClasses[size]}
        ${isStale ? 'opacity-60' : ''}
        ${className}
      `}
    >
      <Icon size={iconSizes[size]} className="flex-shrink-0" />
      {showLabel && <span>{name}</span>}
      {isStale && (
        <AlertCircle size={iconSizes[size]} className="text-orange-500 dark:text-orange-400" />
      )}
    </span>
  );
};

/**
 * Mastery progress card showing level with progress toward next level
 */
export const MasteryProgressCard = ({
  level = 0,
  progressPercent = 0,
  nextLevel = null,
  requirementsMet = {},
  isStale = false,
  className = '',
}) => {
  const config = MASTERY_LEVELS[level] || MASTERY_LEVELS[0];
  const nextConfig = nextLevel ? MASTERY_LEVELS[level + 1] : null;
  const { Icon, name, bgClass, textClass, iconBgClass, progressBgClass } = config;

  return (
    <div className={`rounded-lg border ${config.borderClass} ${bgClass} p-3 ${className}`}>
      {/* Header with icon and level */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-full ${iconBgClass}`}>
          <Icon size={16} className={textClass} />
        </div>
        <div className="flex-1">
          <div className={`font-semibold ${textClass}`}>{name}</div>
          {isStale && (
            <div className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
              <AlertCircle size={10} />
              Needs review
            </div>
          )}
        </div>
      </div>

      {/* Progress bar toward next level */}
      {nextConfig && (
        <div className="mt-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600 dark:text-gray-400">
              Progress to {nextConfig.name}
            </span>
            <span className={textClass}>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${progressBgClass} transition-all duration-300`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Requirements checklist */}
      {nextConfig && Object.keys(requirementsMet).length > 0 && (
        <div className="mt-2 space-y-1">
          {Object.entries(requirementsMet).map(([key, met]) => (
            <div
              key={key}
              className={`text-xs flex items-center gap-1.5 ${
                met
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {met ? (
                <CheckCircle2 size={12} />
              ) : (
                <CircleDot size={12} />
              )}
              <span className="capitalize">{key.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Skill mastery row for displaying in lists
 */
export const SkillMasteryRow = ({
  skillName,
  level = 0,
  accuracy = 0,
  responsesCount = 0,
  daysAgo = 0,
  isStale = false,
  onClick,
  className = '',
}) => {
  const config = MASTERY_LEVELS[level] || MASTERY_LEVELS[0];
  const { Icon, name, textClass, iconBgClass } = config;

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-lg
        bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        hover:border-gray-300 dark:hover:border-gray-600
        transition-colors
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Mastery icon */}
      <div className={`p-2 rounded-full ${iconBgClass}`}>
        <Icon size={18} className={textClass} />
      </div>

      {/* Skill info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
          {skillName}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <span className={textClass}>{name}</span>
          <span>•</span>
          <span>{accuracy}% accuracy</span>
          {responsesCount > 0 && (
            <>
              <span>•</span>
              <span>{responsesCount} responses</span>
            </>
          )}
        </div>
      </div>

      {/* Stale indicator */}
      {isStale && (
        <div className="flex items-center gap-1 text-orange-500 dark:text-orange-400 text-sm">
          <AlertCircle size={14} />
          <span className="hidden sm:inline">Review</span>
        </div>
      )}

      {/* Days ago */}
      {daysAgo > 0 && !isStale && (
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {daysAgo}d ago
        </div>
      )}
    </div>
  );
};

/**
 * Mastery summary showing counts at each level
 */
export const MasterySummary = ({
  mastered = 0,
  proficient = 0,
  familiar = 0,
  notStarted = 0,
  className = '',
}) => {
  const levels = [
    { level: 3, count: mastered, ...MASTERY_LEVELS[3] },
    { level: 2, count: proficient, ...MASTERY_LEVELS[2] },
    { level: 1, count: familiar, ...MASTERY_LEVELS[1] },
    { level: 0, count: notStarted, ...MASTERY_LEVELS[0] },
  ];

  const total = mastered + proficient + familiar + notStarted;

  return (
    <div className={`space-y-2 ${className}`}>
      {levels.map(({ level, count, name, Icon, textClass, progressBgClass }) => {
        const percent = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={level} className="flex items-center gap-3">
            <div className="w-24 flex items-center gap-1.5">
              <Icon size={14} className={textClass} />
              <span className={`text-sm ${textClass}`}>{name}</span>
            </div>
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${progressBgClass} transition-all duration-300`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="w-8 text-right text-sm text-gray-600 dark:text-gray-400">
              {count}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MasteryBadge;
