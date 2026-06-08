/**
 * Adaptive Practice Page - IRT-Based Intelligent Practice
 * Features real-time ability tracking and adaptive question selection
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Brain,
  Target,
  ChevronDown,
  ChevronUp,
  Zap,
  BarChart3,
  ArrowLeft,
  BookOpen,
  Pencil,
} from 'lucide-react';
import {
  Card,
  Button,
  LoadingSpinner,
  ThetaBar,
  Modal,
  PageHeader,
  Section,
} from '../../components/ui';
import { AnswerChoices, DesmosCalculator, ReferenceSheet, DrawingCanvas, HighlightableText } from '../../components/test';
import { adaptiveService, taxonomyService } from '../../services';
import { StepByStepExplanation } from '../../components/explanation';
import ReportModal from '../../components/test/ReportModal';

/**
 * Check if passage content is already contained in the prompt (to avoid duplicates)
 * Strips HTML and compares first 50 chars of text content
 */
const isPassageInPrompt = (passageHtml, promptHtml) => {
  if (!passageHtml || !promptHtml) return false;

  // Strip HTML tags and get plain text
  const stripHtml = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  const passageText = stripHtml(passageHtml);
  const promptText = stripHtml(promptHtml);

  // Check if significant portion of passage appears in prompt (first 50 chars)
  const passageStart = passageText.substring(0, 50);
  return passageStart.length > 10 && promptText.includes(passageStart);
};

