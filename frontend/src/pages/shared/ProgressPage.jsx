/**
 * My Progress Page — Study Hall.
 * Big-number stat row, borderless mastery sections, warm theme-aware score
 * chart, expandable skills-by-domain. Tokens, dark mode, a11y.
 * Comprehensive view of student's learning progress using Khan Academy-style 4-level mastery.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Target, Award, BookOpen, ChevronDown, ChevronUp, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import {
  Badge, Skeleton,
  PageHeader, Section, StatBlock, StatusPill,
} from '../../components/ui';
import {
  MasteryBadge,
  MasterySummary,
  SkillMasteryRow,
} from '../../components/ui/MasteryBadge';
import useChartTheme from '../../components/charts/useChartTheme';
import { progressService } from '../../services';

const ProgressPage = () => {
  const navigate = useNavigate();
  const t = useChartTheme();
  const [progress, setProgress] = useState(null);
  const [skills, setSkills] = useState(null);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDomains, setExpandedDomains] = useState(new Set());

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const [summaryRes, skillsRes, historyRes] = await Promise.all([
          progressService.getSummary(),
          progressService.getSkills().catch(() => ({
            data: {
              skills: [],
              weak_skills: [],
              strong_skills: [],
              skills_mastered: 0,
              skills_proficient: 0,
              skills_familiar: 0,
              skills_not_started: 0,
              needs_review_count: 0,
            }
          })),
          progressService.getScoreHistory().catch(() => ({ data: { history: [] } })),
        ]);
        setProgress(summaryRes.data);
        setSkills(skillsRes.data);
        setScoreHistory(historyRes.data.history || []);
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgress();
  }, []);

  const toggleDomain = (domain) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  // Group skills by domain
  const groupedSkills = skills?.skills?.reduce((acc, skill) => {
    const domain = skill.domain_name || 'Other';
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(skill);
    return acc;
  }, {}) || {};

  // Calculate average mastery level for a domain (using the 0-3 scale)
  const getDomainAvgLevel = (domainSkills) => {
    if (!domainSkills.length) return 0;
    return domainSkills.reduce((sum, s) => sum + (s.mastery_level || 0), 0) / domainSkills.length;
  };

  // Get badge variant based on mastery level
  const getLevelBadgeVariant = (level) => {
    if (level >= 2.5) return 'success';
    if (level >= 1.5) return 'info';
    if (level >= 0.5) return 'warning';
    return 'default';
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl pb-8">
        <PageHeader eyebrow="Your journey" title="My Progress" subtitle="Track your preparation journey" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-edge py-6 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2"><Skeleton className="h-9 w-16" /><Skeleton className="h-3 w-20" /></div>
          ))}
        </div>
        <Skeleton className="mt-10 h-52 w-full" rounded="rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <PageHeader eyebrow="Your journey" title="My Progress" subtitle="Track your preparation journey" />

      {/* Overall Stats — big-number row */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-edge py-6 sm:grid-cols-4">
        <StatBlock
          value={progress?.overall_accuracy || 0}
          suffix="%"
          decimals={0}
          label="Accuracy"
          size="lg"
        />
        <StatBlock value={progress?.total_questions_answered || 0} label="Questions" />
        <StatBlock value={progress?.assignments_completed || 0} label="Assignments" />
        <StatBlock
          value={Math.round((progress?.total_time_spent || 0) / 60)}
          suffix="m"
          label="Practice time"
        />
      </div>

      {/* Score History Chart */}
      <Section className="mt-10" title="Score history" icon={TrendingUp} hint="Estimated SAT score over time">
        {scoreHistory.length >= 2 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={scoreHistory.map(h => ({
                date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                score: h.estimated_score,
                low: h.score_low,
                high: h.score_high,
              }))}
              margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="none" stroke={t.grid} strokeWidth={1} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: t.axis }}
                tickLine={{ stroke: t.grid }}
                axisLine={{ stroke: t.grid, strokeWidth: 1 }}
              />
              <YAxis
                domain={[400, 1600]}
                tick={{ fontSize: 12, fill: t.axis }}
                tickCount={5}
                tickLine={{ stroke: t.grid }}
                axisLine={{ stroke: t.grid, strokeWidth: 1 }}
              />
              <Tooltip
                contentStyle={t.tooltip}
                formatter={(val, name) => name === 'score' ? [`${val}`, 'Estimated Score'] : null}
                labelStyle={{ fontWeight: 600 }}
              />
              <ReferenceLine y={1600} stroke={t.grid} strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="score"
                stroke={t.brand}
                strokeWidth={2.5}
                dot={{ fill: t.brand, strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: t.brand }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center text-center">
            <TrendingUp className="mb-2 h-8 w-8 text-ink-faint" />
            <p className="text-sm text-ink-subtle">
              Complete 2+ tests (diagnostic or practice) to see your score trend
            </p>
          </div>
        )}
      </Section>

      {/* Mastery Summary */}
      {skills && (skills.skills_mastered > 0 || skills.skills_proficient > 0 ||
                  skills.skills_familiar > 0 || skills.total_skills_practiced > 0) && (
        <Section className="mt-12" title="Mastery overview" icon={Award} hint="Your progress across all skill levels">
          <MasterySummary
            mastered={skills.skills_mastered || 0}
            proficient={skills.skills_proficient || 0}
            familiar={skills.skills_familiar || 0}
            notStarted={skills.skills_not_started || 0}
          />
        </Section>
      )}

      {/* Skills Needing Review */}
      {skills?.needs_review_count > 0 && (
        <Section
          className="mt-12"
          title="Skills needing review"
          icon={RefreshCw}
          hint="Practice these to maintain your mastery"
          action={<Badge variant="warning">{skills.needs_review_count}</Badge>}
        >
          <div className="space-y-2">
            {skills.skills
              .filter(s => s.needs_review)
              .slice(0, 5)
              .map((skill) => (
                <SkillMasteryRow
                  key={skill.skill_id}
                  skillName={skill.skill_name}
                  level={skill.mastery_level}
                  theta={skill.theta}
                  abilitySe={skill.ability_se}
                  responsesCount={skill.responses_count}
                  daysAgo={skill.days_since_practice}
                  isStale={skill.is_stale}
                />
              ))}
          </div>
        </Section>
      )}

      {/* Skills to Improve */}
      {skills?.weak_skills?.length > 0 && (
        <Section className="mt-12" title="Areas to focus on" icon={Target} hint="Skills that need more practice">
          <div className="space-y-2">
            {skills.weak_skills.slice(0, 5).map((skill) => (
              <SkillMasteryRow
                key={skill.skill_id}
                skillName={skill.skill_name}
                level={skill.mastery_level}
                theta={skill.theta}
                abilitySe={skill.ability_se}
                responsesCount={skill.responses_count}
                daysAgo={skill.days_since_practice}
                isStale={skill.is_stale}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Strong Skills */}
      {skills?.strong_skills?.length > 0 && (
        <Section className="mt-12" title="Your strengths" icon={Award} hint="Skills you're performing well on">
          <div className="space-y-2">
            {skills.strong_skills.slice(0, 5).map((skill) => (
              <SkillMasteryRow
                key={skill.skill_id}
                skillName={skill.skill_name}
                level={skill.mastery_level}
                theta={skill.theta}
                abilitySe={skill.ability_se}
                responsesCount={skill.responses_count}
                daysAgo={skill.days_since_practice}
                isStale={skill.is_stale}
              />
            ))}
          </div>
        </Section>
      )}

      {/* All Skills by Domain */}
      <Section className="mt-12" title="All skills" icon={BookOpen} hint="Your progress across all skill areas">
        {Object.keys(groupedSkills).length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-subtle">
            Start practicing to see your skill progress here.
          </p>
        ) : (
          <div className="space-y-2">
            {Object.entries(groupedSkills).map(([domain, domainSkills]) => {
              const avgLevel = getDomainAvgLevel(domainSkills);
              const masteredCount = domainSkills.filter(s => s.mastery_level === 3).length;
              const proficientCount = domainSkills.filter(s => s.mastery_level === 2).length;
              const isExpanded = expandedDomains.has(domain);

              return (
                <div key={domain} className="overflow-hidden rounded-xl bg-surface-muted">
                  <button
                    onClick={() => toggleDomain(domain)}
                    aria-expanded={isExpanded}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-edge-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="truncate font-medium text-ink-body">{domain}</span>
                      <Badge variant={getLevelBadgeVariant(avgLevel)}>
                        {masteredCount > 0 && `${masteredCount} mastered`}
                        {masteredCount > 0 && proficientCount > 0 && ' / '}
                        {proficientCount > 0 && `${proficientCount} proficient`}
                        {masteredCount === 0 && proficientCount === 0 && 'In Progress'}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm text-ink-subtle">
                        {domainSkills.length} skills
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-ink-faint" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-ink-faint" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <ul className="divide-y divide-edge-subtle px-4 pb-2">
                      {domainSkills.map((skill) => (
                        <li
                          key={skill.skill_id}
                          className="flex items-center justify-between gap-3 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm text-ink-muted">
                              {skill.skill_name}
                            </span>
                            {skill.is_stale && (
                              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Needs review" />
                            )}
                            {skill.lesson_id && (
                              <button
                                onClick={() => navigate(`/student/lessons/${skill.lesson_id}`)}
                                aria-label={skill.lesson_completed ? 'Lesson completed' : 'Study lesson'}
                                title={skill.lesson_completed ? 'Lesson completed' : 'Study lesson'}
                                className={`flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                                  skill.lesson_completed
                                    ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300'
                                    : 'bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-900/30 dark:text-brand-400 dark:hover:bg-brand-900/50'
                                }`}
                              >
                                {skill.lesson_completed
                                  ? <CheckCircle className="h-3 w-3" />
                                  : <BookOpen className="h-3 w-3" />
                                }
                              </button>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <StatusPill value={skill.accuracy_percent || 0} size="sm" />
                            <MasteryBadge
                              level={skill.mastery_level}
                              size="sm"
                              isStale={skill.is_stale}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
};

export default ProgressPage;
