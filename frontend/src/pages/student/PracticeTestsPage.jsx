/**
 * Practice Tests — Study Hall.
 * List of official full-length SAT practice tests. Warm tokens, dark mode,
 * borderless tiles. Renders inside AppLayout.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, BookText, Calculator, Clock, ArrowRight } from 'lucide-react';
import {
  Button, Skeleton, PageHeader, Section, Surface, StatusPill,
} from '../../components/ui';
import { listPracticeTests } from '../../services/practiceTestApi';

const PracticeTestsPage = () => {
  const navigate = useNavigate();
  const [practiceTests, setPracticeTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPracticeTests = async () => {
    try {
      setLoading(true);
      const tests = await listPracticeTests();
      setPracticeTests(tests);
      setError(null);
    } catch (err) {
      console.error('Error loading practice tests:', err);
      setError('Failed to load practice tests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPracticeTests(); }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="mb-4 text-rose-600 dark:text-rose-400">{error}</p>
        <Button variant="secondary" onClick={loadPracticeTests}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <PageHeader
        eyebrow="Full length"
        title="Practice tests"
        subtitle="Official-style, full-length SAT tests with adaptive Module 2 sections. Each takes about 2 hr 14 min."
      />

      {/* What to expect */}
      <Section title="What to expect">
        <ul className="grid grid-cols-1 gap-2 text-sm text-ink-muted sm:grid-cols-2">
          <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" /> 98 questions (54 Reading/Writing, 44 Math)</li>
          <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" /> Module 2 adapts to your Module 1 performance</li>
          <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" /> Timed modules, just like the digital SAT</li>
          <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" /> Instant section (200–800) and total (400–1600) scores</li>
        </ul>
      </Section>

      {/* Test grid */}
      <Section className="mt-10" title="Available tests">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-52 w-full" rounded="rounded-2xl" />)}
          </div>
        ) : practiceTests.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-subtle">No practice tests available yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {practiceTests.map((test) => (
              <Surface key={test.id} elevation="sm" padded={false} className="flex flex-col p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold tracking-tight text-ink-body">{test.test_name}</h3>
                    <p className="text-sm text-ink-subtle">{test.total_questions} questions · {test.estimated_time_minutes} min</p>
                  </div>
                  {test.is_active && <StatusPill tone="good" size="sm">Available</StatusPill>}
                </div>

                {test.description && <p className="mb-4 text-sm text-ink-muted">{test.description}</p>}

                <ul className="mb-5 space-y-1.5 text-sm text-ink-subtle">
                  <li className="flex items-center gap-2"><BookText className="h-4 w-4 text-ink-faint" /> Reading & Writing · 54 questions</li>
                  <li className="flex items-center gap-2"><Calculator className="h-4 w-4 text-ink-faint" /> Math · 44 questions</li>
                  <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-ink-faint" /> 2 hr 14 min (timed)</li>
                </ul>

                <Button
                  variant={test.is_active ? 'primary' : 'secondary'}
                  disabled={!test.is_active}
                  className="mt-auto w-full"
                  onClick={() => navigate(`/student/practice-tests/${test.test_number}/start`)}
                >
                  {test.is_active ? <>Start test <ArrowRight className="h-4 w-4" /></> : 'Coming soon'}
                </Button>
              </Surface>
            ))}
          </div>
        )}
      </Section>

      {/* Before you start */}
      <Section className="mt-10" title="Before you start" icon={FileText}>
        <ol className="space-y-2 text-sm text-ink-muted">
          {[
            'Find a quiet place with no distractions.',
            'Have scratch paper and a calculator ready for Math.',
            'Plan for 2+ hours of uninterrupted time.',
            'Take the breaks between sections (10 min each, skippable).',
            'Treat it like the real SAT — no phones, no looking up answers.',
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-bold text-ink-subtle">{i + 1}</span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
};

export default PracticeTestsPage;
