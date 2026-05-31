/**
 * Study Plan — Study Hall.
 * Borderless checklist with a warm progress bar, type-tagged tasks, and a
 * collapsible completed group. Tokens, dark mode, a11y, motion.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Target, RefreshCw, TrendingUp, BookOpen, Brain, Sparkles,
  ChevronDown, ChevronRight, CheckCircle2, Circle, ArrowRight,
} from 'lucide-react';
import { Button, Skeleton, EmptyState, PageHeader, AnimatedNumber } from '../../components/ui';
import { recommendationService } from '../../services';

// Type → icon + warm tint. Tints stay within the amber/pine family so the page
// reads as one palette; the text label carries the meaning.
const typeConfig = {
  review:               { icon: RefreshCw,  label: 'Review',           tint: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',     dot: 'bg-brand-400' },
  level_up:             { icon: TrendingUp, label: 'Level up',         tint: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',     dot: 'bg-brand-500' },
  lesson_then_practice: { icon: BookOpen,   label: 'Learn & practice', tint: 'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300', dot: 'bg-accent-500' },
  practice:             { icon: Brain,      label: 'Practice',         tint: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',     dot: 'bg-brand-500' },
  new_skill:            { icon: Sparkles,   label: 'New skill',        tint: 'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300', dot: 'bg-accent-500' },
  nudge:                { icon: Target,     label: 'Daily goal',       tint: 'bg-surface-muted text-ink-muted',                                          dot: 'bg-ink-faint' },
};

const STORAGE_KEY = 'study_plan_completed';
const getCompleted = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } };
const setCompleted = (skillId, done) => {
  const map = getCompleted();
  if (done) map[skillId] = Date.now(); else delete map[skillId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

function TaskItem({ task, completed, onToggle }) {
  const cfg = typeConfig[task.type] || typeConfig.practice;
  const Icon = cfg.icon;
  return (
    <li className={`flex items-start gap-4 py-4 transition-opacity ${completed ? 'opacity-55' : ''}`}>
      <button
        onClick={onToggle}
        className="mt-0.5 shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-pressed={completed}
        aria-label={completed ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}
      >
        {completed
          ? <CheckCircle2 className="h-5 w-5 text-accent-600 dark:text-accent-400" />
          : <Circle className="h-5 w-5 text-ink-faint hover:text-ink-subtle" />}
      </button>

      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.tint}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-center gap-2">
          <p className={`text-sm font-semibold text-ink-body ${completed ? 'line-through' : ''}`}>{task.title}</p>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">{cfg.label}</span>
        </div>
        <p className="mb-2 text-xs text-ink-subtle">
          {task.description}
          <span className="text-ink-faint"> · ~{task.estimated_minutes} min</span>
        </p>
        {!completed && task.actions?.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {task.actions.map((action, i) => (
              <Link key={i} to={action.href}>
                <Button size="sm" variant={action.variant === 'primary' ? 'primary' : 'secondary'}>
                  {action.label} <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            ))}
          </div>
        )}
      </div>

      {task.domain_code && (
        <span className="mt-0.5 shrink-0 rounded-lg bg-surface-muted px-2 py-1 text-[10px] font-bold text-ink-subtle">{task.domain_code}</span>
      )}
    </li>
  );
}

export default function StudyPlanPage() {
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completedMap, setCompletedMap] = useState(getCompleted);
  const [filter, setFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const res = await recommendationService.getStudyPlan();
        setTasks(res.data.tasks || []);
        setSummary(res.data.summary || {});
      } catch (err) {
        console.error('Failed to load study plan:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlan();
  }, []);

  const toggleTask = (skillId) => {
    setCompleted(skillId, !completedMap[skillId]);
    setCompletedMap(getCompleted());
  };

  const filtered = tasks.filter((t) => filter === 'all' || t.section === filter);
  const incomplete = filtered.filter((t) => !completedMap[t.skill_id]);
  const completed = filtered.filter((t) => completedMap[t.skill_id]);
  const completedCount = Object.keys(completedMap).length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'math', label: 'Math' },
    { key: 'reading_writing', label: 'Reading & Writing' },
  ];

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <PageHeader
        eyebrow="Your roadmap"
        title="Study plan"
        subtitle="Built from your diagnostic and skill mastery. Work top to bottom; check things off as you go."
      />

      {/* Progress */}
      {isLoading ? (
        <Skeleton className="h-16 w-full" rounded="rounded-xl" />
      ) : (
        <div className="border-y border-edge py-5">
          <div className="mb-2.5 flex items-end justify-between">
            <div className="flex items-baseline gap-2">
              <AnimatedNumber value={progressPct} suffix="%" className="font-display text-2xl font-semibold text-ink-body" />
              <span className="text-sm text-ink-subtle">complete</span>
            </div>
            <span className="text-sm font-medium text-ink-muted">{completedCount}/{totalCount} tasks</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-brand-500 transition-[width] duration-700 ease-out-expo" style={{ width: `${progressPct}%` }} />
          </div>
          {summary && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
              {summary.review_tasks > 0 && <span>{summary.review_tasks} to review</span>}
              {summary.lesson_tasks > 0 && <span>{summary.lesson_tasks} lessons</span>}
              {summary.math_tasks != null && <span>{summary.math_tasks} math</span>}
              {summary.rw_tasks != null && <span>{summary.rw_tasks} reading & writing</span>}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      {!isLoading && tasks.length > 0 && (
        <div role="tablist" aria-label="Filter study plan" className="mt-6 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key} role="tab" aria-selected={active} onClick={() => setFilter(f.key)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted hover:text-ink-body hover:bg-edge-subtle'}`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Tasks */}
      <div className="mt-6">
        {isLoading ? (
          <ul className="divide-y divide-edge-subtle border-t border-edge">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-start gap-4 py-4">
                <Skeleton className="h-5 w-5" rounded="rounded-full" />
                <Skeleton className="h-9 w-9" rounded="rounded-xl" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-64" /></div>
              </li>
            ))}
          </ul>
        ) : incomplete.length === 0 && completed.length === 0 ? (
          <EmptyState icon={Target} title="No tasks yet" description="Take a diagnostic and we'll build your personalized study plan here." />
        ) : (
          <>
            {incomplete.length > 0 && (
              <ul className="divide-y divide-edge-subtle border-t border-edge">
                {incomplete.map((task) => (
                  <TaskItem key={task.skill_id} task={task} completed={false} onToggle={() => toggleTask(task.skill_id)} />
                ))}
              </ul>
            )}
            {incomplete.length === 0 && (
              <p className="border-t border-edge py-8 text-center text-sm text-ink-subtle">
                Everything here is checked off. Nice work.
              </p>
            )}

            {completed.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => setShowCompleted((v) => !v)}
                  className="flex items-center gap-2 rounded-lg text-sm font-medium text-ink-subtle transition-colors hover:text-ink-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  aria-expanded={showCompleted}
                >
                  {showCompleted ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {completed.length} completed
                </button>
                {showCompleted && (
                  <ul className="mt-2 divide-y divide-edge-subtle border-t border-edge">
                    {completed.map((task) => (
                      <TaskItem key={task.skill_id} task={task} completed onToggle={() => toggleTask(task.skill_id)} />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
