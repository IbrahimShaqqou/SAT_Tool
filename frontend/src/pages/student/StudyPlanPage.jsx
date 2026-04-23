/**
 * Study Plan Page
 * Personalized todo-list of skills to study, ordered by priority.
 * Each task has clickable links to lessons and adaptive practice.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Target, RefreshCw, TrendingUp, BookOpen, Brain, Sparkles,
  ChevronDown, ChevronRight, CheckCircle2, Circle, ArrowRight,
} from 'lucide-react';
import { Button, LoadingSpinner, Badge, EmptyState } from '../../components/ui';
import { recommendationService } from '../../services';

const typeConfig = {
  review:               { icon: RefreshCw,   color: 'amber',   label: 'Review' },
  level_up:             { icon: TrendingUp,  color: 'blue',    label: 'Level Up' },
  lesson_then_practice: { icon: BookOpen,    color: 'violet',  label: 'Learn & Practice' },
  practice:             { icon: Brain,       color: 'brand',   label: 'Practice' },
  new_skill:            { icon: Sparkles,    color: 'emerald',  label: 'New Skill' },
  nudge:                { icon: Target,      color: 'slate',   label: 'Daily Goal' },
};

const colorClasses = {
  amber:   { bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-600 dark:text-amber-400',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',   dot: 'bg-amber-400' },
  blue:    { bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-600 dark:text-blue-400',     badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',     dot: 'bg-blue-500' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', dot: 'bg-violet-500' },
  brand:   { bg: 'bg-brand-50 dark:bg-brand-900/20',   text: 'text-brand-600 dark:text-brand-400',   badge: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',   dot: 'bg-brand-500' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', dot: 'bg-emerald-500' },
  slate:   { bg: 'bg-slate-50 dark:bg-slate-800',       text: 'text-slate-600 dark:text-slate-400',     badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',       dot: 'bg-slate-400' },
};

const STORAGE_KEY = 'study_plan_completed';

function getCompletedTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setCompletedTask(skillId, done) {
  const map = getCompletedTasks();
  if (done) {
    map[skillId] = Date.now();
  } else {
    delete map[skillId];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function TaskItem({ task, completed, onToggle }) {
  const cfg = typeConfig[task.type] || typeConfig.practice;
  const c = colorClasses[cfg.color] || colorClasses.brand;
  const Icon = cfg.icon;

  return (
    <div className={`flex items-start gap-4 px-5 py-4 transition-colors ${completed ? 'opacity-60' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="mt-0.5 flex-shrink-0 focus:outline-none"
        aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {completed ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : (
          <Circle className="h-5 w-5 text-slate-300 dark:text-slate-600 hover:text-slate-400" />
        )}
      </button>

      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`h-4.5 w-4.5 ${c.text}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className={`text-sm font-semibold text-slate-900 dark:text-slate-100 ${completed ? 'line-through' : ''}`}>
            {task.title}
          </p>
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${c.badge}`}>
            {cfg.label}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          {task.description}
          <span className="text-slate-400 dark:text-slate-500"> · ~{task.estimated_minutes} min</span>
        </p>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {task.actions?.map((action, i) => (
            <Link key={i} to={action.href}>
              <Button
                size="sm"
                variant={action.variant === 'primary' ? 'primary' : 'secondary'}
              >
                {action.label}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Domain badge */}
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg flex-shrink-0 mt-0.5">
        {task.domain_code}
      </span>
    </div>
  );
}

export default function StudyPlanPage() {
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completedMap, setCompletedMap] = useState(getCompletedTasks);
  const [filter, setFilter] = useState('all'); // all | math | reading_writing
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const fetch = async () => {
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
    fetch();
  }, []);

  const toggleTask = (skillId) => {
    const next = !completedMap[skillId];
    setCompletedTask(skillId, next);
    setCompletedMap(getCompletedTasks());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Filter tasks
  const filtered = tasks.filter(t => filter === 'all' || t.section === filter);
  const incomplete = filtered.filter(t => !completedMap[t.skill_id]);
  const completed = filtered.filter(t => completedMap[t.skill_id]);
  const completedCount = Object.keys(completedMap).length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Study Plan</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Your personalized roadmap based on diagnostic results and skill mastery.
        </p>
      </div>

      {/* Progress bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-500" />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Progress
            </span>
          </div>
          <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
            {completedCount}/{totalCount} tasks
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {summary && (
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
            {summary.review_tasks > 0 && <span>{summary.review_tasks} to review</span>}
            {summary.lesson_tasks > 0 && <span>{summary.lesson_tasks} lessons</span>}
            <span>{summary.math_tasks} math</span>
            <span>{summary.rw_tasks} reading & writing</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'math', label: 'Math' },
          { key: 'reading_writing', label: 'Reading & Writing' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === f.key
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      {incomplete.length === 0 && completed.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card">
          <EmptyState
            icon={Target}
            title="No tasks yet"
            description="Take a diagnostic to get your personalized study plan."
          />
        </div>
      ) : (
        <>
          {/* Incomplete tasks */}
          {incomplete.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
              {incomplete.map((task) => (
                <TaskItem
                  key={task.skill_id}
                  task={task}
                  completed={false}
                  onToggle={() => toggleTask(task.skill_id)}
                />
              ))}
            </div>
          )}

          {/* Completed tasks (collapsible) */}
          {completed.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-2"
              >
                {showCompleted ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {completed.length} completed
              </button>
              {showCompleted && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
                  {completed.map((task) => (
                    <TaskItem
                      key={task.skill_id}
                      task={task}
                      completed={true}
                      onToggle={() => toggleTask(task.skill_id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
