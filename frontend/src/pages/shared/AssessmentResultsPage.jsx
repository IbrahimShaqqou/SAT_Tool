/**
 * Shared Assessment Results Page
 *
 * Used by: Intake Assessment, Diagnostic, Practice Tests
 * Renders a results view focused on identifying skills to work on:
 * - Accuracy summary (overall + per section)
 * - Full skill breakdown grouped by Math / Reading & Writing
 * - Domain heatmap
 * - Question review with expandable details
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
  Clock, BookOpen, AlertTriangle, Target,
  TrendingUp, Zap, BarChart3,
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

// Accuracy badge color
const accuracyBadge = (accuracy) => {
  if (accuracy >= 75) return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
  if (accuracy >= 50) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300';
  return 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300';
};

// Accuracy ring (circular progress)
const AccuracyRing = ({ percent, size = 120, stroke = 10, label }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent >= 75 ? '#10b981' : percent >= 50 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor"
          className="text-gray-200 dark:text-gray-700"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-3xl font-bold text-gray-900 dark:text-white">{Math.round(percent)}%</span>
      </div>
      {label && <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-2">{label}</span>}
    </div>
  );
};

// Section accuracy bar
const SectionBar = ({ label, correct, total }) => {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">{correct}/{total} ({pct}%)</span>
      </div>
      <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// Skill row
const SkillRow = ({ skill, rank, navigate }) => (
  <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
    {rank !== undefined && (
      <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-center font-bold flex-shrink-0">
        {rank}
      </span>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{skill.skill_name || 'Unknown Skill'}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {skill.correct}/{skill.total} correct
        {skill.domain_code && <> &middot; {skill.domain_code}</>}
      </p>
    </div>
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${accuracyBadge(skill.accuracy)}`}>
      {Math.round(skill.accuracy)}%
    </span>
    <div className="flex gap-1.5 flex-shrink-0">
      {skill.lesson_id && (
        <button
          onClick={() => navigate(`/student/lessons/${skill.lesson_id}`)}
          className="flex items-center gap-1 text-xs font-semibold bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 px-2 py-1.5 rounded-lg transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Study
        </button>
      )}
      <button
        onClick={() => navigate(`/student/adaptive?skill=${skill.skill_id}&autostart=true`)}
        className="flex items-center gap-1 text-xs font-semibold bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 px-2 py-1.5 rounded-lg transition-colors"
      >
        <Zap className="h-3.5 w-3.5" />
        Practice
      </button>
    </div>
  </div>
);

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
    questions_answered = 0,
    questions_correct = 0,
    time_seconds = 0,
    section_accuracy = [],
    domain_breakdown = [],
    all_skills = [],
    worst_skills = [],
    questions = [],
  } = results;

  const timeMinutes = Math.floor(time_seconds / 60);
  const overallAccuracy = questions_answered > 0 ? (questions_correct / questions_answered) * 100 : 0;
  const correctQuestions = questions.filter(q => q.is_correct);
  const incorrectQuestions = questions.filter(q => !q.is_correct);

  // Group skills by section for the breakdown
  const mathSkills = all_skills.filter(s => s.section === 'math');
  const rwSkills = all_skills.filter(s => s.section === 'reading_writing');

  const mathSection = section_accuracy.find(s => s.section === 'math');
  const rwSection = section_accuracy.find(s => s.section === 'reading_writing');

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

        {/* ── Accuracy Summary ── */}
        <Card>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              {/* Overall accuracy ring */}
              <div className="flex justify-center relative">
                <AccuracyRing percent={overallAccuracy} />
              </div>

              {/* Section bars + stats */}
              <div className="md:col-span-2 space-y-5 md:border-l md:border-gray-200 dark:md:border-gray-700 md:pl-8">
                {mathSection && (
                  <SectionBar label="Math" correct={mathSection.correct} total={mathSection.total} />
                )}
                {rwSection && (
                  <SectionBar label="Reading & Writing" correct={rwSection.correct} total={rwSection.total} />
                )}

                <div className="flex flex-wrap gap-6 text-sm text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="flex items-center gap-1.5">
                    <Target className="h-4 w-4" />
                    {questions_correct}/{questions_answered} correct
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {timeMinutes} min
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Focus Areas (worst 5) ── */}
        {worst_skills.length > 0 && (
          <Card>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-500" />
                Focus Areas
              </Card.Title>
              <Card.Description>Skills that need the most work — start here for the biggest improvements</Card.Description>
            </Card.Header>
            <Card.Content>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {worst_skills.map((skill, i) => (
                  <SkillRow key={skill.skill_id} skill={skill} rank={i + 1} navigate={navigate} />
                ))}
              </div>
            </Card.Content>
          </Card>
        )}

        {/* ── Full Skill Breakdown by Section ── */}
        {all_skills.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Math skills */}
            {mathSkills.length > 0 && (
              <Card>
                <Card.Header>
                  <Card.Title className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-brand-500" />
                    Math Skills
                  </Card.Title>
                  <Card.Description>
                    {mathSection ? `${mathSection.correct}/${mathSection.total} correct (${mathSection.accuracy}%)` : ''}
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {mathSkills.map((skill) => (
                      <SkillRow key={skill.skill_id} skill={skill} navigate={navigate} />
                    ))}
                  </div>
                </Card.Content>
              </Card>
            )}

            {/* R&W skills */}
            {rwSkills.length > 0 && (
              <Card>
                <Card.Header>
                  <Card.Title className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-violet-500" />
                    Reading & Writing Skills
                  </Card.Title>
                  <Card.Description>
                    {rwSection ? `${rwSection.correct}/${rwSection.total} correct (${rwSection.accuracy}%)` : ''}
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rwSkills.map((skill) => (
                      <SkillRow key={skill.skill_id} skill={skill} navigate={navigate} />
                    ))}
                  </div>
                </Card.Content>
              </Card>
            )}
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
                      {domain.correct}/{domain.total} &middot; {Math.round(domain.accuracy)}%
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
