/**
 * Adaptive Practice Page - IRT-Based Intelligent Practice
 * Features real-time ability tracking and adaptive question selection
 */
import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  LoadingSpinner,
} from '../../components/ui';
import { AnswerChoices, DesmosCalculator, ReferenceSheet } from '../../components/test';
import { adaptiveService, taxonomyService } from '../../services';

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
        <span className="text-sm text-gray-500">
          {selectedSkills.length} skill{selectedSkills.length !== 1 ? 's' : ''} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Select All
          </button>
          <button
            onClick={onClearAll}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {Object.entries(groupedSkills).map(([domain, domainSkills]) => (
          <div key={domain} className="border rounded-lg">
            <button
              onClick={() => toggleDomain(domain)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
            >
              <span className="font-medium text-gray-900">{domain}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {domainSkills.filter(s => selectedSkills.includes(s.id)).length}/{domainSkills.length}
                </span>
                {expandedDomains.has(domain) ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </button>
            {expandedDomains.has(domain) && (
              <div className="px-3 pb-3 space-y-1">
                {domainSkills.map(skill => (
                  <label
                    key={skill.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSkills.includes(skill.id)}
                      onChange={() => onToggle(skill.id)}
                      className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-700">{skill.name}</span>
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
        <p className="text-6xl font-bold text-gray-900">
          {results.score_percentage?.toFixed(0) || 0}%
        </p>
        <p className="text-gray-500 mt-2">
          {results.questions_correct} of {results.total_questions} correct
        </p>
      </div>

      {/* Performance summary - no theta shown */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="text-center">
          <p className="text-sm text-gray-500">Great work!</p>
          <p className="text-lg font-medium text-gray-700 mt-1">
            {results.questions_correct >= results.total_questions * 0.8 ? 'Excellent performance!' :
             results.questions_correct >= results.total_questions * 0.6 ? 'Good progress!' :
             'Keep practicing to improve!'}
          </p>
        </div>
      </Card>

      {/* Skill Progress - show mastery without theta */}
      {results.skill_progress?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Skills Practiced</h3>
          <div className="space-y-3">
            {results.skill_progress.map(skill => (
              <div key={skill.skill_id} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{skill.skill_name}</span>
                <Badge variant={skill.mastery_level >= 70 ? 'success' : skill.mastery_level >= 50 ? 'warning' : 'danger'}>
                  {skill.mastery_level?.toFixed(0)}% mastery
                </Badge>
              </div>
            ))}
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
  const [showCalculator, setShowCalculator] = useState(false);
  const [showReferenceSheet, setShowReferenceSheet] = useState(false);
  const [calculatorKey, setCalculatorKey] = useState(0); // Force remount when needed
  const [error, setError] = useState(null);

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

  // Trigger MathJax when question changes
  useEffect(() => {
    if (contentRef.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([contentRef.current]).catch(console.error);
    }
  }, [currentQuestion, lastResult, showExplanation]);

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
    if (answer === null || answer === undefined) return;

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
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/student')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Adaptive Practice</h1>
            <p className="text-gray-500">Questions selected based on your ability level</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              How Adaptive Practice Works
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <div className="p-1 bg-blue-100 rounded">
                  <Zap className="h-4 w-4 text-blue-600" />
                </div>
                <p>Questions are selected based on your current skill level using IRT (Item Response Theory)</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1 bg-green-100 rounded">
                  <Target className="h-4 w-4 text-green-600" />
                </div>
                <p>Questions adapt to your skill level as you practice</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1 bg-purple-100 rounded">
                  <Target className="h-4 w-4 text-purple-600" />
                </div>
                <p>Questions target the "zone of proximal development" - challenging but achievable</p>
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Select Skills to Practice</Card.Title>
            <Card.Description>Choose one or more skills to focus on</Card.Description>
          </Card.Header>
          <Card.Content>
            <SkillSelector
              skills={skills}
              selectedSkills={selectedSkills}
              onToggle={handleToggleSkill}
              onSelectAll={() => setSelectedSkills(skills.map(s => s.id))}
              onClearAll={() => setSelectedSkills([])}
            />
          </Card.Content>
        </Card>

        <Button
          variant="primary"
          onClick={handleStartSession}
          disabled={selectedSkills.length === 0}
          className="w-full py-3 text-lg"
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
    <div className="h-screen flex flex-col bg-white">
      {/* Header - matching TestPage header style */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to exit? Progress will be saved.')) {
                handleEndPractice();
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-900">Adaptive Practice</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Question {questionsAnswered + 1}</span>
              <span className="text-gray-300">|</span>
              <span className="text-green-600">{correctCount} correct</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* End Practice button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (window.confirm('End practice and see your results?')) {
                handleEndPractice();
              }
            }}
            className="text-red-600 border-red-200 hover:bg-red-50"
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
      <div ref={contentRef} className={`flex-1 overflow-y-auto pb-20 ${showCalculator ? 'mr-[440px]' : ''}`}>
        <div className="max-w-3xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner size="lg" text="Loading question..." />
            </div>
          ) : currentQuestion ? (
            <>
              {/* Question header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  {/* Question number */}
                  <span className="flex items-center justify-center w-8 h-8 bg-gray-900 text-white text-sm font-medium rounded">
                    {questionsAnswered + 1}
                  </span>
                </div>
                {/* Report button placeholder */}
                <button className="flex items-center gap-2 px-3 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-sm transition-colors">
                  <span>Report</span>
                </button>
              </div>

              {/* Passage (if any) - only show if prompt doesn't already contain the same content */}
              {/* Skip if: prompt has table, or passage text is already in prompt (reading questions) */}
              {currentQuestion.passage_html &&
               !currentQuestion.prompt_html?.includes('<table') &&
               !isPassageInPrompt(currentQuestion.passage_html, currentQuestion.prompt_html) && (
                <div className="px-6 py-4 bg-gray-50 border-b">
                  <div
                    className="prose prose-sm max-w-none text-gray-600 question-content"
                    dangerouslySetInnerHTML={{ __html: currentQuestion.passage_html }}
                  />
                </div>
              )}

              {/* Question content */}
              <div className="p-6">
                <div
                  className="prose prose-gray max-w-none question-content mb-6"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.prompt_html }}
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
                      <div className="text-sm text-gray-600 mb-3">
                        Correct answer: {
                          lastResult.correct_answer.answers?.join(' or ') || 'See explanation'
                        }
                      </div>
                    )}

                    {/* Explanation - shown inline like TestPage */}
                    {lastResult.explanation_html ? (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="text-sm font-medium text-blue-900 mb-2">Explanation</h4>
                        <div
                          className="prose prose-sm prose-blue max-w-none text-blue-800"
                          dangerouslySetInnerHTML={{ __html: lastResult.explanation_html }}
                        />
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <span className="text-sm text-gray-500 italic">
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
              <p className="text-gray-500">No more questions available</p>
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
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white">
        {/* Progress indicator */}
        <div className="flex items-center justify-center py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">
            Question <span className="font-semibold">{questionsAnswered + 1}</span>
            {session?.total_questions ? (
              <> of <span className="font-semibold">{session.total_questions}</span></>
            ) : (
              <span className="ml-1 text-gray-400">(unlimited)</span>
            )}
            {lastResult?.session_complete && (
              <span className="ml-2 text-green-600 font-medium">• Practice Complete!</span>
            )}
          </span>
        </div>

        {/* Result indicator for answered questions */}
        {lastResult && (
          <div className={`flex items-center justify-center py-2 border-b border-gray-100 ${
            lastResult.is_correct ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            <span className="text-sm font-medium">
              {lastResult.is_correct ? '✓ Correct!' : '✗ Incorrect'}
              {lastResult.session_complete && ' — Review the explanation above, then click Finish'}
            </span>
          </div>
        )}

        {/* Single action button */}
        <div className="flex items-center justify-center px-4 py-3">
          {!lastResult ? (
            <Button
              variant="primary"
              onClick={handleSubmitAnswer}
              disabled={answer === null || answer === undefined || isSubmitting}
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
    </div>
  );
};

export default AdaptivePracticePage;