// Skill Selection Component
const SkillSelector = ({ skills, selectedSkills, onToggle, onSelectAll, onClearAll }) => {
  const [expandedDomains, setExpandedDomains] = useState(new Set());

  // Group skills by domain
  const groupedSkills = skills.reduce((acc, skill) => {
    const domain = skill.domain_name || 'Other';
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(skill);
    return acc;
  }, {});

  const toggleDomain = (domain) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">
          {selectedSkills.length} skill{selectedSkills.length !== 1 ? 's' : ''} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="rounded text-sm text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Select All
          </button>
          <button
            onClick={onClearAll}
            className="rounded text-sm text-ink-muted hover:text-ink-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {Object.entries(groupedSkills).map(([domain, domainSkills]) => (
          <div key={domain} className="border border-edge rounded-lg">
            <button
              onClick={() => toggleDomain(domain)}
              className="w-full flex items-center justify-between p-3 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
            >
              <span className="font-medium text-ink-body">{domain}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-muted">
                  {domainSkills.filter(s => selectedSkills.includes(s.id)).length}/{domainSkills.length}
                </span>
                {expandedDomains.has(domain) ? (
                  <ChevronUp className="h-4 w-4 text-ink-faint" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-ink-faint" />
                )}
              </div>
            </button>
            {expandedDomains.has(domain) && (
              <div className="px-3 pb-3 space-y-1">
                {domainSkills.map(skill => (
                  <label
                    key={skill.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-surface-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSkills.includes(skill.id)}
                      onChange={() => onToggle(skill.id)}
                      className="rounded border-edge-strong text-brand-600 bg-surface-input focus:ring-brand-500"
                    />
                    <span className="text-sm text-ink-muted">{skill.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Session Results Component - shows score only, no theta/ability data for students
const SessionResults = ({ results, onClose, onNewSession }) => {
  return (
    <div className="space-y-6">
      {/* Score */}
      <div className="text-center">
        <p className="font-display text-6xl font-bold text-ink-body">
          {results.score_percentage?.toFixed(0) || 0}%
        </p>
        <p className="text-ink-muted mt-2">
          {results.questions_correct} of {results.total_questions} correct
        </p>
      </div>

      {/* Performance summary - no theta shown */}
      <Card className="bg-brand-50 dark:bg-brand-950/30">
        <div className="text-center">
          <p className="text-sm text-ink-muted">Great work!</p>
          <p className="text-lg font-medium text-ink-body mt-1">
            {results.questions_correct >= results.total_questions * 0.8 ? 'Excellent performance!' :
             results.questions_correct >= results.total_questions * 0.6 ? 'Good progress!' :
             'Keep practicing to improve!'}
          </p>
        </div>
      </Card>

      {/* Skill Progress - ThetaBar with level-change delta */}
      {results.skill_progress?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-ink-muted mb-3">Skills Practiced</h3>
          <div className="space-y-4">
            {results.skill_progress.map(skill => {
              // Detect level-up: ability_after mastery_level_enum > ability_before
              const levelBefore = skill.ability?.before_level ?? null;
              const levelAfter = skill.ability?.after_level ?? (skill.mastery_level !== undefined ? Math.round(skill.mastery_level / 33.3) : null);
              const levelNames = ['Not Started', 'Familiar', 'Proficient', 'Mastered'];
              const levelColors = ['text-ink-muted', 'text-brand-700 dark:text-brand-400', 'text-accent-600 dark:text-accent-400', 'text-amber-600 dark:text-amber-400'];
              const didLevelUp = levelBefore !== null && levelAfter !== null && levelAfter > levelBefore;
              return (
                <div key={skill.skill_id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-ink-muted">{skill.skill_name}</span>
                    {didLevelUp && (
                      <span className={`text-xs font-semibold ${levelColors[levelAfter] || 'text-ink-muted'}`}>
                        ↑ {levelNames[levelAfter] || 'Level Up'}
                      </span>
                    )}
                  </div>
                  <ThetaBar
                    theta={skill.ability?.theta ?? null}
                    masteryLevel={levelAfter ?? 0}
                    size="full"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Back to Dashboard
        </Button>
        <Button variant="primary" onClick={onNewSession} className="flex-1">
          Practice Again
        </Button>
      </div>
    </div>
  );
};

const AdaptivePracticePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contentRef = useRef(null);

  // URL params for auto-starting with a specific skill
  const autoStartSkillId = searchParams.get('skill');
  const shouldAutoStart = searchParams.get('autostart') === 'true';

  // Session states
  const [phase, setPhase] = useState('setup'); // setup, practicing, completed
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentAbility, setCurrentAbility] = useState(null);
  const [, setPreviousAbility] = useState(null);

  // Setup state
  const [skills, setSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  // No longer using questionCount for student self-practice (infinite by default)

  // Practice state
  const [answer, setAnswer] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  // Results state
  const [sessionResults, setSessionResults] = useState(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showReferenceSheet, setShowReferenceSheet] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [calculatorKey, setCalculatorKey] = useState(0); // Force remount when needed
  const [error, setError] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  // Time tracking
  const [questionStartTime, setQuestionStartTime] = useState(null);

  // Track if auto-start has been attempted
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);

  // Load skills on mount
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const res = await taxonomyService.getSkills({ limit: 100 });
        const rawSkills = res.data.items || res.data || [];
        // Transform skills to include domain_name for grouping
        const transformedSkills = rawSkills.map(skill => ({
          ...skill,
          domain_name: skill.domain?.name || 'Other',
        }));
        setSkills(transformedSkills);
      } catch (err) {
        console.error('Failed to fetch skills:', err);
        setError('Failed to load skills');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSkills();
  }, []);

  // Auto-start session if skill param is provided
  useEffect(() => {
    const autoStartSession = async () => {
      if (!shouldAutoStart || !autoStartSkillId || autoStartAttempted || skills.length === 0) {
        return;
      }

      setAutoStartAttempted(true);
      const skillId = parseInt(autoStartSkillId, 10);

      // Verify skill exists
      const skillExists = skills.some(s => s.id === skillId);
      if (!skillExists) {
        setError(`Skill with ID ${skillId} not found`);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Create and start adaptive session for this skill
        const createRes = await adaptiveService.createSession({
          skill_ids: [skillId],
          question_count: null, // Infinite practice
        });

        const sessionData = createRes.data;
        setSession(sessionData);
        setCurrentAbility(sessionData.current_ability);
        setSelectedSkills([skillId]);

        // Start the session
        const startRes = await adaptiveService.startSession(sessionData.id);
        const startedSession = startRes.data;

        setSession(startedSession);
        setCurrentQuestion(startedSession.current_question);
        setCurrentAbility(startedSession.current_ability);
        setPhase('practicing');
        setQuestionsAnswered(0);
        setCorrectCount(0);
        setQuestionStartTime(Date.now());
      } catch (err) {
        console.error('Failed to auto-start session:', err);
        const message = err.response?.data?.detail || err.message || 'Failed to start practice session';
        setError(typeof message === 'string' ? message : JSON.stringify(message));
      } finally {
        setIsLoading(false);
      }
    };

    autoStartSession();
  }, [shouldAutoStart, autoStartSkillId, skills, autoStartAttempted]);

  const runMathJax = useCallback(() => {
    if (contentRef.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetClear?.([contentRef.current]);
      window.MathJax.typesetPromise([contentRef.current]).catch(console.error);
    }
  }, []);

  // Trigger MathJax when question changes
  useEffect(() => {
    runMathJax();
  }, [currentQuestion, lastResult, showExplanation, runMathJax]);

  // Start session
  const handleStartSession = async () => {
    if (selectedSkills.length === 0) {
      setError('Please select at least one skill');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create adaptive session (infinite by default - no question_count)
      const createRes = await adaptiveService.createSession({
        skill_ids: selectedSkills,
        question_count: null, // Infinite practice
      });

      const sessionData = createRes.data;
      setSession(sessionData);
      setCurrentAbility(sessionData.current_ability);

      // Start the session
      const startRes = await adaptiveService.startSession(sessionData.id);
      const startedSession = startRes.data;

      setSession(startedSession);
      setCurrentQuestion(startedSession.current_question);
      setCurrentAbility(startedSession.current_ability);
      setPhase('practicing');
      setQuestionsAnswered(0);
      setCorrectCount(0);
      setQuestionStartTime(Date.now()); // Start timing
    } catch (err) {
      console.error('Failed to start session:', err);
      const message = err.response?.data?.detail || err.message || 'Failed to start practice session';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setIsLoading(false);
    }
  };

  // Submit answer
  const handleSubmitAnswer = async () => {
    if (answer === null || answer === undefined || answer === '') return;

    setIsSubmitting(true);
    setPreviousAbility(currentAbility);

    try {
      const answerData = currentQuestion?.choices
        ? { index: answer }
        : { answer: answer };

      // Calculate actual time spent
      const timeSpent = questionStartTime
        ? Math.round((Date.now() - questionStartTime) / 1000)
        : 60;

      const res = await adaptiveService.submitAnswer(session.id, {
        answer: answerData,
        time_spent_seconds: timeSpent,
      });

      const result = res.data;
      setLastResult(result);
      setCurrentAbility(result.ability_after);
      setQuestionsAnswered(prev => prev + 1);
      if (result.is_correct) {
        setCorrectCount(prev => prev + 1);
      }

      if (result.session_complete) {
        // Session is done, get full results
        const completeRes = await adaptiveService.completeSession(session.id);
        setSessionResults(completeRes.data);
        setPhase('completed');
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setError('Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Move to next question
  const handleNextQuestion = () => {
    setCurrentQuestion(lastResult.next_question);
    setAnswer(null);
    setLastResult(null);
    setShowExplanation(false);
    setQuestionStartTime(Date.now()); // Reset timer for new question
  };

  // Exit practice (save progress) and return to dashboard
  const handleConfirmExit = async () => {
    setShowExitModal(false);
    try {
      if (session) await adaptiveService.completeSession(session.id);
    } catch {}
    navigate('/student');
  };

  // End practice session manually (for infinite mode)
  const handleEndPractice = async () => {
    if (!session) return;

    try {
      const completeRes = await adaptiveService.completeSession(session.id);
      setSessionResults(completeRes.data);
      setPhase('completed');
    } catch (err) {
      console.error('Failed to end session:', err);
      setError('Failed to end practice session');
    }
  };

  // Skill toggle
  const handleToggleSkill = (skillId) => {
    setSelectedSkills(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  };

  // Reset for new session
  const handleNewSession = () => {
    setPhase('setup');
    setSession(null);
    setCurrentQuestion(null);
    setCurrentAbility(null);
    setPreviousAbility(null);
    setAnswer(null);
    setLastResult(null);
    setShowExplanation(false);
    setSessionResults(null);
    setQuestionsAnswered(0);
    setCorrectCount(0);
    setShowCalculator(false);
    setShowReferenceSheet(false);
    setQuestionStartTime(null);
    setCalculatorKey(prev => prev + 1); // Force calculator remount
  };

  // Loading state
  if (isLoading && phase === 'setup') {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Setup Phase
  if (phase === 'setup') {
    return (
      <div className="mx-auto max-w-2xl pb-8">
        <PageHeader
          eyebrow="Adaptive"
          title="Adaptive Practice"
          subtitle="Questions selected based on your ability level."
          actions={(
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/student')}
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
        />

        {error && (
          <div role="alert" className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-lg text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <Section title="How adaptive practice works" icon={Brain}>
          <div className="space-y-3 text-sm text-ink-muted">
            <div className="flex items-start gap-3">
              <div className="p-1 bg-brand-100 dark:bg-brand-950/40 rounded">
                <Zap className="h-4 w-4 text-brand-700 dark:text-brand-400" />
              </div>
              <p>Questions are selected based on your current skill level using IRT (Item Response Theory)</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-1 bg-accent-100 dark:bg-accent-950/40 rounded">
                <Target className="h-4 w-4 text-accent-600 dark:text-accent-400" />
              </div>
              <p>Questions adapt to your skill level as you practice</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-1 bg-brand-100 dark:bg-brand-950/40 rounded">
                <Target className="h-4 w-4 text-brand-700 dark:text-brand-400" />
              </div>
              <p>Questions target the "zone of proximal development" - challenging but achievable</p>
            </div>
          </div>
        </Section>

        <Section className="mt-10" title="Select skills to practice" hint="Choose one or more skills to focus on">
          <SkillSelector
            skills={skills}
            selectedSkills={selectedSkills}
            onToggle={handleToggleSkill}
            onSelectAll={() => setSelectedSkills(skills.map(s => s.id))}
            onClearAll={() => setSelectedSkills([])}
          />
        </Section>

        <Button
          variant="primary"
          onClick={handleStartSession}
          disabled={selectedSkills.length === 0}
          className="mt-8 w-full py-3 text-lg"
        >
          <Zap className="h-5 w-5 mr-2" />
          Start Adaptive Practice
        </Button>
      </div>
    );
  }

  // Completed Phase
  if (phase === 'completed' && sessionResults) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <Card>
          <Card.Header>
            <Card.Title className="text-center">Practice Complete!</Card.Title>
          </Card.Header>
          <Card.Content>
            <SessionResults
              results={sessionResults}
              onClose={() => navigate('/student')}
              onNewSession={handleNewSession}
            />
          </Card.Content>
        </Card>
      </div>
    );
  }

  // Practice Phase - UI matching regular assignments
  return (
    <div className="min-h-screen flex flex-col bg-surface-page -m-4 lg:-m-6">
      {/* Header - matching TestPage header style - sticky */}
      <div className="sticky top-0 z-30 bg-surface-card border-b border-edge px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowExitModal(true)}
            className="p-2 hover:bg-surface-muted rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Exit practice"
          >
            <ArrowLeft className="h-5 w-5 text-ink-muted" />
          </button>
          <div>
            <h1 className="font-semibold text-ink-body">Adaptive Practice</h1>
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <span>Question {questionsAnswered + 1}</span>
              <span className="text-edge-strong">|</span>
              <span className="text-accent-600 dark:text-accent-400">{correctCount} correct</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Draw toggle */}
          <button
            onClick={() => setIsDrawing((d) => !d)}
            className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              isDrawing
                ? 'bg-brand-600 text-white'
                : 'text-ink-muted hover:bg-surface-muted'
            }`}
            aria-label={isDrawing ? 'Stop drawing' : 'Draw on question'}
            title={isDrawing ? 'Stop drawing' : 'Draw on question'}
          >
            <Pencil className="h-5 w-5" />
          </button>

          {/* End Practice button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowEndModal(true)}
            className="text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            End Practice
          </Button>
          {/* Reference Sheet Toggle - only for math questions */}
          {currentQuestion?.domain?.name?.toLowerCase().includes('math') ||
           currentQuestion?.skill?.domain?.name?.toLowerCase().includes('math') ||
           skills.find(s => selectedSkills.includes(s.id))?.domain_name?.toLowerCase().includes('math') ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowReferenceSheet(!showReferenceSheet)}
            >
              <BookOpen className="h-4 w-4 mr-1" />
              Reference
            </Button>
          ) : null}
          {/* Calculator Toggle */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCalculator(!showCalculator)}
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Calculator
          </Button>
        </div>
      </div>

      {/* Main Content - matching TestPage layout */}
      <div ref={contentRef} className={`flex-1 overflow-y-auto ${lastResult ? 'pb-52' : 'pb-28'} bg-surface-page ${showCalculator ? 'mr-[440px]' : ''}`}>
        <div className="max-w-3xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner size="lg" text="Loading question..." />
            </div>
          ) : currentQuestion ? (
            <>
              {/* Question header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
                <div className="flex items-center gap-4">
                  {/* Question number */}
                  <span className="flex items-center justify-center w-8 h-8 bg-brand-600 text-white text-sm font-medium rounded">
                    {questionsAnswered + 1}
                  </span>
                </div>
                {/* Report button */}
                <button
                  onClick={() => setShowReportModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-ink-muted hover:text-ink-body hover:bg-surface-muted rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <span>Report</span>
                </button>
              </div>

              {/* Passage (if any) - only show if prompt doesn't already contain the same content */}
              {/* Skip if: prompt has table, or passage text is already in prompt (reading questions) */}
              {currentQuestion.passage_html &&
               !currentQuestion.prompt_html?.includes('<table') &&
               !isPassageInPrompt(currentQuestion.passage_html, currentQuestion.prompt_html) && (
                <div className="px-6 py-4 bg-surface-muted border-b border-edge">
                  <HighlightableText
                    key={`${currentQuestion.id}-passage`}
                    html={currentQuestion.passage_html}
                    questionId={`${currentQuestion.id}-passage`}
                    className="prose-sm text-ink-muted"
                    onAfterSave={runMathJax}
                  />
                </div>
              )}

              {/* Question content */}
              <div className="p-6">
                <HighlightableText
                  key={currentQuestion.id}
                  html={currentQuestion.prompt_html}
                  questionId={currentQuestion.id}
                  className="mb-6"
                  onAfterSave={runMathJax}
                />

                {/* Answer Choices */}
                <AnswerChoices
                  choices={currentQuestion.choices?.map(c => c.content) || []}
                  answerType={currentQuestion.choices ? 'MCQ' : 'SPR'}
                  selectedIndex={typeof answer === 'number' ? answer : undefined}
                  selectedAnswer={typeof answer === 'string' ? answer : undefined}
                  onSelect={setAnswer}
                  onAnswerChange={setAnswer}
                  questionId={currentQuestion.id}
                  isChecked={!!lastResult}
                  correctIndex={lastResult?.correct_answer?.index}
                  isCorrect={lastResult?.is_correct}
                />

                {/* Feedback and Explanation after answer - matching TestPage style */}
                {lastResult && (
                  <div className="mt-4">
                    {/* Show correct answer for SPR if wrong */}
                    {!lastResult.is_correct && lastResult.correct_answer && currentQuestion.answer_type !== 'MCQ' && (
                      <div className="text-sm text-ink-muted mb-3">
                        {lastResult.correct_answer.answers?.length > 0 &&
                         !lastResult.correct_answer.answers.includes('*')
                          ? `Correct answer: ${lastResult.correct_answer.answers.join(' or ')}`
                          : 'See explanation for the correct answer'}
                      </div>
                    )}

                    {/* Explanation - step-by-step if available, otherwise plain HTML */}
                    {lastResult.explanation_available ? (
                      <StepByStepExplanation
                        questionId={String(currentQuestion.id)}
                        passageHtml={currentQuestion.passage_html || null}
                        promptHtml={currentQuestion.prompt_html || ''}
                        choices={currentQuestion.choices || []}
                      />
                    ) : lastResult.explanation_html ? (
                      <div className="p-4 bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-900/40 rounded-lg">
                        <h4 className="text-sm font-medium text-brand-900 dark:text-brand-200 mb-2">Explanation</h4>
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none text-ink-body"
                          dangerouslySetInnerHTML={{ __html: lastResult.explanation_html }}
                        />
                      </div>
                    ) : (
                      <div className="p-4 bg-surface-muted border border-edge rounded-lg">
                        <span className="text-sm text-ink-muted italic">
                          No explanation available for this question
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-ink-muted">No more questions available</p>
              <Button
                variant="secondary"
                onClick={() => navigate('/student')}
                className="mt-4"
              >
                Back to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Fixed bottom navigation - matching TestPage adaptive style */}
      <div className="fixed bottom-0 left-0 lg:left-[60px] right-0 z-50 border-t border-edge bg-surface-card">
        {/* Progress indicator */}
        <div className="flex items-center justify-center py-2 border-b border-edge-subtle">
          <span className="text-sm text-ink-muted">
            Question <span className="font-semibold">{questionsAnswered + 1}</span>
            {session?.total_questions ? (
              <> of <span className="font-semibold">{session.total_questions}</span></>
            ) : (
              <span className="ml-1 text-ink-faint">(unlimited)</span>
            )}
            {lastResult?.session_complete && (
              <span className="ml-2 text-accent-600 dark:text-accent-400 font-medium">• Practice Complete!</span>
            )}
          </span>
        </div>

        {/* Result indicator for answered questions */}
        {lastResult && (
          <div className={`flex items-center justify-center py-2 border-b border-edge-subtle ${
            lastResult.is_correct ? 'bg-accent-50 dark:bg-accent-950/30 text-accent-700 dark:text-accent-400' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400'
          }`}>
            <span className="text-sm font-medium">
              {lastResult.is_correct ? '✓ Correct!' : '✗ Incorrect'}
              {lastResult.session_complete && '. Review the explanation above, then click Finish'}
            </span>
          </div>
        )}

        {/* Single action button */}
        <div className="flex items-center justify-center px-4 py-3">
          {!lastResult ? (
            <Button
              variant="primary"
              onClick={handleSubmitAnswer}
              disabled={answer === null || answer === undefined || answer === '' || isSubmitting}
              className="min-w-[200px]"
            >
              {isSubmitting ? 'Checking...' : 'Check Answer'}
            </Button>
          ) : lastResult.session_complete ? (
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  const completeRes = await adaptiveService.completeSession(session.id);
                  setSessionResults(completeRes.data);
                  setPhase('completed');
                } catch (err) {
                  console.error('Failed to complete session:', err);
                }
              }}
              className="min-w-[200px]"
            >
              Finish Practice
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleNextQuestion}
              className="min-w-[200px]"
            >
              Next Question
            </Button>
          )}
        </div>
      </div>

      {/* Calculator - key forces remount when needed to fix blank issues */}
      <DesmosCalculator
        key={calculatorKey}
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        initialPosition={{ x: window.innerWidth - 450, y: 80 }}
      />

      {/* Reference Sheet for math questions */}
      <ReferenceSheet
        isOpen={showReferenceSheet}
        onClose={() => setShowReferenceSheet(false)}
        initialPosition={{ x: 100, y: 80 }}
      />

      {/* Drawing canvas overlay */}
      <DrawingCanvas
        isActive={isDrawing}
        questionId={currentQuestion?.id ?? 0}
        scrollRef={contentRef}
      />

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          questionId={currentQuestion?.id}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Exit confirmation */}
      <Modal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        title="Exit practice?"
        size="sm"
      >
        <p className="text-sm text-ink-muted">Your progress will be saved.</p>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowExitModal(false)}>Stay</Button>
          <Button variant="primary" onClick={handleConfirmExit}>Exit practice</Button>
        </Modal.Footer>
      </Modal>

      {/* End practice confirmation */}
      <Modal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        title="End practice?"
        size="sm"
      >
        <p className="text-sm text-ink-muted">End practice and see your results?</p>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEndModal(false)}>Keep going</Button>
          <Button
            variant="primary"
            onClick={() => { setShowEndModal(false); handleEndPractice(); }}
          >
            See results
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdaptivePracticePage;
