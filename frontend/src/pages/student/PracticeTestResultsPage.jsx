/**
 * Practice Test Results — Study Hall.
 * Two tabs:
 *   Overview — total + section scores, and the skills that need practice.
 *   Review   — question-by-question, with your answer vs. the correct one.
 * Tokens, dark mode, a11y. Renders inside AppLayout.
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, CheckCircle2, XCircle, Target, ListChecks,
  Map as MapIcon, BookOpen, Dumbbell, TrendingUp, TrendingDown, Minus, Upload,
} from 'lucide-react';
import { getTestResults, getTestReview, getStudyPlan } from '../../services/practiceTestApi';
import {
  Button, Skeleton, PageHeader, Section, StatBlock, StatusPill,
  AnimatedNumber, ProgressRing, Surface, MathHtml,
} from '../../components/ui';
import { SkillMap } from '../../components/common';

const SCORE_METHOD_LABEL = {
  official: { text: 'Official College Board score', tone: 'text-accent-600 dark:text-accent-300' },
  estimate: { text: 'Estimated from official score data', tone: 'text-ink-muted' },
  model: { text: 'Estimated score', tone: 'text-ink-muted' },
};

const MethodNote = ({ method, low, high }) => {
  if (!method) return null;
  const meta = SCORE_METHOD_LABEL[method] || SCORE_METHOD_LABEL.model;
  const showRange = method !== 'official' && low != null && high != null && low !== high;
  return (
    <p className={`mt-1 text-xs ${meta.tone}`}>
      {meta.text}
      {showRange && <span className="text-ink-faint"> · likely {low}–{high}</span>}
    </p>
  );
};

const SectionScore = ({ label, data }) => {
  const pct = data.percentage;
  return (
    <Section title={label}>
      <div className="flex items-end justify-between">
        <div>
          <StatBlock value={data.score} label="section score" size="lg" />
          <MethodNote method={data.score_method} low={data.score_low} high={data.score_high} />
        </div>
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

const TABS = [
  { value: 'overview', label: 'Overview', icon: Target },
  { value: 'plan', label: 'Study plan', icon: MapIcon },
  { value: 'review', label: 'Question review', icon: ListChecks },
];

const ANSWER_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const PracticeTestResultsPage = ({
  sessionId: sessionIdProp,         // when provided, render in embedded/tutor mode
  isTutorView = false,
  fetchResults,                     // optional overrides (e.g. tutor-scoped endpoints)
  fetchReview,
  backTo,
  backLabel,
}) => {
  const params = useParams();
  const sessionId = sessionIdProp || params.sessionId;
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [review, setReview] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return ['overview', 'plan', 'review'].includes(t) ? t : 'overview';
  });
  const [filter, setFilter] = useState('all'); // all | incorrect | correct
  const [planError, setPlanError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const getRes = fetchResults || getTestResults;
        const getRev = fetchReview || getTestReview;
        const [res, rev, pln] = await Promise.all([
          getRes(sessionId),
          Promise.resolve(getRev(sessionId)).catch(() => null),
          getStudyPlan(sessionId).catch((e) => {
            setPlanError(e?.response?.data?.detail || null);
            return null;
          }),
        ]);
        setResults(res);
        setReview(rev);
        setPlan(pln);
        setError(null);
      } catch (err) {
        console.error('Error loading results:', err);
        setError('Failed to load test results');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId, fetchResults, fetchReview]);

  const filteredQuestions = useMemo(() => {
    const qs = review?.questions || [];
    if (filter === 'incorrect') return qs.filter((q) => !q.is_correct);
    if (filter === 'correct') return qs.filter((q) => q.is_correct);
    return qs;
  }, [review, filter]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-48 w-full" rounded="rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="mb-4 text-rose-600 dark:text-rose-400">{error}</p>
        <Button variant="secondary" onClick={() => navigate(backTo || '/student/practice-tests')}>
          <ArrowLeft className="h-4 w-4" /> {backLabel || 'Back to practice tests'}
        </Button>
      </div>
    );
  }

  if (!results) return null;

  const scorePct = Math.min(100, Math.max(0, ((results.total_score - 400) / 1200) * 100));
  const completedStr = results.completed_at
    ? new Date(results.completed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : undefined;

  return (
    <div className={isTutorView ? 'pb-10' : 'mx-auto max-w-4xl pb-10'}>
      {backTo && (
        <button
          onClick={() => navigate(backTo)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-subtle transition-colors hover:text-ink-body"
        >
          <ArrowLeft className="h-4 w-4" /> {backLabel || 'Back'}
        </button>
      )}
      <PageHeader
        eyebrow="Score report"
        title={results.test_name}
        subtitle={completedStr}
      />

      {/* Tabs */}
      <div className="mb-8 flex gap-1 border-b border-edge" role="tablist">
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.value)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px ${
                active
                  ? 'border-brand-500 text-brand-700 dark:text-brand-300'
                  : 'border-transparent text-ink-subtle hover:text-ink-body'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' ? (
        <>
          {/* Big-number total score hero */}
          <div className="flex flex-col items-start gap-8 border-b border-edge pb-8 sm:flex-row sm:items-center sm:justify-between">
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
              <MethodNote method={results.score_method} low={results.total_score_low} high={results.total_score_high} />
            </div>
            <ProgressRing value={scorePct} size={128} stroke={10} label={`Total score ${results.total_score} out of 1600`}>
              <div className="text-center">
                <AnimatedNumber value={results.total_score} className="font-display text-2xl font-semibold text-ink-body" />
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">/ 1600</p>
              </div>
            </ProgressRing>
          </div>

          {/* Since your last test — delta strip */}
          {plan?.deltas && (
            <DeltaStrip deltas={plan.deltas} />
          )}

          {/* What to do next — funnels to the plan */}
          <div className="mt-8">
            <Button variant="primary" onClick={() => setTab('plan')}>
              {isTutorView ? "See this student's plan" : 'What to do next'} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Section scores */}
          <div className="mt-10 grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
            <SectionScore label="Math" data={results.math} />
            <SectionScore label="Reading & Writing" data={results.reading_writing} />
          </div>

          {/* Skill map — every skill grouped by domain, weakest first */}
          <Section
            className="mt-12"
            title="Skill map"
            hint="Accuracy by skill — weakest first"
            icon={Target}
          >
            <SkillMap
              skills={review?.skills || []}
              onPractice={isTutorView ? undefined : (s) =>
                navigate(`/student/adaptive?skill=${s.skill_id}&autostart=true`)}
            />
            <div className="mt-8">
              <Button variant="secondary" onClick={() => setTab('review')}>
                {isTutorView ? 'See question-by-question' : 'Review your answers'} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Section>
        </>
      ) : tab === 'plan' ? (
        <StudyPlanView plan={plan} planError={planError} isTutorView={isTutorView} navigate={navigate} />
      ) : (
        /* ── Question-by-question review ─────────────────────────── */
        <div>
          {!review ? (
            <p className="rounded-xl border border-dashed border-edge px-4 py-10 text-center text-sm text-ink-subtle">
              Question-level review isn’t available for this test.
            </p>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {[
                  { v: 'all', label: `All (${review.questions.length})` },
                  { v: 'incorrect', label: `Incorrect (${review.questions.filter((q) => !q.is_correct).length})` },
                  { v: 'correct', label: `Correct (${review.questions.filter((q) => q.is_correct).length})` },
                ].map((f) => (
                  <button
                    key={f.v}
                    onClick={() => setFilter(f.v)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      filter === f.v
                        ? 'bg-brand-500 text-white'
                        : 'bg-surface-muted text-ink-subtle hover:text-ink-body'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {filteredQuestions.map((q) => (
                  <ReviewCard key={q.number} q={q} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// "Since your last test" — score change + a few notable skill movements.
const DeltaStrip = ({ deltas }) => {
  const sc = deltas.score_change;
  const movers = (deltas.skills || [])
    .filter((s) => s.direction !== 'flat')
    .sort((a, b) => (b.accuracy - b.prev_accuracy) - (a.accuracy - a.prev_accuracy));
  const ups = movers.filter((s) => s.direction === 'up').slice(0, 2);
  const downs = movers.filter((s) => s.direction === 'down').slice(-2);
  const ScoreIcon = sc > 0 ? TrendingUp : sc < 0 ? TrendingDown : Minus;
  const scoreTone = sc > 0 ? 'text-accent-700 dark:text-accent-300'
    : sc < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-ink-muted';
  return (
    <div className="mt-8 rounded-2xl bg-surface-muted/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Since your last test{deltas.prev_test_number ? ` (PT${deltas.prev_test_number})` : ''}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-3">
        {sc != null && (
          <div className="flex items-center gap-2">
            <ScoreIcon className={`h-5 w-5 ${scoreTone}`} />
            <span className={`font-display text-2xl font-semibold tabular-nums ${scoreTone}`}>
              {sc > 0 ? '+' : ''}{sc}
            </span>
            <span className="text-sm text-ink-subtle">total score</span>
          </div>
        )}
        {[...ups, ...downs].map((s) => {
          const up = s.direction === 'up';
          return (
            <span key={s.skill_id} className="inline-flex items-center gap-1.5 text-sm">
              {up ? <TrendingUp className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                  : <TrendingDown className="h-4 w-4 text-rose-500" />}
              <span className="text-ink-body">{s.name}</span>
              <span className="text-ink-subtle tabular-nums">
                {Math.round(s.prev_accuracy)}→{Math.round(s.accuracy)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

// The coaching plan: focus skills (learn → practice), also-review, next test.
const StudyPlanView = ({ plan, planError, isTutorView, navigate }) => {
  if (!plan) {
    return (
      <div className="rounded-xl border border-dashed border-edge px-4 py-10 text-center">
        <p className="text-sm text-ink-subtle">
          {planError || 'No plan for this test yet. Re-import it to generate one.'}
        </p>
        {!isTutorView && (
          <Button variant="secondary" size="sm" className="mt-4"
            onClick={() => navigate('/student/practice-tests')}>
            <Upload className="mr-1.5 h-4 w-4" /> Go to import
          </Button>
        )}
      </div>
    );
  }
  const focus = plan.focus_skills || [];
  const also = plan.also_review || [];

  return (
    <div className="space-y-10">
      {/* Focus skills */}
      <Section title="Focus areas" hint="Your weakest skills on this test — start here" icon={Target}>
        {focus.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-edge px-4 py-6 text-sm text-ink-muted">
            <CheckCircle2 className="h-5 w-5 text-accent-500" />
            Nothing fell below 70% — strong work. Keep practicing to stay sharp.
          </div>
        ) : (
          <ol className="space-y-3">
            {focus.map((s, i) => (
              <li key={s.skill_id ?? i}>
                <Surface className="rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-xs font-bold text-brand-700 dark:text-brand-300">
                          {i + 1}
                        </span>
                        <span className="truncate font-medium text-ink-body">{s.name}</span>
                      </div>
                      <p className="mt-1 pl-8 text-xs text-ink-subtle">
                        {s.domain} · {s.correct}/{s.total} correct
                      </p>
                    </div>
                    <StatusPill value={s.accuracy} size="sm" />
                  </div>
                  {!isTutorView && (
                    <div className="mt-3 flex flex-wrap gap-2 pl-8">
                      {s.lesson_id && (
                        <Button variant="secondary" size="sm"
                          onClick={() => navigate(`/student/lessons/${s.lesson_id}`)}>
                          <BookOpen className="mr-1.5 h-4 w-4" /> Learn
                        </Button>
                      )}
                      {s.skill_id && (
                        <Button variant="primary" size="sm"
                          onClick={() => navigate(`/student/adaptive?skill=${s.skill_id}&autostart=true`)}>
                          <Dumbbell className="mr-1.5 h-4 w-4" /> Practice
                        </Button>
                      )}
                    </div>
                  )}
                  {isTutorView && (
                    <p className="mt-2 pl-8 text-xs text-ink-faint">
                      {s.lesson_id ? 'Lesson available · ' : 'No lesson yet · '}adaptive practice ready
                    </p>
                  )}
                </Surface>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* Also worth reviewing */}
      {also.length > 0 && (
        <Section title="Also worth reviewing" hint={`${also.length} more skills under 70%`}>
          <ul className="flex flex-wrap gap-2">
            {also.map((s, i) => (
              <li key={s.skill_id ?? i}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs text-ink-muted">
                <span className="text-ink-body">{s.name}</span>
                <span className="tabular-nums text-ink-faint">{Math.round(s.accuracy)}%</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Next test */}
      <Section title="Then take your next test" icon={Upload}>
        <Surface glow="brand" className="rounded-2xl p-5">
          {plan.recommended_next_test ? (
            <>
              <p className="font-display text-xl font-semibold text-ink-body">
                Practice Test {plan.recommended_next_test}
              </p>
              <p className="mt-1.5 max-w-prose text-sm text-ink-muted">{plan.next_test_reason}</p>
              {!isTutorView && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="primary"
                    onClick={() => window.open('https://bluebook.collegeboard.org', '_blank')}>
                    Get Bluebook <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" onClick={() => navigate('/student/practice-tests')}>
                    Import when done
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-muted">{plan.next_test_reason}</p>
          )}
        </Surface>
      </Section>
    </div>
  );
};

const ReviewCard = ({ q }) => {
  const isMcq = q.answer_type === 'MCQ';
  const correctLetter = q.correct_index != null ? ANSWER_LETTERS[q.correct_index] : null;

  return (
    <Surface className="rounded-2xl p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-xs font-semibold text-ink-body">
            {q.number}
          </span>
          {q.is_correct ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-accent-600 dark:text-accent-300">
              <CheckCircle2 className="h-4 w-4" /> Correct
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-rose-600 dark:text-rose-400">
              <XCircle className="h-4 w-4" /> Incorrect
            </span>
          )}
        </div>
        <span className="truncate text-xs text-ink-subtle">
          {q.skill || q.domain || (q.subject_area === 'math' ? 'Math' : 'Reading & Writing')}
        </span>
      </div>

      {/* Prompt */}
      <MathHtml html={q.prompt_html} className="prose prose-sm max-w-none text-ink-body dark:prose-invert [&_p]:my-2" />

      {/* Choices (MCQ) */}
      {isMcq && q.choices.length > 0 && (
        <ul className="mt-4 space-y-2">
          {q.choices.map((choice, i) => {
            const letter = ANSWER_LETTERS[i];
            const isCorrect = i === q.correct_index;
            const isYours = q.your_answer === letter;
            const tone = isCorrect
              ? 'border-accent-400 bg-accent-50 dark:bg-accent-950/30'
              : isYours
                ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30'
                : 'border-edge';
            return (
              <li key={i} className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${tone}`}>
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-ink-body">
                  {letter}
                </span>
                <MathHtml html={choice} className="prose prose-sm max-w-none text-ink-body dark:prose-invert [&_p]:my-0" />
                <span className="ml-auto shrink-0 self-center text-[11px] font-medium">
                  {isCorrect && <span className="text-accent-600 dark:text-accent-300">Correct</span>}
                  {!isCorrect && isYours && <span className="text-rose-600 dark:text-rose-400">Your answer</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* SPR */}
      {!isMcq && (
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-faint">Your answer</p>
            <p className={`font-medium ${q.is_correct ? 'text-accent-600 dark:text-accent-300' : 'text-rose-600 dark:text-rose-400'}`}>
              {q.your_answer ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-faint">Correct answer</p>
            <p className="font-medium text-ink-body">{q.correct_answers.join(', ') || '—'}</p>
          </div>
        </div>
      )}

      {isMcq && q.your_answer == null && (
        <p className="mt-3 text-xs text-ink-subtle">You left this blank.{correctLetter ? ` Correct answer: ${correctLetter}.` : ''}</p>
      )}

      {/* Explanation */}
      {q.explanation_html && (
        <details className="mt-4 rounded-xl bg-surface-muted/60 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-body">Explanation</summary>
          <MathHtml html={q.explanation_html} className="prose prose-sm mt-3 max-w-none text-ink-muted dark:prose-invert" />
        </details>
      )}
    </Surface>
  );
};

export default PracticeTestResultsPage;
