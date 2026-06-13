/**
 * Mastery Check — a focused 5-question gate (1 easy / 2 medium / 2 hard) for one
 * worklist skill. Answers are collected then submitted together; the backend
 * grades and returns pass/fail + which bands were missed. No answers/explanations
 * are sent down, so this can't be gamed client-side.
 *
 * Arrives with the started check in router state (from the worklist). If state is
 * missing (e.g. refresh), it sends the student back to the plan.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button, MathHtml, Surface, useToast } from '../../components/ui';
import { AnswerChoices } from '../../components/test/AnswerChoice';
import { worklistService } from '../../services/worklistService';

const MasteryCheckPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { checkId } = useParams();
  const toast = useToast();

  const check = location.state?.check;
  const skillName = location.state?.skillName || 'this skill';

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});      // question_id -> {index} | {answer}
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // No check in state (direct nav / refresh) → back to the plan.
  useEffect(() => {
    if (!check || !check.questions?.length) {
      navigate('/student/study-plan', { replace: true });
    }
  }, [check, navigate]);

  if (!check || !check.questions?.length) return null;

  const questions = check.questions;
  const q = questions[idx];
  const answered = Object.keys(answers).length;
  const allAnswered = answered >= questions.length;

  const setAnswer = (val) => setAnswers((a) => ({ ...a, [q.id]: val }));

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await worklistService.submitCheck(checkId, answers);
      setResult(res.data);
    } catch (err) {
      toast?.error?.(err?.response?.data?.detail || 'Could not submit the check.');
      setSubmitting(false);
    }
  };

  // ---- Result screen ----
  if (result) {
    const passed = result.passed;
    const isBaseline = result.kind === 'baseline';
    const bandsMissed = result.bands_missed || {};
    const missedLabel = Object.keys(bandsMissed).length
      ? Object.entries(bandsMissed).map(([b, n]) =>
          `${n} ${({ E: 'easy', M: 'medium', H: 'hard' }[b] || b)}`).join(', ')
      : null;

    return (
      <div className="mx-auto max-w-lg py-10">
        <Surface className="rounded-2xl p-8 text-center">
          {isBaseline ? (
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-brand-500" />
          ) : passed ? (
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-accent-600 dark:text-accent-300" />
          ) : (
            <XCircle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          )}
          <h1 className="font-display text-2xl font-semibold text-ink-body">
            {isBaseline ? 'Baseline recorded' : passed ? 'Mastered!' : 'Not quite yet'}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            You scored <span className="font-semibold text-ink-body">{result.score}/{result.total}</span>
            {result.hard_correct != null && ` (${result.hard_correct}/2 hard)`}.
          </p>

          {!isBaseline && !passed && (
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              {missedLabel
                ? `You missed ${missedLabel}. Pass needs 4/5 with at least one hard right.`
                : 'Pass needs 4/5 with at least one hard question right.'}
              {result.item_status === 'needs_tutor'
                ? ' Your tutor will help with this one.'
                : ' Practice a bit more, then retake with fresh questions.'}
            </p>
          )}
          {passed && !isBaseline && (
            <p className="mt-3 text-sm text-accent-700 dark:text-accent-300">
              {skillName} cleared. Nice work.
            </p>
          )}

          <Button variant="primary" className="mt-6" onClick={() => navigate('/student/study-plan')}>
            Back to worklist <ArrowRight className="h-4 w-4" />
          </Button>
        </Surface>
      </div>
    );
  }

  // ---- Question screen ----
  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
            {check.kind === 'baseline' ? 'Baseline check' : 'Mastery check'} · {skillName}
          </p>
          <p className="text-sm text-ink-muted">Question {idx + 1} of {questions.length}</p>
        </div>
        <span className="text-xs tabular-nums text-ink-faint">{answered}/{questions.length} answered</span>
      </div>

      {/* progress dots */}
      <div className="mb-5 flex gap-1.5">
        {questions.map((qq, i) => (
          <button
            key={qq.id}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Go to question ${i + 1}`}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              answers[qq.id] ? 'bg-brand-500' : i === idx ? 'bg-brand-300' : 'bg-surface-muted'
            }`}
          />
        ))}
      </div>

      <Surface className="rounded-2xl p-6">
        <MathHtml html={q.prompt_html} className="prose-sm mb-5 text-ink-body" />
        <AnswerChoices
          choices={q.choices}
          answerType={q.answer_type}
          questionId={q.id}
          selectedIndex={q.answer_type === 'MCQ' ? answers[q.id]?.index ?? null : null}
          selectedAnswer={q.answer_type === 'SPR' ? answers[q.id]?.answer ?? '' : ''}
          onSelect={(i) => setAnswer({ index: i })}
          onAnswerChange={(val) => setAnswer({ answer: val })}
        />
      </Surface>

      <div className="mt-5 flex items-center justify-between">
        <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Previous
        </Button>
        {idx < questions.length - 1 ? (
          <Button variant="secondary" size="sm" onClick={() => setIdx((i) => i + 1)}>
            Next <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button variant="primary" loading={submitting} disabled={!allAnswered || submitting} onClick={submit}>
            Submit check
          </Button>
        )}
      </div>
      {!allAnswered && idx === questions.length - 1 && (
        <p className="mt-2 text-right text-xs text-ink-faint">Answer all {questions.length} questions to submit.</p>
      )}
    </div>
  );
};

export default MasteryCheckPage;
