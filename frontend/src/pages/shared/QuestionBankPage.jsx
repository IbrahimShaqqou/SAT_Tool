/**
 * Question Bank Browser
 * Hierarchical browser: Domains → Skills → Practice Mode (same UI as assignments)
 * Used by both tutors and students
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Book,
  Calculator,
  ArrowLeft,
  FileText,
} from 'lucide-react';
import { Card, Button, Badge, LoadingSpinner } from '../../components/ui';
import {
  QuestionNav,
  QuestionDisplay,
  AnswerChoices,
  DesmosCalculator,
  ReferenceSheet,
  SplitPane,
} from '../../components/test';
import { questionService, taxonomyService } from '../../services';

// Subject icons (lowercase to match API response)
const subjectIcons = {
  math: Calculator,
  reading_writing: Book,
};

const QuestionBankPage = () => {
  // Navigation state
  const [view, setView] = useState('domains'); // 'domains' or 'practice'
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [expandedDomains, setExpandedDomains] = useState(new Set());

  // Data state
  const [domains, setDomains] = useState([]);
  const [skillsByDomain, setSkillsByDomain] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSkills, setIsLoadingSkills] = useState({});

  // Practice state
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [checkedAnswers, setCheckedAnswers] = useState({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [markedForReview, setMarkedForReview] = useState(new Set());

  // UI state
  const [showCalculator, setShowCalculator] = useState(false);
  const [showReferenceSheet, setShowReferenceSheet] = useState(false);
  const [showNav, setShowNav] = useState(false);

  // Current question
  const currentQuestion = practiceQuestions[currentIndex] || null;
  const passageHtml = currentQuestion?.passage_html;
  const hasPassage = !!passageHtml;

  // Determine subject area from current question or domain
  const subjectArea = currentQuestion?.subject_area || selectedDomain?.subject_area || 'math';

  // Load domains on mount
  useEffect(() => {
    const loadDomains = async () => {
      try {
        const res = await taxonomyService.getDomains();
        setDomains(res.data.items || []);
      } catch (err) {
        console.error('Failed to load domains:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadDomains();
  }, []);

  // Group domains by subject (API returns lowercase)
  const domainsBySubject = useMemo(() => {
    const grouped = { math: [], reading_writing: [] };
    domains.forEach(d => {
      const subject = d.subject_area?.toLowerCase() || '';
      if (grouped[subject]) {
        grouped[subject].push(d);
      }
    });
    return grouped;
  }, [domains]);

  // Load skills when domain is expanded
  const loadSkillsForDomain = async (domainId) => {
    if (skillsByDomain[domainId]) return;

    setIsLoadingSkills(prev => ({ ...prev, [domainId]: true }));
    try {
      const res = await taxonomyService.getSkills({ domain_id: domainId, limit: 100 });
      setSkillsByDomain(prev => ({ ...prev, [domainId]: res.data.items || [] }));
    } catch (err) {
      console.error('Failed to load skills:', err);
    } finally {
      setIsLoadingSkills(prev => ({ ...prev, [domainId]: false }));
    }
  };

  // Toggle domain expansion
  const toggleDomain = (domainId) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domainId)) {
        next.delete(domainId);
      } else {
        next.add(domainId);
        loadSkillsForDomain(domainId);
      }
      return next;
    });
  };

  // Select skill and start practice immediately
  const selectSkill = async (skill, domain) => {
    setSelectedSkill(skill);
    setSelectedDomain(domain);
    setIsLoadingQuestions(true);
    setAnswers({});
    setCheckedAnswers({});
    setShowExplanation(false);
    setCurrentIndex(0);
    setMarkedForReview(new Set());

    try {
      // Load all questions for this skill with full details in a single request (up to 500)
      const res = await questionService.getQuestionsWithDetails({ skill_id: skill.id, limit: 500 });
      const questions = res.data.items || [];

      if (questions.length === 0) {
        alert('No questions found for this skill');
        setIsLoadingQuestions(false);
        return;
      }

      // Transform questions to expected format
      const transformedQuestions = questions.map((q, idx) => ({
        id: q.id,
        order: idx + 1,
        prompt_html: q.prompt_html,
        passage_html: q.passage_html,
        answer_type: q.answer_type || 'MCQ',
        choices_json: q.choices ? q.choices.map(c => c.content) : [],
        correct_answer: q.correct_answer,
        explanation_html: q.explanation_html,
        difficulty: q.difficulty,
        subject_area: q.subject_area || domain.subject_area,
      }));

      setPracticeQuestions(transformedQuestions);
      setView('practice');
    } catch (err) {
      console.error('Failed to load questions:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: {
          url: err.config?.url,
          baseURL: err.config?.baseURL,
          method: err.config?.method,
        }
      });

      let errorMessage = 'Unknown error';
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. The server may be slow or unavailable.';
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check your connection and the API URL.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Authentication required. Please log in again.';
      } else if (err.response?.status === 403) {
        errorMessage = 'Access denied. You may not have permission to view these questions.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Questions not found.';
      } else if (err.response?.status >= 500) {
        errorMessage = `Server error (${err.response.status}). Please try again later.`;
      } else {
        errorMessage = err.response?.data?.detail || err.message || 'Unknown error';
      }

      alert(`Failed to load questions: ${errorMessage}`);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  // Go back to domains
  const goBack = () => {
    setView('domains');
    setSelectedSkill(null);
    setSelectedDomain(null);
    setPracticeQuestions([]);
    setCheckedAnswers({});
    setAnswers({});
    setShowCalculator(false);
    setShowReferenceSheet(false);
    setShowNav(false);
  };

  // Handlers
  const handleSelectAnswer = useCallback((index) => {
    const questionId = currentQuestion?.id;
    if (!questionId || checkedAnswers[questionId]) return;
    setAnswers(prev => ({ ...prev, [questionId]: index }));
  }, [currentQuestion, checkedAnswers]);

  const handleSPRAnswer = useCallback((answerText) => {
    const questionId = currentQuestion?.id;
    if (!questionId || checkedAnswers[questionId]) return;
    setAnswers(prev => ({ ...prev, [questionId]: answerText }));
  }, [currentQuestion, checkedAnswers]);

  const handleToggleMark = useCallback(() => {
    const questionId = currentQuestion?.id;
    if (!questionId) return;
    setMarkedForReview(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, [currentQuestion]);

  const handleNavigate = useCallback((index) => {
    setCurrentIndex(index);
    setShowExplanation(false);
    setShowNav(false);
  }, []);

  const handlePrevious = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
    setShowExplanation(false);
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(practiceQuestions.length - 1, prev + 1));
    setShowExplanation(false);
  }, [practiceQuestions.length]);

  // Check answer for current question
  const handleCheckAnswer = useCallback(() => {
    const question = currentQuestion;
    if (!question) return;

    const questionId = question.id;
    const userAnswer = answers[questionId];
    if (userAnswer === undefined) return;

    let isCorrect = false;
    let correctIndex = null;
    let correctAnswers = null;

    if (question.answer_type === 'MCQ') {
      correctIndex = question.correct_answer?.index;
      isCorrect = userAnswer === correctIndex;
    } else {
      correctAnswers = question.correct_answer?.answers || [];
      const userAnswerNorm = String(userAnswer).trim().toLowerCase();
      isCorrect = correctAnswers.some(ans =>
        String(ans).trim().toLowerCase() === userAnswerNorm
      );
    }

    setCheckedAnswers(prev => ({
      ...prev,
      [questionId]: { isCorrect, correctIndex, correctAnswers },
    }));
    setShowExplanation(true);
  }, [currentQuestion, answers]);

  // Render domains view
  const renderDomainsView = () => (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Question Bank</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Browse questions by domain and skill</p>
      </div>

      {/* Loading overlay for question loading */}
      {isLoadingQuestions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl flex items-center gap-4">
            <LoadingSpinner />
            <span className="text-gray-700 dark:text-gray-300">Loading questions...</span>
          </div>
        </div>
      )}

      {/* Subject sections */}
      {['math', 'reading_writing'].map(subject => {
        const SubjectIcon = subjectIcons[subject];
        const subjectDomains = domainsBySubject[subject] || [];

        return (
          <Card key={subject}>
            <Card.Header>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <SubjectIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <Card.Title>
                    {subject === 'math' ? 'Math' : 'Reading & Writing'}
                  </Card.Title>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {subjectDomains.reduce((sum, d) => sum + (d.question_count || 0), 0)} questions
                  </p>
                </div>
              </div>
            </Card.Header>
            <Card.Content className="p-0">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {subjectDomains.map(domain => (
                  <div key={domain.id}>
                    {/* Domain header */}
                    <button
                      onClick={() => toggleDomain(domain.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {expandedDomains.has(domain.id) ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900 dark:text-gray-100">{domain.name}</span>
                      </div>
                      <Badge variant="default" size="sm">
                        {domain.question_count || 0} questions
                      </Badge>
                    </button>

                    {/* Skills list */}
                    {expandedDomains.has(domain.id) && (
                      <div className="bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
                        {isLoadingSkills[domain.id] ? (
                          <div className="flex items-center justify-center py-4">
                            <LoadingSpinner size="sm" />
                          </div>
                        ) : (
                          <div className="py-2">
                            {(skillsByDomain[domain.id] || []).map(skill => (
                              <button
                                key={skill.id}
                                onClick={() => selectSkill(skill, domain)}
                                disabled={isLoadingQuestions}
                                className="w-full flex items-center justify-between px-8 py-2 hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors text-left disabled:opacity-50"
                              >
                                <span className="text-sm text-gray-700 dark:text-gray-300">{skill.name}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="info" size="sm">
                                    {skill.question_count || 0}
                                  </Badge>
                                  <ChevronRight className="h-3 w-3 text-gray-400" />
                                </div>
                              </button>
                            ))}
                            {(skillsByDomain[domain.id] || []).length === 0 && (
                              <p className="text-sm text-gray-400 dark:text-gray-500 px-8 py-2">No skills found</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>
        );
      })}
    </div>
  );

  // Render practice view (same as TestPage)
  const renderPracticeView = () => {
    if (!currentQuestion) return null;

    const questionId = currentQuestion.id;
    const currentAnswer = answers[questionId];
    const currentChecked = checkedAnswers[questionId];
    const isAnswered = currentAnswer !== undefined;
    const isCurrentMarked = markedForReview.has(questionId);

    // Question panel content
    const questionPanel = (
      <div className={`bg-white dark:bg-gray-900 pb-20 ${hasPassage ? 'h-full flex flex-col' : ''}`}>
        <div className={hasPassage ? 'flex-1 overflow-y-auto' : ''}>
          <QuestionDisplay
            questionNumber={currentIndex + 1}
            questionHtml={currentQuestion.prompt_html || ''}
            stimulusHtml={null}
            isMarked={isCurrentMarked}
            onToggleMark={handleToggleMark}
            onReport={() => console.log('Report question')}
          />

          {/* Answer choices */}
          <div className="px-6 pb-4">
            <AnswerChoices
              choices={currentQuestion.choices_json || []}
              answerType={currentQuestion.answer_type || 'MCQ'}
              selectedIndex={typeof currentAnswer === 'number' ? currentAnswer : undefined}
              selectedAnswer={typeof currentAnswer === 'string' ? currentAnswer : undefined}
              onSelect={handleSelectAnswer}
              onAnswerChange={handleSPRAnswer}
              questionId={currentQuestion.id}
              isChecked={!!currentChecked}
              correctIndex={currentChecked?.correctIndex}
              isCorrect={currentChecked?.isCorrect}
            />

            {/* Check Answer / Show Explanation buttons */}
            <div className="mt-4 flex items-center gap-3">
              {!currentChecked && isAnswered && (
                <Button
                  variant="secondary"
                  onClick={handleCheckAnswer}
                  className="text-sm"
                >
                  Check Answer
                </Button>
              )}
              {currentChecked && currentQuestion.explanation_html && (
                <Button
                  variant="secondary"
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="text-sm"
                >
                  {showExplanation ? 'Hide Explanation' : 'Show Explanation'}
                </Button>
              )}
              {currentChecked && !currentQuestion.explanation_html && (
                <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                  No explanation available for this question
                </span>
              )}
              {currentChecked && !currentChecked.isCorrect && currentQuestion.answer_type === 'SPR' && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {currentChecked.correctAnswers?.length > 0 && currentChecked.correctAnswers[0] !== '*'
                    ? `Correct answer: ${currentChecked.correctAnswers.join(' or ')}`
                    : 'See explanation for correct answer'}
                </span>
              )}
            </div>

            {/* Explanation display */}
            {showExplanation && currentQuestion.explanation_html && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">Explanation</h4>
                <div
                  className="prose prose-sm prose-blue dark:prose-invert max-w-none text-blue-800 dark:text-blue-200"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.explanation_html }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );

    // Passage panel content
    const passagePanel = hasPassage ? (
      <div className="h-full overflow-auto p-6 bg-white dark:bg-gray-900">
        <div
          className="prose prose-gray dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: currentQuestion.passage_html }}
        />
      </div>
    ) : null;

    // Bottom navigation bar
    const bottomNavBar = (
      <>
        {/* Collapsible Question Navigator - positioned in center of content area */}
        {showNav && (
          <div className="fixed bottom-16 left-1/2 lg:left-[calc(50%+8rem)] -translate-x-1/2 z-40 bg-gray-50 dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 rounded-t-xl max-h-[50vh] overflow-hidden"
               style={{ width: 'min(500px, calc(100vw - 32px))' }}>
            <QuestionNav
              totalQuestions={practiceQuestions.length}
              currentIndex={currentIndex}
              answers={answers}
              markedForReview={markedForReview}
              questions={practiceQuestions}
              checkedAnswers={checkedAnswers}
              onNavigate={handleNavigate}
            />
          </div>
        )}

        {/* Fixed bottom controls - offset for sidebar on desktop */}
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-50 flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {/* Previous */}
          <Button
            variant="secondary"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="min-w-[100px]"
          >
            Previous
          </Button>

          {/* Question selector */}
          <button
            onClick={() => setShowNav(!showNav)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <span className="font-semibold">{currentIndex + 1}</span>
            <span className="text-gray-400 dark:text-gray-500">/</span>
            <span>{practiceQuestions.length}</span>
            <svg className={`w-4 h-4 transition-transform ${showNav ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>

          {/* Next */}
          <Button
            variant="primary"
            onClick={handleNext}
            disabled={currentIndex === practiceQuestions.length - 1}
            className="min-w-[100px]"
          >
            Next
          </Button>
        </div>
      </>
    );

    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 -m-4 lg:-m-6">
        {/* Custom Header with back button - sticky at top */}
        <header className="sticky top-0 z-30 h-14 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
          {/* Left: Back button and skill name */}
          <div className="flex items-center gap-4">
            <button
              onClick={goBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedSkill?.name}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">({selectedDomain?.name})</span>
            </div>
          </div>

          {/* Center: Question count */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Question</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {currentIndex + 1} of {practiceQuestions.length}
            </span>
          </div>

          {/* Right: Reference Sheet and Calculator toggle (only for math) */}
          <div className="flex items-center gap-2">
            {subjectArea === 'math' && (
              <>
                <button
                  onClick={() => setShowReferenceSheet(!showReferenceSheet)}
                  className={`p-2 rounded-lg transition-colors ${
                    showReferenceSheet
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="Reference Sheet"
                >
                  <FileText className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setShowCalculator(!showCalculator)}
                  className={`p-2 rounded-lg transition-colors ${
                    showCalculator
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="Calculator"
                >
                  <Calculator className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main content - shifts right when calculator is open */}
        <div className={`flex-1 transition-all duration-300 bg-white dark:bg-gray-900 ${showCalculator ? 'mr-[440px]' : ''} ${hasPassage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {hasPassage ? (
            <SplitPane
              left={passagePanel}
              right={questionPanel}
              defaultSplit={50}
              minLeft={25}
              minRight={35}
            />
          ) : (
            <div className="max-w-4xl mx-auto px-6">
              {questionPanel}
            </div>
          )}
        </div>

        {/* Desmos Calculator */}
        <DesmosCalculator
          isOpen={showCalculator}
          onClose={() => setShowCalculator(false)}
          initialPosition={{ x: window.innerWidth - 450, y: 80 }}
        />

        {/* Reference Sheet */}
        <ReferenceSheet
          isOpen={showReferenceSheet}
          onClose={() => setShowReferenceSheet(false)}
          initialPosition={{ x: 100, y: 80 }}
        />

        {/* Fixed bottom navigation bar */}
        {bottomNavBar}
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Render based on view
  if (view === 'practice') {
    return renderPracticeView();
  }

  return renderDomainsView();
};

export default QuestionBankPage;
