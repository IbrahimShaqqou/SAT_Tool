/**
 * Full-Length SAT Results — Study Hall.
 * Big-number total score, borderless section scores + module breakdown,
 * act-on-able next steps. Tokens, dark mode, a11y. Renders inside AppLayout.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import {
  Button, Skeleton, PageHeader, Section, StatusPill, AnimatedNumber, ProgressRing,
} from '../../components/ui';
import { practiceService } from '../../services';

const SectionScore = ({ label, score, correct, total }) => {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <Section title={label}>
      <div className="flex items-end justify-between">
        <div className="flex items-end gap-2">
          <AnimatedNumber value={score} className="font-display text-4xl font-semibold tracking-tight text-ink-body sm:text-5xl" />
          <span className="mb-1.5 text-sm text-ink-subtle">/ 800</span>
        </div>
        <div className="text-right">
          <StatusPill value={pct} />
          <p className="mt-1 text-xs text-ink-subtle">{correct}/{total} correct</p>
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-brand-500 transition-[width] duration-700 ease-out-expo" style={{ width: `${pct}%` }} />
      </div>
    </Section>
  );
};

const FullLengthResultsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await practiceService.getFullLengthResults(id);
        setResults(response.data);
      } catch (err) {
        console.error('Error fetching results:', err);
        setError(err.response?.data?.error || 'Failed to load results');
      } finally {
        setIsLoading(false);
      }
    };
    fetchResults();
  }, [id]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-44 w-full" rounded="rounded-2xl" />
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-32 w-full" rounded="rounded-xl" />
          <Skeleton className="h-32 w-full" rounded="rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="mb-2 font-display text-xl font-semibold text-ink-body">Couldn't load results</h2>
        <p className="mb-4 text-ink-subtle">{error}</p>
        <Button variant="secondary" onClick={() => navigate('/student')}><ArrowLeft className="h-4 w-4" /> Back to dashboard</Button>
      </div>
    );
  }

  const { math_score, reading_writing_score, total_score, math_correct, math_total, rw_correct, rw_total, modules } = results;
  const scorePct = Math.min(100, Math.max(0, ((total_score - 400) / 1200) * 100));

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <PageHeader eyebrow="Score report" title="Full-length practice test" subtitle="Your SAT score, scored just like the real thing." />

      {/* Total score hero */}
      <div className="flex flex-col items-start gap-8 border-y border-edge py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Total SAT score</p>
          <div className="mt-1 flex items-end gap-3">
            <AnimatedNumber value={total_score} className="font-display text-[5rem] leading-[0.86] font-semibold tracking-tight text-ink-body sm:text-[6.5rem]" />
            <span className="mb-3 text-lg text-ink-subtle">/ 1600</span>
          </div>
        </div>
        <ProgressRing value={scorePct} size={128} stroke={10} label={`Total score ${total_score} out of 1600`}>
          <div className="text-center">
            <AnimatedNumber value={total_score} className="font-display text-2xl font-semibold text-ink-body" />
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">/ 1600</p>
          </div>
        </ProgressRing>
      </div>

      {/* Section scores */}
      <div className="mt-10 grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
        <SectionScore label="Math" score={math_score} correct={math_correct} total={math_total} />
        <SectionScore label="Reading & Writing" score={reading_writing_score} correct={rw_correct} total={rw_total} />
      </div>

      {/* Module breakdown */}
      {modules?.length > 0 && (
        <Section className="mt-10" title="Module breakdown">
          <ul className="divide-y divide-edge-subtle">
            {modules.map((m) => {
              const pct = m.total_questions > 0 ? Math.round((m.questions_correct / m.total_questions) * 100) : 0;
              return (
                <li key={m.id} className="py-4 first:pt-0">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-body">{m.title}</p>
                      <p className="text-xs text-ink-subtle">
                        {m.questions_correct}/{m.total_questions} correct
                        {m.time_spent_seconds ? ` · ${Math.round(m.time_spent_seconds / 60)} min` : ''}
                      </p>
                    </div>
                    <StatusPill value={pct} size="sm" />
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-brand-500 transition-[width] duration-700 ease-out-expo" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Next steps */}
      <Section className="mt-10" title="What to do next">
        <ul className="space-y-3 text-sm text-ink-muted">
          {[
            'Review the questions you missed to understand the mistakes.',
            'Practice skills where you scored below 70%.',
            'Take another full-length test in 1–2 weeks to track progress.',
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="primary" onClick={() => navigate('/student/study-plan')}>
            View study plan <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" onClick={() => navigate('/student')}>Back to dashboard</Button>
        </div>
      </Section>
    </div>
  );
};

export default FullLengthResultsPage;
