/**
 * Study Plan — the live worklist (score-raising loop).
 *
 * Shows the student's ordered weak-skill worklist generated from their practice
 * tests. Each item: before→after progress, status, and actions (Learn /
 * Practice / Take mastery check). Empty when no test imported yet.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, ArrowRight, BookOpen, Dumbbell, ClipboardCheck, Library,
  CheckCircle2, AlertTriangle, Circle, Loader2,
} from 'lucide-react';
import { Button, PageHeader, Skeleton, Surface, Section, useToast } from '../../components/ui';
import { worklistService } from '../../services/worklistService';

const STATUS_META = {
  open:         { label: 'To do',          icon: Circle,        cls: 'text-ink-faint' },
  in_progress:  { label: 'In progress',    icon: Loader2,       cls: 'text-brand-600 dark:text-brand-300' },
  passed:       { label: 'Passed',         icon: CheckCircle2,  cls: 'text-accent-600 dark:text-accent-300' },
  done:         { label: 'Done',           icon: CheckCircle2,  cls: 'text-accent-600 dark:text-accent-300' },
  needs_tutor:  { label: 'Needs your tutor', icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400' },
  refresh:      { label: 'Refresh',        icon: ClipboardCheck, cls: 'text-brand-600 dark:text-brand-300' },
};

const fmtPct = (v) => (v == null ? null : `${Math.round(v)}%`);

const ProgressBefore = ({ item }) => {
  const before = fmtPct(item.baseline_accuracy);
  const after = fmtPct(item.current_accuracy);
  if (before == null && after == null) return null;
  if (after != null && before != null) {
    return (
      <span className="text-xs tabular-nums text-ink-subtle">
        {before} <ArrowRight className="inline h-3 w-3" /> <span className="font-semibold text-ink-body">{after}</span>
      </span>
    );
  }
  return <span className="text-xs tabular-nums text-ink-subtle">{after ?? before} so far</span>;
};

const StudyPlanPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await worklistService.getMyWorklist();
      setItems(res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startCheck = async (item) => {
    try {
      const res = await worklistService.startCheck(item.id, 'mastery');
      navigate(`/student/mastery-check/${res.data.check_id}`, {
        state: { check: res.data, skillName: item.skill_name },
      });
    } catch (err) {
      const d = err?.response?.data?.detail || 'Could not start the check.';
      toast?.error?.(d);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-40 w-full" rounded="rounded-2xl" />
      </div>
    );
  }

  // Empty state — no worklist yet (no test imported).
  if (!items || items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          eyebrow="Your plan"
          title="Build your plan from a real test"
          subtitle="Your worklist comes from an official Bluebook practice test: the skills to fix, in order, with a mastery check to prove you've got each one."
        />
        <div className="mt-6 rounded-2xl border border-dashed border-edge px-6 py-12 text-center">
          <Upload className="mx-auto mb-3 h-8 w-8 text-brand-500" />
          <p className="mb-5 text-sm text-ink-muted">
            Take a practice test in College Board Bluebook, then import your results to get your worklist.
          </p>
          <Button variant="primary" onClick={() => navigate('/student/practice-tests')}>
            Import a test <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const remaining = items.filter((i) => !['done', 'passed'].includes(i.status));
  const allDone = remaining.length === 0;

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <PageHeader
        eyebrow="Your plan"
        title="Your worklist"
        subtitle="Work these skills in order. Learn it, practice it, then pass the mastery check to clear it."
      />

      {allDone && (
        <Surface glow="brand" className="mt-4 rounded-2xl p-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-accent-600 dark:text-accent-300" />
          <p className="font-display text-lg font-semibold text-ink-body">You've cleared your plan</p>
          <p className="mt-1 text-sm text-ink-muted">Take your next practice test to find your next focus areas.</p>
          <Button variant="primary" className="mt-4" onClick={() => navigate('/student/practice-tests')}>
            Practice tests <ArrowRight className="h-4 w-4" />
          </Button>
        </Surface>
      )}

      <Section className="mt-6" title="Skills to work">
        <ul className="space-y-2">
          {items.map((item) => {
            const meta = STATUS_META[item.status] || STATUS_META.open;
            const Icon = meta.icon;
            const cleared = ['done', 'passed'].includes(item.status);
            return (
              <Surface key={item.id} as="li" className="rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 shrink-0 ${meta.cls} ${item.status === 'in_progress' ? 'animate-spin-slow' : ''}`} />
                      <span className="font-medium text-ink-body">{item.skill_name}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 pl-6">
                      <span className={`text-xs ${meta.cls}`}>{meta.label}</span>
                      <ProgressBefore item={item} />
                      {item.domain && <span className="text-xs text-ink-faint">· {item.domain}</span>}
                    </div>
                    {item.status === 'needs_tutor' && (
                      <p className="mt-1.5 pl-6 text-xs text-amber-700 dark:text-amber-400">
                        Two checks didn't pass — your tutor will help with this one.
                      </p>
                    )}
                  </div>
                </div>

                {!cleared && item.status !== 'needs_tutor' && (
                  <div className="mt-3 flex flex-wrap gap-2 pl-6">
                    {item.has_lesson && (
                      <Button variant="ghost" size="sm"
                        onClick={() => navigate(`/student/lessons/${item.lesson_id}`)}>
                        <BookOpen className="mr-1.5 h-4 w-4" /> Learn
                      </Button>
                    )}
                    <Button variant="secondary" size="sm"
                      onClick={() => navigate(`/student/adaptive?skill=${item.skill_id}&autostart=true`)}>
                      <Dumbbell className="mr-1.5 h-4 w-4" /> Practice
                    </Button>
                    <Button variant="ghost" size="sm"
                      onClick={() => navigate(`/student/questions?skill=${item.skill_id}`)}>
                      <Library className="mr-1.5 h-4 w-4" /> Question bank
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => startCheck(item)}>
                      <ClipboardCheck className="mr-1.5 h-4 w-4" /> Take mastery check
                    </Button>
                  </div>
                )}
              </Surface>
            );
          })}
        </ul>
      </Section>
    </div>
  );
};

export default StudyPlanPage;
