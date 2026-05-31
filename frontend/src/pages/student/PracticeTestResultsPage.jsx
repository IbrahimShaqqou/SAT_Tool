/**
 * Practice Test Results — Study Hall.
 * Big-number SAT score hero with goal-style ring, borderless section scores
 * and module breakdown, act-on-able next steps. Tokens, dark mode, a11y.
 * Renders inside AppLayout (no full-screen wrapper).
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { getTestResults } from '../../services/practiceTestApi';
import {
  Button, Skeleton, PageHeader, Section, StatBlock, StatusPill, AnimatedNumber, ProgressRing,
} from '../../components/ui';

const SectionScore = ({ label, data }) => {
  const pct = data.percentage;
  return (
    <Section title={label}>
      <div className="flex items-end justify-between">
        <StatBlock value={data.score} label="section score" size="lg" />
        <div className="text-right">
          <StatusPill value={pct} />
          <p className="mt-1 text-xs text-ink-subtle">{data.correct}/{data.total} correct</p>
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-brand-500 transition-[width] duration-700 ease-out-expo" style={{ width: `${pct}%` }} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-edge-subtle pt-3 text-sm">
        <div className="flex justify-between"><dt className="text-ink-subtle">Module 1</dt><dd className="font-medium tabular-nums text-ink-body">{data.module_1_correct}/{data.module_1_total}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-subtle">Module 2 ({data.module_2_path})</dt><dd className="font-medium tabular-nums text-ink-body">{data.module_2_correct}/{data.module_2_total}</dd></div>
      </dl>
    </Section>
  );
};

const PracticeTestResultsPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getTestResults(sessionId);
        setResults(data);
        setError(null);
      } catch (err) {
        console.error('Error loading results:', err);
        setError('Failed to load test results');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-48 w-full" rounded="rounded-2xl" />
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-44 w-full" rounded="rounded-xl" />
          <Skeleton className="h-44 w-full" rounded="rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="mb-4 text-rose-600 dark:text-rose-400">{error}</p>
        <Button variant="secondary" onClick={() => navigate('/student/practice-tests')}>
          <ArrowLeft className="h-4 w-4" /> Back to practice tests
        </Button>
      </div>
    );
  }

  if (!results) return null;

  // SAT 400–1600 → progress for the ring
  const scorePct = Math.min(100, Math.max(0, ((results.total_score - 400) / 1200) * 100));

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <PageHeader
        eyebrow="Score report"
        title={results.test_name}
        subtitle={`Completed ${new Date(results.completed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
      />

      {/* Big-number total score hero */}
      <div className="flex flex-col items-start gap-8 border-y border-edge py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Total SAT score</p>
          <div className="mt-1 flex items-end gap-3">
            <AnimatedNumber value={results.total_score} className="font-display text-[5rem] leading-[0.86] font-semibold tracking-tight text-ink-body sm:text-[6.5rem]" />
            <span className="mb-3 text-lg text-ink-subtle">/ 1600</span>
          </div>
          {results.percentile != null && (
            <p className="mt-2 text-sm text-ink-muted">
              <span className="font-semibold text-ink-body">{results.percentile}th percentile</span> — higher than {results.percentile}% of test-takers
            </p>
          )}
        </div>
        <ProgressRing value={scorePct} size={128} stroke={10} label={`Total score ${results.total_score} out of 1600`}>
          <div className="text-center">
            <AnimatedNumber value={results.total_score} className="font-display text-2xl font-semibold text-ink-body" />
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">/ 1600</p>
          </div>
        </ProgressRing>
      </div>

      {/* Section scores */}
      <div className="mt-10 grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
        <SectionScore label="Math" data={results.math} />
        <SectionScore label="Reading & Writing" data={results.reading_writing} />
      </div>

      {/* How adaptive scoring worked */}
      <Section className="mt-10" title="How your score was built" hint="2-stage adaptive, like the real Digital SAT">
        <div className="grid grid-cols-1 gap-x-12 gap-y-4 text-sm text-ink-muted md:grid-cols-2">
          <ul className="space-y-1.5">
            <li><span className="font-semibold text-ink-body">1400–1600</span> · top 10%</li>
            <li><span className="font-semibold text-ink-body">1200–1390</span> · top 25%</li>
            <li><span className="font-semibold text-ink-body">1000–1190</span> · ~50th percentile</li>
            <li><span className="font-semibold text-ink-body">800–990</span> · below average</li>
          </ul>
          <ul className="space-y-1.5">
            <li>Module 1 sets your Module 2 difficulty.</li>
            <li>You took the <span className="font-semibold text-ink-body">{results.math.module_2_path}</span> Math Module 2.</li>
            <li>You took the <span className="font-semibold text-ink-body">{results.reading_writing.module_2_path}</span> R&W Module 2.</li>
            <li>A harder Module 2 raises your score ceiling.</li>
          </ul>
        </div>
      </Section>

      {/* Next steps — act-on-able */}
      <Section className="mt-10" title="What to do next">
        <ul className="space-y-3 text-sm text-ink-muted">
          {[
            'Review the questions you missed to spot patterns.',
            'Practice the skills you scored below 70% on.',
            'Take another full-length test in 1–2 weeks to track improvement.',
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="primary" onClick={() => navigate('/student/adaptive')}>
            Practice weak skills <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" onClick={() => navigate('/student/practice-tests')}>
            Take another test
          </Button>
        </div>
      </Section>
    </div>
  );
};

export default PracticeTestResultsPage;
