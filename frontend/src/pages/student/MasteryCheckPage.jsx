/**
 * Mastery Check — a focused 5-question gate (1 easy / 2 medium / 2 hard) for one
 * worklist skill. Uses the same test layout as the Question Bank / assignments:
 * a SplitPane for reading passages, the standard header toolbar (Draw / Reference
 * / Calculator), and the shared QuestionDisplay + AnswerChoices.
 *
 * Answers are collected then submitted together; the backend grades and returns
 * pass/fail + which bands were missed (no answers/explanations are sent down, so
 * it can't be gamed client-side).
 *
 * Arrives with the started check in router state (from the worklist). If state is
 * missing (e.g. refresh), it sends the student back to the plan.
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, ArrowRight, ArrowLeft, Pencil, FileText, Calculator } from 'lucide-react';
import { Button, Surface, useToast } from '../../components/ui';
import {
  QuestionDisplay, AnswerChoices, SplitPane, DesmosCalculator,
  ReferenceSheet, DrawingCanvas, HighlightableText,
} from '../../components/test';
import { splitRWPrompt } from '../../utils';
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

  // Tools
  const [showCalculator, setShowCalculator] = useState(false);
  const [showReferenceSheet, setShowReferenceSheet] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // No check in state (direct nav / refresh) → back to the plan.
  useEffect(() => {
    if (!check || !check.questions?.length) {
      navigate('/student/study-plan', { replace: true });
    }
  }, [check, navigate]);

  const questions = check?.questions || [];
  const q = questions[idx];
  const subjectArea = q?.subject_area || 'math';

  // R/W questions ship passage + question concatenated; split them for SplitPane.
  const { passageHtml, questionHtml } = useMemo(
    () => splitRWPrompt({
      promptHtml: q?.prompt_html || '',
      passageHtml: q?.passage_html || null,
      subjectArea,
    }),
    [q, subjectArea]
  );
  const hasPassage = !!passageHtml;

  if (!check || !check.questions?.length) return null;

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

  // ---- Question screen (canonical test layout) ----
  const toolBtn = (active, onClick, Icon, label) => (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        active ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-surface-card'
      }`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );

  const questionPanel = (
    <div className={`bg-surface-card pb-24 ${hasPassage ? 'h-full flex flex-col' : ''}`}>
      <div className={hasPassage ? 'flex-1 overflow-y-auto' : ''}>
        <QuestionDisplay
          questionNumber={idx + 1}
          totalQuestions={questions.length}
          questionHtml={questionHtml || q.prompt_html || ''}
          stimulusHtml={null}
          questionId={q.id}
          hideMarkForReview
          onReport={() => {}}
        />
        <div className="px-6 pb-4">
          <AnswerChoices
            choices={q.choices || []}
            answerType={q.answer_type || 'MCQ'}
            questionId={q.id}
            selectedIndex={q.answer_type === 'MCQ' ? (answers[q.id]?.index ?? undefined) : undefined}
            selectedAnswer={q.answer_type === 'SPR' ? (answers[q.id]?.answer ?? '') : undefined}
            onSelect={(i) => setAnswer({ index: i })}
            onAnswerChange={(val) => setAnswer({ answer: val })}
          />
        </div>
      </div>
    </div>
  );

  const passagePanel = hasPassage ? (
    <div className="h-full overflow-auto p-6 bg-surface-card">
      <HighlightableText
        key={`passage-${q.id}`}
        html={passageHtml}
        questionId={`passage-${q.id}`}
        className="prose-sm text-ink-body"
      />
    </div>
  ) : null;

  return (
    <div className="h-screen flex flex-col bg-surface-card -m-4 lg:-m-6">
      {/* Header — matches Question Bank / assignments */}
      <header className="sticky top-0 z-30 h-14 bg-surface-muted border-b border-edge flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/student/study-plan')}
            aria-label="Back to worklist"
            className="p-2 hover:bg-surface-card rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <ArrowLeft className="h-5 w-5 text-ink-muted" />
          </button>
          <div>
            <span className="text-sm font-medium text-ink-body">
              {check.kind === 'baseline' ? 'Baseline check' : 'Mastery check'}
            </span>
            <span className="text-xs text-ink-subtle ml-2">{skillName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-subtle">Question</span>
          <span className="font-semibold text-ink-body">{idx + 1} of {questions.length}</span>
        </div>

        <div className="flex items-center gap-2">
          {toolBtn(isDrawing, () => setIsDrawing((d) => !d), Pencil, isDrawing ? 'Stop drawing' : 'Draw')}
          {subjectArea === 'math' && (
            <>
              {toolBtn(showReferenceSheet, () => setShowReferenceSheet((s) => !s), FileText, 'Reference Sheet')}
              {toolBtn(showCalculator, () => setShowCalculator((s) => !s), Calculator, 'Calculator')}
            </>
          )}
        </div>
      </header>

      {/* Progress dots */}
      <div className="flex gap-1.5 px-6 py-2 bg-surface-card border-b border-edge-subtle">
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

      {/* Main content — shifts when the calculator is open */}
      <div className={`flex-1 transition-all duration-300 bg-surface-card ${showCalculator ? 'mr-[440px]' : ''} ${hasPassage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {hasPassage ? (
          <SplitPane left={passagePanel} right={questionPanel} defaultSplit={50} minLeft={25} minRight={35} />
        ) : (
          <div className="max-w-4xl mx-auto px-6">{questionPanel}</div>
        )}
      </div>

      {/* Overlays */}
      <DesmosCalculator
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        initialPosition={{ x: window.innerWidth - 450, y: 80 }}
      />
      <ReferenceSheet
        isOpen={showReferenceSheet}
        onClose={() => setShowReferenceSheet(false)}
        initialPosition={{ x: 100, y: 80 }}
      />
      <DrawingCanvas isActive={isDrawing} questionId={q?.id ?? idx} />

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 lg:left-[60px] right-0 z-50 flex items-center justify-between px-6 py-3 border-t border-edge bg-surface-muted">
        <Button variant="secondary" onClick={() => setIdx((i) => i - 1)} disabled={idx === 0} className="min-w-[100px]">
          Previous
        </Button>
        <span className="text-xs tabular-nums text-ink-faint">{answered}/{questions.length} answered</span>
        {idx < questions.length - 1 ? (
          <Button variant="primary" onClick={() => setIdx((i) => i + 1)} className="min-w-[100px]">
            Next
          </Button>
        ) : (
          <Button variant="primary" loading={submitting} disabled={!allAnswered || submitting} onClick={submit} className="min-w-[120px]">
            Submit check
          </Button>
        )}
      </div>
    </div>
  );
};

export default MasteryCheckPage;
