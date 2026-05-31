/**
 * Student Assignment Results — Study Hall.
 * Big-number score, borderless per-question review with correct/incorrect
 * paired with icon + label (never color-only), collapsible explanations.
 * Tokens, dark mode, a11y. Renders inside AppLayout.
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import {
  Button, Skeleton, PageHeader, Section, StatBlock, StatusPill, AnimatedNumber, ProgressRing,
} from '../../components/ui';
import { assignmentService } from '../../services';
import { StepByStepExplanation } from '../../components/explanation';
import { checkSprAnswer } from '../../utils';

const formatAnswer = (answer, choices, answerType) => {
  if (!answer) return 'Not answered';
  if (answerType === 'MCQ') {
    const selectedIndex = answer.index;
    if (selectedIndex != null && choices && choices[selectedIndex]) {
      const letter = String.fromCharCode(65 + selectedIndex);
      return (
        <span className="flex items-start gap-2">
          <span className="font-semibold">{letter}.</span>
          <span className="question-content" dangerouslySetInnerHTML={{ __html: choices[selectedIndex].content }} />
        </span>
      );
    }
    return selectedIndex != null ? `Choice ${String.fromCharCode(65 + selectedIndex)}` : 'Not answered';
  }
  return answer.answer || 'No answer';
};

const QuestionResult = ({ question, index }) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([contentRef.current]).catch(() => {});
    }
  }, [question, showExplanation]);

  const isCorrect = (() => {
    if (!question.selected_answer) return false;
    if (question.answer_type === 'MCQ') return question.selected_answer.index === question.correct_answer?.index;
    return checkSprAnswer(question.selected_answer.answer, question.correct_answer?.answers || []);
  })();

  return (
    <li ref={contentRef} className="py-5 first:pt-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isCorrect
            ? <CheckCircle className="h-5 w-5 text-accent-600 dark:text-accent-400" />
            : <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
          <span className="text-sm font-semibold text-ink-body">Question {index + 1}</span>
        </div>
        <StatusPill tone={isCorrect ? 'good' : 'bad'} size="sm">{isCorrect ? 'Correct' : 'Incorrect'}</StatusPill>
      </div>

      {question.passage_html && (
        <div className="prose prose-sm mb-3 max-w-none rounded-lg border border-edge-subtle bg-surface-muted p-3 text-ink-muted question-content" dangerouslySetInnerHTML={{ __html: question.passage_html }} />
      )}
      <div className="prose mb-4 max-w-none text-ink-body question-content" dangerouslySetInnerHTML={{ __html: question.prompt_html }} />

      <div className="mb-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Your answer</p>
        <div className={`rounded-lg border p-3 text-sm ${isCorrect ? 'border-accent-200 bg-accent-50 text-accent-800 dark:border-accent-800/40 dark:bg-accent-900/20 dark:text-accent-200' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-200'}`}>
          {formatAnswer(question.selected_answer, question.choices, question.answer_type)}
        </div>
      </div>

      {!isCorrect && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Correct answer</p>
          <div className="rounded-lg border border-accent-200 bg-accent-50 p-3 text-sm text-accent-800 dark:border-accent-800/40 dark:bg-accent-900/20 dark:text-accent-200">
            {question.answer_type === 'MCQ' ? (() => {
              const ci = question.correct_answer?.index;
              if (ci == null) return <span>See explanation</span>;
              const choice = question.choices?.[ci];
              return (
                <span className="flex items-start gap-2">
                  <span className="font-semibold">{String.fromCharCode(65 + ci)}.</span>
                  {choice && <span className="question-content" dangerouslySetInnerHTML={{ __html: choice.content }} />}
                </span>
              );
            })() : (() => {
              const answers = question.correct_answer?.answers || [];
              if (!answers.length || answers[0] === '*') return <span>See explanation</span>;
              return <span>{answers.join(' or ')}</span>;
            })()}
          </div>
        </div>
      )}

      {(question.explanation_html || question.explanation_available) && (
        <div className="mt-3 border-t border-edge-subtle pt-3">
          <button
            onClick={() => setShowExplanation((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800 dark:text-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-expanded={showExplanation}
          >
            {showExplanation ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showExplanation ? 'Hide explanation' : (question.explanation_available ? 'Show step-by-step' : 'Show explanation')}
          </button>
          {showExplanation && question.explanation_available && (
            <StepByStepExplanation
              questionId={String(question.question_id)}
              passageHtml={question.passage_html || null}
              promptHtml={question.prompt_html || ''}
              choices={question.choices || []}
            />
          )}
          {showExplanation && !question.explanation_available && question.explanation_html && (
            <div className="prose prose-sm mt-3 max-w-none rounded-lg border border-edge-subtle bg-surface-muted p-4 text-ink-muted question-content" dangerouslySetInnerHTML={{ __html: question.explanation_html }} />
          )}
        </div>
      )}
    </li>
  );
};

const ResultsPage = () => {
  const { id } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const [assignmentRes, questionsRes] = await Promise.all([
          assignmentService.getAssignment(id),
          assignmentService.getAssignmentQuestions(id),
        ]);
        setAssignment(assignmentRes.data);
        setQuestions(questionsRes.data.questions || []);
      } catch (error) {
        console.error('Failed to fetch results:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchResults();
  }, [id]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-6 h-32 w-full" rounded="rounded-2xl" />
        <div className="mt-6 space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" rounded="rounded-xl" />)}</div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-ink-subtle">Results not found.</p>
        <Link to="/student/assignments"><Button variant="secondary" className="mt-4"><ArrowLeft className="h-4 w-4" /> Back to assignments</Button></Link>
      </div>
    );
  }

  const score = assignment.score_percentage || 0;
  const correct = assignment.questions_correct || 0;
  const total = assignment.total_questions || 0;

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <Link to="/student/assignments" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-subtle transition-colors hover:text-ink-body">
        <ArrowLeft className="h-4 w-4" /> Assignments
      </Link>
      <PageHeader eyebrow="Results" title={assignment.title} />

      {/* Score hero */}
      <div className="flex items-center justify-between gap-6 border-y border-edge py-7">
        <div>
          <div className="flex items-end gap-2">
            <AnimatedNumber value={Math.round(score)} suffix="%" className="font-display text-[4.5rem] leading-[0.86] font-semibold tracking-tight text-ink-body" />
          </div>
          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-ink-muted"><CheckCircle className="h-4 w-4 text-accent-600 dark:text-accent-400" /> {correct} correct</span>
            <span className="flex items-center gap-1.5 text-ink-muted"><XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" /> {total - correct} incorrect</span>
          </div>
        </div>
        <ProgressRing value={score} size={104} stroke={9} label={`Score ${Math.round(score)} percent`}>
          <StatusPill value={score} />
        </ProgressRing>
      </div>

      {/* Question review */}
      <Section className="mt-10" title="Question review" hint={`${total} questions`}>
        <ul className="divide-y divide-edge-subtle">
          {questions.map((q, i) => <QuestionResult key={q.question_id} question={q} index={i} />)}
        </ul>
      </Section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link to="/student/adaptive" className="flex-1"><Button variant="primary" className="w-full">Practice more <ArrowRight className="h-4 w-4" /></Button></Link>
        <Link to="/student/assignments" className="flex-1"><Button variant="secondary" className="w-full">Back to assignments</Button></Link>
      </div>
    </div>
  );
};

export default ResultsPage;
