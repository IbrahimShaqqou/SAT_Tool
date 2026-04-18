/**
 * Shared Assessment Results Page
 *
 * Used by: Intake Assessment, Diagnostic, Practice Tests
 * Renders a polished results view with:
 * - Big SAT score estimate
 * - Section scores (Math / R&W)
 * - Domain heatmap
 * - Worst skills with lesson + adaptive CTAs
 * - Full question review
 *
 * Props:
 *   results        {object}  - The full results object (from /full-results endpoint)
 *   title          {string}  - Page title e.g. "Intake Assessment Results"
 *   subtitle       {string}  - Optional subtitle
 *   onGoHome       {func}    - Callback for "Go to Dashboard" button
 *   isLoading      {bool}
 *   error          {string|null}
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, ChevronDown, ChevronUp,
  Clock, BookOpen, AlertTriangle,
  TrendingUp, Zap,
} from 'lucide-react';
import { Card, Button, LoadingSpinner } from '../../components/ui';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

// Heatmap color based on accuracy %
const heatColor = (accuracy) => {
  if (accuracy === null || accuracy === undefined) return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
  if (accuracy >= 75) return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300';
  if (accuracy >= 50) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300';
  return 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300';
};

const ScoreGauge = ({ score, low, high, label, max = 800, color = 'brand' }) => {
  const pct = score ? Math.round((score / max) * 100) : 0;
  const colorMap = {
    brand: 'bg-brand-600',
    violet: 'bg-violet-600',
  };
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</span>
        {score ? (
          <span className="text-sm text-gray-500 dark:text-gray-400">{low}–{high}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-2xl font-bold text-gray-900 dark:text-white w-14 text-right">
          {score ?? '–'}
        </div>
        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${colorMap[color]}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="text-xs text-gray-400 w-8">/{max}</div>
      </div>
    </div>
  );
};

export default function AssessmentResultsPage({
  results,
  title = 'Assessment Results',
  subtitle,
  onGoHome,
  isLoading = false,
  error = null,
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());

  const toggleQuestion = useCallback((index) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading your results..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error Loading Results</h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </Card>
      </div>
    );
  }

  if (!results) return null;

  const {
    score = {},
    questions_answered = 0,
    questions_correct = 0,
    time_seconds = 0,
    domain_breakdown = [],
    worst_skills = [],
    questions = [],
  } = results;

  const timeMinutes = Math.floor(time_seconds / 60);
  const correctQuestions = questions.filter(q => q.is_correct);
  const incorrectQuestions = questions.filter(q => !q.is_correct);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {subtitle && <p className="text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Big Score Hero ── */}
        <Card>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Total score */}
              <div className="text-center">
                {score.total ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Estimated SAT Score</p>
                    <div className="text-6xl font-extrabold text-gray-900 dark:text-white">
                      {score.total.toLocaleString()}
                    </div>
                    {score.range_low && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Range: {score.range_low}–{score.range_high}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Score</p>
                    <div className="text-5xl font-bold text-gray-900 dark:text-white">
                      {Math.round((questions_correct / (questions_answered || 1)) * 100)}%
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{questions_correct}/{questions_answered} correct</p>
                  </>
                )}
              </div>

              {/* Section scores */}
              {(score.math || score.reading_writing) ? (
                <div className="md:col-span-2 space-y-4 md:border-l md:border-gray-200 dark:md:border-gray-700 md:pl-8">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">Section Scores</p>
                  <ScoreGauge
                    label="Math"
                    score={score.math}
                    low={score.math_low}
                    high={score.math_high}
                    color="brand"
                  />
                  <ScoreGauge
                    label="Reading & Writing"
                    score={score.reading_writing}
                    low={score.rw_low}
                    high={score.rw_high}
                    color="violet"
                  />
                </div>
              ) : (
                <div className="md:col-span-2 flex items-center justify-center border-l border-gray-200 dark:border-gray-700">
                  <div className="text-center space-y-1">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 justify-center">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">{timeMinutes} min</span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {questions_answered} questions answered
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Stats row */}
            {score.total && (
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-6 text-sm text-gray-500 dark:text-gray-400">
                <span>{questions_answered} questions answered</span>
                <span>{questions_correct} correct</span>
                <span>{timeMinutes} minutes</span>
              </div>
            )}
          </div>
        </Card>

        {/* ── Worst Skills + What to Do Next ── */}
        {worst_skills.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <Card.Header>
                <Card.Title className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                  Focus Areas
                </Card.Title>
                <Card.Description>Skills that need the most attention</Card.Description>
              </Card.Header>
              <Card.Content>
                <div className="space-y-2">
                  {worst_skills.map((skill, i) => (
                    <div key={skill.skill_id} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-center font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{skill.skill_name || 'Unknown Skill'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {skill.correct}/{skill.total} correct · {skill.domain_code}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${heatColor(skill.accuracy)}`}>
                        {Math.round(skill.accuracy)}%
                      </span>
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <Card.Title>What to Do Next</Card.Title>
                <Card.Description>Recommended actions for each focus area</Card.Description>
              </Card.Header>
              <Card.Content>
                <div className="space-y-3">
                  {worst_skills.map((skill) => (
                    <div key={skill.skill_id} className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate min-w-0">
                        {skill.skill_name || 'Unknown'}
                      </p>
                      <div className="flex gap-2 flex-shrink-0">
                        {skill.lesson_id && (
                          <button
                            onClick={() => navigate(`/student/lessons/${skill.lesson_id}`)}
                            className="flex items-center gap-1 text-xs font-semibold bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            Study
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/student/adaptive?skill=${skill.skill_id}&autostart=true`)}
                          className="flex items-center gap-1 text-xs font-semibold bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          Practice
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>
          </div>
        )}

        {/* ── Domain Heatmap ── */}
        {domain_breakdown.length > 0 && (
          <Card>
            <Card.Header>
              <Card.Title>Domain Breakdown</Card.Title>
              <Card.Description>Accuracy by content domain</Card.Description>
            </Card.Header>
            <Card.Content>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {domain_breakdown.map((domain) => (
                  <div
                    key={domain.domain_id || domain.domain_code}
                    className={`rounded-xl p-3 ${heatColor(domain.accuracy)}`}
                  >
                    <div className="font-mono text-xs font-bold mb-1">{domain.domain_code}</div>
                    <div className="text-sm font-medium leading-tight mb-1">{domain.domain_name}</div>
                    <div className="text-xs opacity-75">
                      {domain.correct}/{domain.total} · {Math.round(domain.accuracy)}%
                    </div>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>
        )}

        {/* ── Tabs ── */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            {['overview', 'questions'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {tab === 'questions' ? `Question Review (${questions.length})` : 'Overview'}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <Card.Header>
                <Card.Title className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-5 w-5" />
                  Correct ({correctQuestions.length})
                </Card.Title>
              </Card.Header>
              <Card.Content>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {correctQuestions.map((q) => (
                    <div key={q.question_id} className="flex items-center gap-2 py-1.5 px-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300 w-8 flex-shrink-0">Q{q.order + 1}</span>
                      <span className="text-gray-500 dark:text-gray-400 truncate">{q.skill_name || q.domain_name}</span>
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <Card.Title className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <XCircle className="h-5 w-5" />
                  Incorrect ({incorrectQuestions.length})
                </Card.Title>
              </Card.Header>
              <Card.Content>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {incorrectQuestions.map((q) => (
                    <div
                      key={q.question_id}
                      className="flex items-center gap-2 py-1.5 px-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      onClick={() => {
                        setActiveTab('questions');
                        setExpandedQuestions(new Set([q.order]));
                        setTimeout(() => {
                          document.getElementById(`question-${q.order}`)?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                    >
                      <span className="font-medium text-gray-700 dark:text-gray-300 w-8 flex-shrink-0">Q{q.order + 1}</span>
                      <span className="text-gray-500 dark:text-gray-400 truncate flex-1">{q.skill_name || q.domain_name}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>
          </div>
        )}

        {/* ── Question Review Tab ── */}
        {activeTab === 'questions' && (
          <div className="space-y-3">
            {questions.map((q, index) => (
              <Card key={q.question_id} id={`question-${index}`}>
                <div
                  className={`p-4 cursor-pointer flex items-center justify-between rounded-t-lg ${
                    q.is_correct
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}
                  onClick={() => toggleQuestion(index)}
                >
                  <div className="flex items-center gap-3">
                    {q.is_correct
                      ? <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      : <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    }
                    <span className="font-medium text-gray-900 dark:text-white">Question {index + 1}</span>
                    {q.domain_code && (
                      <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                        {q.domain_code}
                      </span>
                    )}
                    {q.skill_name && (
                      <span className="text-sm text-gray-500 dark:text-gray-400 hidden md:inline">{q.skill_name}</span>
                    )}
                  </div>
                  {expandedQuestions.has(index)
                    ? <ChevronUp className="h-5 w-5 text-gray-500" />
                    : <ChevronDown className="h-5 w-5 text-gray-500" />
                  }
                </div>

                {expandedQuestions.has(index) && (
                  <div className="p-5 border-t border-gray-200 dark:border-gray-700">
                    {q.passage_html && (
                      <div
                        className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: q.passage_html }}
                      />
                    )}
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none question-content mb-4"
                      dangerouslySetInnerHTML={{ __html: q.prompt_html }}
                    />

                    {q.answer_type === 'MCQ' && q.choices && (
                      <div className="space-y-2 mb-4">
                        {q.choices.map((choice, ci) => {
                          const isStudent = q.student_answer?.index === ci;
                          const isCorrect = q.correct_answer?.index === ci;
                          return (
                            <div
                              key={ci}
                              className={`p-3 border rounded-lg flex items-start gap-3 ${
                                isCorrect
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500'
                                  : isStudent && !q.is_correct
                                  ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                              }`}
                            >
                              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-medium flex-shrink-0 ${
                                isCorrect ? 'bg-emerald-500 text-white' :
                                isStudent ? 'bg-red-500 text-white' :
                                'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}>
                                {CHOICE_LABELS[ci]}
                              </span>
                              <div
                                className="flex-1 prose prose-sm dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: choice.content }}
                              />
                              {isStudent && <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">Your answer</span>}
                              {isCorrect && <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-auto font-medium">Correct</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.answer_type === 'SPR' && (
                      <div className="mb-4 space-y-2">
                        <div className={`p-3 rounded-lg ${q.is_correct ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Your answer: </span>
                          <span className={q.is_correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>
                            {q.student_answer?.answer || '(no answer)'}
                          </span>
                        </div>
                        {!q.is_correct && (
                          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Correct answer: </span>
                            <span className="text-emerald-700 dark:text-emerald-300">
                              {q.correct_answer?.answers?.join(' or ') || q.correct_answer?.answer}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {q.explanation_html && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="font-medium text-blue-900 dark:text-blue-300">Explanation</span>
                        </div>
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"
                          dangerouslySetInnerHTML={{ __html: q.explanation_html }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* ── CTA ── */}
        <Card>
          <div className="p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Ready to improve?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-5">
              Start practicing your weak areas with questions tailored to your level.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="secondary"
                onClick={onGoHome || (() => navigate('/student/dashboard'))}
              >
                Go to Dashboard
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate('/student/adaptive')}
              >
                <Zap className="h-4 w-4 mr-1.5" />
                Start Adaptive Practice
              </Button>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
