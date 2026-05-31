/**
 * Practice Test Start — Study Hall.
 * Test instructions + acknowledgement before launching. Warm tokens, dark mode,
 * borderless sections. Renders inside AppLayout.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Info, Clock, Ban, CheckCircle2, XCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button, Skeleton, PageHeader, Section } from '../../components/ui';
import { getPracticeTest } from '../../services/practiceTestApi';

const MODULES = [
  {
    label: 'Reading & Writing',
    rows: [
      ['Module 1 (standard)', '27 questions · 32 min'],
      ['10-minute break', 'skippable'],
      ['Module 2 (adaptive)', '27 questions · 32 min'],
    ],
  },
  {
    label: 'Math',
    rows: [
      ['10-minute break', 'skippable'],
      ['Module 1 (standard)', '22 questions · 35 min'],
      ['10-minute break', 'skippable'],
      ['Module 2 (adaptive)', '22 questions · 35 min'],
    ],
  },
];

const INFO = [
  ['Adaptive testing', 'Your Module 1 performance sets the difficulty of Module 2 in each section.'],
  ['Timed modules', 'Each module has a strict limit. When time expires, it submits automatically.'],
  ['No going back', 'Once you submit a module, you cannot return to it.'],
  ['Breaks', '10-minute breaks between sections are skippable if you want to continue.'],
  ['Scoring', "You'll get scaled scores (200–800 per section) just like the real SAT."],
];

const PracticeTestStartPage = () => {
  const { testNumber } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showAckError, setShowAckError] = useState(false);

  useEffect(() => {
    const loadTest = async () => {
      try {
        setLoading(true);
        const data = await getPracticeTest(testNumber);
        setTest(data);
        setError(null);
      } catch (err) {
        console.error('Error loading test:', err);
        setError('Failed to load practice test');
      } finally {
        setLoading(false);
      }
    };
    loadTest();
  }, [testNumber]);

  const handleStart = () => {
    if (!acknowledged) { setShowAckError(true); return; }
    navigate(`/student/practice-tests/take/${testNumber}`);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-40 w-full" rounded="rounded-2xl" />
        <Skeleton className="mt-6 h-40 w-full" rounded="rounded-2xl" />
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

  if (!test) return null;

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <PageHeader
        eyebrow="Full length"
        title={test.test_name}
        subtitle={test.description || '98 questions · 2 hr 14 min · adaptive, just like the digital SAT.'}
      />

      {/* Structure */}
      <Section title="Test structure">
        <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
          {MODULES.map((m) => (
            <div key={m.label}>
              <h3 className="mb-2 text-sm font-semibold text-ink-body">{m.label}</h3>
              <dl className="divide-y divide-edge-subtle">
                {m.rows.map(([k, v], i) => (
                  <div key={i} className="flex items-center justify-between py-2 text-sm">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="font-medium text-ink-body">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Section>

      {/* Important info */}
      <Section className="mt-10" title="Good to know" icon={Info}>
        <ul className="space-y-3">
          {INFO.map(([title, body]) => (
            <li key={title} className="flex items-start gap-2.5 text-sm">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
              <span className="text-ink-muted"><span className="font-semibold text-ink-body">{title}:</span> {body}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Testing conditions + acknowledge */}
      <Section className="mt-10" title="Testing conditions">
        <ul className="mb-5 space-y-2 text-sm">
          {[
            [true, 'Find a quiet, distraction-free environment'],
            [true, 'Have scratch paper and a calculator ready (Math section)'],
            [true, 'Ensure you have 2+ hours of uninterrupted time'],
            [true, 'Close other applications and browser tabs'],
            [false, 'No phones, notes, or outside help during the test'],
            [false, 'No looking up answers or using AI tools'],
          ].map(([ok, text], i) => (
            <li key={i} className="flex items-start gap-2.5 text-ink-muted">
              {ok
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400" />
                : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />}
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => { setAcknowledged(e.target.checked); if (e.target.checked) setShowAckError(false); }}
            className="mt-0.5 h-5 w-5 rounded border-edge text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          <span className="text-sm text-ink-muted">
            I'll take this test under proper conditions and treat it like the real SAT.
          </span>
        </label>
        {showAckError && (
          <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-400">
            Please acknowledge the testing conditions before starting.
          </p>
        )}
      </Section>

      {/* Actions */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button variant="primary" size="lg" className="flex-1" onClick={handleStart} disabled={!acknowledged}>
          Start practice test <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="lg" onClick={() => navigate('/student/practice-tests')}>Cancel</Button>
      </div>
    </div>
  );
};

export default PracticeTestStartPage;
