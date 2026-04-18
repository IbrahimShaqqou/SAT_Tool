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
import { ThetaBar } from './ThetaBar';

// Mastery level configuration - using softer, muted colors
export const MASTERY_LEVELS = {
  0: {
    name: 'Not Started',
    color: 'gray',
    bgClass: 'bg-gray-100 dark:bg-gray-700/50',
    textClass: 'text-gray-600 dark:text-gray-300',
    borderClass: 'border-gray-200 dark:border-gray-600',
    iconBgClass: 'bg-gray-200 dark:bg-gray-600',
    progressBgClass: 'bg-gray-300 dark:bg-gray-500',
    Icon: CircleDot,
  },
  1: {
    name: 'Familiar',
    color: 'blue',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
    textClass: 'text-blue-600 dark:text-blue-300',
    borderClass: 'border-blue-200 dark:border-blue-700',
    iconBgClass: 'bg-blue-100 dark:bg-blue-800/40',
    progressBgClass: 'bg-blue-400 dark:bg-blue-500',
    Icon: BookOpen,
  },
  2: {
    name: 'Proficient',
    color: 'green',
    bgClass: 'bg-emerald-50 dark:bg-emerald-900/20',
    textClass: 'text-emerald-600 dark:text-emerald-300',
    borderClass: 'border-emerald-200 dark:border-emerald-700',
    iconBgClass: 'bg-emerald-100 dark:bg-emerald-800/40',
    progressBgClass: 'bg-emerald-400 dark:bg-emerald-500',
    Icon: CheckCircle2,
  },
  3: {
    name: 'Mastered',
    color: 'gold',
    bgClass: 'bg-yellow-50 dark:bg-yellow-900/15',
    textClass: 'text-yellow-700 dark:text-yellow-200',
    borderClass: 'border-yellow-200 dark:border-yellow-700',
    iconBgClass: 'bg-yellow-100 dark:bg-yellow-800/30',
    progressBgClass: 'bg-yellow-400 dark:bg-yellow-500',
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
 * Mastery progress card showing level with ThetaBar and requirements checklist
 */
export const MasteryProgressCard = ({
  level = 0,
  theta = null,
  abilitySe = null,
  progressPercent = 0,
  nextLevel = null,
  requirementsMet = {},
  isStale = false,
  showSE = false,
  className = '',
}) => {
  const config = MASTERY_LEVELS[level] || MASTERY_LEVELS[0];
  const nextConfig = nextLevel ? MASTERY_LEVELS[level + 1] : null;
  const { bgClass, borderClass } = config;

  return (
    <div className={`rounded-lg border ${borderClass} ${bgClass} p-3 ${className}`}>
      {isStale && (
        <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 mb-2">
          <AlertCircle size={10} />
          Mastery is fading — practice to keep it fresh
        </div>
      )}

      {/* ThetaBar */}
      <ThetaBar
        theta={theta}
        masteryLevel={level}
        se={abilitySe}
        isStale={isStale}
        size="full"
        showSE={showSE}
      />

      {/* Requirements checklist */}
      {nextConfig && Object.keys(requirementsMet).length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            To reach {nextConfig.name}:
          </div>
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
 * Skill mastery row for displaying in lists, using ThetaBar
 */
export const SkillMasteryRow = ({
  skillName,
  level = 0,
  theta = null,
  abilitySe = null,
  responsesCount = 0,
  daysAgo = 0,
  isStale = false,
  showSE = false,
  onClick,
  className = '',
}) => {
  return (
    <div
      className={`
        p-3 rounded-lg
        bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        hover:border-gray-300 dark:hover:border-gray-600
        transition-colors
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Skill name + meta */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900 dark:text-gray-100 truncate mr-2">
          {skillName}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
          {responsesCount > 0 && <span>{responsesCount}q</span>}
          {daysAgo > 0 && <span>{daysAgo}d ago</span>}
        </div>
      </div>

      {/* ThetaBar */}
      <ThetaBar
        theta={theta}
        masteryLevel={level}
        se={abilitySe}
        isStale={isStale}
        size="full"
        showSE={showSE}
      />
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
