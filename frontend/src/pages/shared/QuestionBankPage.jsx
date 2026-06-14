/**
 * Question Bank Browser
 * Hierarchical browser: Domains → Skills → Practice Mode (same UI as assignments)
 * Used by both tutors and students
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Book,
  Calculator,
  ArrowLeft,
  FileText,
  Pencil,
  Search,
  Star,
  Maximize2,
  Minimize2,
  CheckCircle2,
  XCircle,
  Circle,
} from 'lucide-react';
import { Card, Button, Badge, LoadingSpinner } from '../../components/ui';
import {
  QuestionNav,
  QuestionDisplay,
  AnswerChoices,
  DesmosCalculator,
  ReferenceSheet,
  SplitPane,
  DrawingCanvas,
  HighlightableText,
} from '../../components/test';
import { questionService, taxonomyService } from '../../services';
import { StepByStepExplanation } from '../../components/explanation';
import { checkSprAnswer, splitRWPrompt } from '../../utils';

// Subject icons (lowercase to match API response)
const subjectIcons = {
  math: Calculator,
  reading_writing: Book,
};

const QuestionBankPage = ({ userRole = 'student', isPublic = false }) => {
  const navigate = useNavigate();
  // Authenticated users (non-public) get the filterable browser + persistent
  // progress + bookmarks. Public/logged-out keeps the simple domains tree.
  const isAuthed = !isPublic && (() => {
    try { return !!localStorage.getItem('accessToken'); } catch { return false; }
  })();
  const isTutor = isAuthed && userRole === 'tutor';

  // Navigation state. 'browse' = new filterable browser (authed),
  // 'domains' = legacy tree (public), 'practice' = answering.
  const [view, setView] = useState(isAuthed ? 'browse' : 'domains');
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [expandedDomains, setExpandedDomains] = useState(new Set());

  // Filterable browser state (authed). Pre-fill skill from ?skill= so the
  // worklist's "drill this skill" link deep-links here.
  const initialSkill = (() => {
    try { return new URLSearchParams(window.location.search).get('skill') || ''; }
    catch { return ''; }
  })();
  const [filters, setFilters] = useState({
    difficulty: '', skill_id: initialSkill, domain_id: '', status: '', bookmarked: false, q: '',
  });
  const [browseItems, setBrowseItems] = useState([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseOffset, setBrowseOffset] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [bankStats, setBankStats] = useState(null);
  const [allSkills, setAllSkills] = useState([]);
  const [bookmarkSet, setBookmarkSet] = useState(new Set());
  const BROWSE_LIMIT = 30;

  // Tutor multi-select for assigning
  const [selectedForAssign, setSelectedForAssign] = useState(new Set());

  // Focus / screen-share mode (hides chrome + personal status, larger type)
  const [focusMode, setFocusMode] = useState(false);

  // Data state
  const [domains, setDomains] = useState([]);
  const [skillsByDomain, setSkillsByDomain] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSkills, setIsLoadingSkills] = useState({});

  // Practice state
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const questionHeadingRef = useRef(null);
  const [answers, setAnswers] = useState({});
  const [checkedAnswers, setCheckedAnswers] = useState({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [markedForReview, setMarkedForReview] = useState(new Set());

  // UI state
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showReferenceSheet, setShowReferenceSheet] = useState(false);
  const [showNav, setShowNav] = useState(false);

  // Current question
  const currentQuestion = practiceQuestions[currentIndex] || null;

  // Determine subject area from current question or domain
  const subjectArea = currentQuestion?.subject_area || selectedDomain?.subject_area || 'math';

  // R/W questions ship passage + question concatenated in prompt_html.
  // splitRWPrompt extracts the passage so the SplitPane can render them
  // side-by-side. Math returns null/the original prompt unchanged.
  const { passageHtml, questionHtml } = useMemo(
    () =>
      splitRWPrompt({
        promptHtml: currentQuestion?.prompt_html || '',
        passageHtml: currentQuestion?.passage_html || null,
        subjectArea,
      }),
    [currentQuestion, subjectArea]
  );

  const hasPassage = !!passageHtml;

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
        choices: q.choices || [],
        correct_answer: q.correct_answer,
        explanation_html: q.explanation_html,
        explanation_available: q.explanation_available || false,
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

  // a11y: focus the question heading when navigating between questions.
  useEffect(() => {
    const el = questionHeadingRef.current;
    if (el) el.focus({ preventScroll: false });
  }, [currentIndex]);

  // Check answer for current question (via backend API)
  const handleCheckAnswer = useCallback(async () => {
    const question = currentQuestion;
    if (!question) return;

    const questionId = question.id;
    const userAnswer = answers[questionId];
    if (userAnswer === undefined) return;

    try {
      const answerPayload = question.answer_type === 'MCQ'
        ? { index: userAnswer }
        : { answer: userAnswer };

      // Authenticated → record the attempt (persists for progress + review);
      // public/logged-out → stateless check.
      const res = isAuthed
        ? await questionService.recordAttempt(questionId, answerPayload)
        : await questionService.checkAnswer(questionId, answerPayload);
      const { is_correct, correct_answer, explanation_html, explanation_available } = res.data;

      setCheckedAnswers(prev => ({
        ...prev,
        [questionId]: {
          isCorrect: is_correct,
          correctIndex: correct_answer?.index,
          correctAnswers: correct_answer?.answers,
          explanation: explanation_html,
          explanationAvailable: explanation_available,
        },
      }));
      setShowExplanation(true);
    } catch (err) {
      // Fallback to client-side check if API fails
      let isCorrect = false;
      let correctIndex = null;
      let correctAnswers = null;

      if (question.answer_type === 'MCQ') {
        correctIndex = question.correct_answer?.index;
        isCorrect = userAnswer === correctIndex;
      } else {
        correctAnswers = question.correct_answer?.answers || [];
        isCorrect = checkSprAnswer(userAnswer, correctAnswers);
      }

      setCheckedAnswers(prev => ({
        ...prev,
        [questionId]: { isCorrect, correctIndex, correctAnswers },
      }));
      setShowExplanation(true);
    }
  }, [currentQuestion, answers, isAuthed]);

  // ----- Filterable browser (authenticated) -----
  const loadBrowse = useCallback(async (offset = 0) => {
    if (!isAuthed) return;
    setBrowseLoading(true);
    try {
      const params = { limit: BROWSE_LIMIT, offset };
      if (filters.difficulty) params.difficulty = filters.difficulty;
      if (filters.skill_id) params.skill_id = filters.skill_id;
      if (filters.domain_id) params.domain_id = filters.domain_id;
      if (filters.status && !isTutor) params.status = filters.status;
      if (filters.bookmarked && !isTutor) params.bookmarked = true;
      if (filters.q) params.q = filters.q;
      const res = await questionService.bankBrowse(params);
      setBrowseItems(res.data.items || []);
      setBrowseTotal(res.data.total || 0);
      setBrowseOffset(offset);
      setBookmarkSet(new Set((res.data.items || []).filter(i => i.bookmarked).map(i => i.id)));
    } catch (err) {
      console.error('Browse failed:', err);
      setBrowseItems([]);
    } finally {
      setBrowseLoading(false);
    }
  }, [isAuthed, isTutor, filters]);

  // Load skills (for the filter dropdown) + stats on mount (authed only)
  useEffect(() => {
    if (!isAuthed) return;
    taxonomyService.getSkills?.({ limit: 200 })?.then?.(
      (r) => setAllSkills(r.data.items || r.data || [])
    ).catch(() => {});
    questionService.myBankStats().then((r) => setBankStats(r.data)).catch(() => {});
  }, [isAuthed]);

  // Re-run browse when filters change (authed + on browse view)
  useEffect(() => {
    if (isAuthed && view === 'browse') loadBrowse(0);
  }, [isAuthed, view, loadBrowse]);

  // Practice a filtered set: fetch full details for the current page of results.
  const practiceFromBrowse = async (startId = null) => {
    setIsLoadingQuestions(true);
    try {
      const params = { limit: 100 };
      if (filters.difficulty) params.difficulty = filters.difficulty;
      if (filters.skill_id) params.skill_id = filters.skill_id;
      if (filters.domain_id) params.domain_id = filters.domain_id;
      const res = await questionService.getQuestionsWithDetails(params);
      let questions = res.data.items || [];
      // If launched from a specific card, start there.
      if (startId) {
        const i = questions.findIndex((q) => q.id === startId);
        if (i > 0) questions = [...questions.slice(i), ...questions.slice(0, i)];
      }
      if (questions.length === 0) { setIsLoadingQuestions(false); return; }
      setPracticeQuestions(questions.map((q, idx) => ({
        id: q.id, order: idx + 1, prompt_html: q.prompt_html, passage_html: q.passage_html,
        answer_type: q.answer_type || 'MCQ',
        choices_json: q.choices ? q.choices.map(c => c.content) : [],
        choices: q.choices || [], correct_answer: q.correct_answer,
        explanation_html: q.explanation_html, explanation_available: q.explanation_available || false,
        difficulty: q.difficulty, subject_area: q.subject_area || 'math',
      })));
      setAnswers({}); setCheckedAnswers({}); setCurrentIndex(0); setShowExplanation(false);
      setView('practice');
    } catch (err) {
      console.error('Failed to load practice set:', err);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const toggleBookmark = useCallback(async (questionId) => {
    const has = bookmarkSet.has(questionId);
    // optimistic
    setBookmarkSet((prev) => {
      const next = new Set(prev);
      if (has) next.delete(questionId); else next.add(questionId);
      return next;
    });
    try {
      if (has) await questionService.removeBookmark(questionId);
      else await questionService.addBookmark(questionId);
    } catch {
      // revert on failure
      setBookmarkSet((prev) => {
        const next = new Set(prev);
        if (has) next.add(questionId); else next.delete(questionId);
        return next;
      });
    }
  }, [bookmarkSet]);

  const toggleAssignSelect = (id) => {
    setSelectedForAssign((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const assignSelected = () => {
    const ids = Array.from(selectedForAssign);
    if (!ids.length) return;
    navigate(`/tutor/assignments/new?question_ids=${ids.join(',')}`);
  };

  // Render domains view
  const renderDomainsView = () => (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-body">Question Bank</h1>
        <p className="text-ink-subtle mt-1">Browse questions by domain and skill</p>
      </div>

      {/* Loading overlay for question loading */}
      {isLoadingQuestions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" role="alert" aria-busy="true">
          <div className="bg-surface-card p-6 rounded-lg shadow-xl flex items-center gap-4">
            <LoadingSpinner />
            <span className="text-ink-muted">Loading questions...</span>
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
                <div className="p-2 bg-surface-muted rounded-lg">
                  <SubjectIcon className="h-5 w-5 text-ink-muted" />
                </div>
                <div>
                  <Card.Title>
                    {subject === 'math' ? 'Math' : 'Reading & Writing'}
                  </Card.Title>
                  <p className="text-sm text-ink-subtle">
                    {subjectDomains.reduce((sum, d) => sum + (d.question_count || 0), 0)} questions
                  </p>
                </div>
              </div>
            </Card.Header>
            <Card.Content className="p-0">
              <div className="divide-y divide-edge-subtle">
                {subjectDomains.map(domain => (
                  <div key={domain.id}>
                    {/* Domain header */}
                    <button
                      onClick={() => toggleDomain(domain.id)}
                      aria-expanded={expandedDomains.has(domain.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <div className="flex items-center gap-3">
                        {expandedDomains.has(domain.id) ? (
                          <ChevronDown className="h-4 w-4 text-ink-faint" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-ink-faint" />
                        )}
                        <span className="font-medium text-ink-body">{domain.name}</span>
                      </div>
                      <Badge variant="default" size="sm">
                        {domain.question_count || 0} questions
                      </Badge>
                    </button>

                    {/* Skills list */}
                    {expandedDomains.has(domain.id) && (
                      <div className="bg-surface-muted border-t border-edge-subtle">
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
                                className="w-full flex items-center justify-between px-8 py-2 hover:bg-surface-card transition-colors text-left disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                              >
                                <span className="text-sm text-ink-muted">{skill.name}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="info" size="sm">
                                    {skill.question_count || 0}
                                  </Badge>
                                  <ChevronRight className="h-3 w-3 text-ink-faint" />
                                </div>
                              </button>
                            ))}
                            {(skillsByDomain[domain.id] || []).length === 0 && (
                              <p className="text-sm text-ink-faint px-8 py-2">No skills found</p>
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
      <div className={`bg-surface-card pb-20 ${hasPassage ? 'h-full flex flex-col' : ''}`}>
        <div className={hasPassage ? 'flex-1 overflow-y-auto' : ''}>
          <QuestionDisplay
            questionNumber={currentIndex + 1}
            totalQuestions={practiceQuestions.length}
            questionHtml={questionHtml || currentQuestion.prompt_html || ''}
            stimulusHtml={null}
            questionId={currentQuestion.id}
            isMarked={isCurrentMarked}
            onToggleMark={handleToggleMark}
            onReport={() => {}}
            headingRef={questionHeadingRef}
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
              {currentChecked && (currentChecked.explanation || currentChecked.explanationAvailable || currentQuestion.explanation_html || currentQuestion.explanation_available) && (
                <Button
                  variant="secondary"
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="text-sm"
                >
                  {showExplanation
                    ? 'Hide Explanation'
                    : currentQuestion.explanation_available
                      ? 'Show Step-by-Step'
                      : 'Show Explanation'}
                </Button>
              )}
              {currentChecked && !currentQuestion.explanation_html && !currentQuestion.explanation_available && (
                <span className="text-sm text-ink-faint italic">
                  No explanation available for this question
                </span>
              )}
              {currentChecked && !currentChecked.isCorrect && currentQuestion.answer_type === 'SPR' && (
                <span className="text-sm text-ink-muted">
                  {currentChecked.correctAnswers?.length > 0 && currentChecked.correctAnswers[0] !== '*'
                    ? `Correct answer: ${currentChecked.correctAnswers.join(' or ')}`
                    : 'See explanation for correct answer'}
                </span>
              )}
            </div>

            {/* Explanation display */}
            {showExplanation && currentQuestion.explanation_available && (
              <StepByStepExplanation
                questionId={String(currentQuestion.id)}
                passageHtml={currentQuestion.passage_html || null}
                promptHtml={currentQuestion.prompt_html || ''}
                choices={currentQuestion.choices || []}
              />
            )}
            {showExplanation && !currentQuestion.explanation_available && currentQuestion.explanation_html && (
              <div className="mt-4 p-4 bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800/30 rounded-lg">
                <h4 className="text-sm font-medium text-brand-900 dark:text-brand-200 mb-2">Explanation</h4>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-brand-800 dark:text-brand-200"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.explanation_html }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );

    // Passage panel content (highlightable, same UX as question prompt)
    const passagePanel = hasPassage ? (
      <div className="h-full overflow-auto p-6 bg-surface-card">
        <HighlightableText
          key={`passage-${currentQuestion.id}`}
          html={passageHtml}
          questionId={`passage-${currentQuestion.id}`}
        />
      </div>
    ) : null;

    // Bottom navigation bar
    const bottomNavBar = (
      <>
        {/* Collapsible Question Navigator - positioned in center of content area */}
        {showNav && (
          <div className="fixed bottom-16 left-1/2 lg:left-[calc(50%+8rem)] -translate-x-1/2 z-40 bg-surface-muted shadow-xl border border-edge rounded-t-xl max-h-[50vh] overflow-hidden"
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
        <div className="fixed bottom-0 left-0 lg:left-[60px] right-0 z-50 flex items-center justify-between px-6 py-3 border-t border-edge bg-surface-muted">
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
            aria-label="Open question navigator"
            aria-expanded={showNav}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-muted bg-surface-card rounded-lg hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <span className="font-semibold">{currentIndex + 1}</span>
            <span className="text-ink-faint">/</span>
            <span>{practiceQuestions.length}</span>
            <svg className={`w-4 h-4 transition-transform ${showNav ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>

          {/* Check Answer + Next grouped on the right */}
          <div className="flex items-center gap-2">
            {isAnswered && (
              <Button
                variant="secondary"
                onClick={handleCheckAnswer}
                className="min-w-[120px]"
              >
                Check Answer
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={currentIndex === practiceQuestions.length - 1}
              className="min-w-[100px]"
            >
              Next
            </Button>
          </div>
        </div>
      </>
    );

    return (
      <div className="h-screen flex flex-col bg-surface-card -m-4 lg:-m-6">
        {/* Custom Header with back button - sticky at top */}
        <header className="sticky top-0 z-30 h-14 bg-surface-muted border-b border-edge flex items-center justify-between px-6">
          {/* Left: Back button and skill name */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => { if (isAuthed) { setView('browse'); } else { goBack(); } }}
              aria-label="Back to question bank"
              className="p-2 hover:bg-surface-card rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <ArrowLeft className="h-5 w-5 text-ink-muted" />
            </button>
            {!focusMode && (
              <div>
                <span className="text-sm font-medium text-ink-body">{selectedSkill?.name || 'Practice'}</span>
                {selectedDomain?.name && <span className="text-xs text-ink-subtle ml-2">({selectedDomain.name})</span>}
              </div>
            )}
          </div>

          {/* Center: Question count */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-subtle">Question</span>
            <span className="font-semibold text-ink-body">
              {currentIndex + 1} of {practiceQuestions.length}
            </span>
          </div>

          {/* Right: Bookmark, Focus, Draw, Reference Sheet (math), Calculator (math) */}
          <div className="flex items-center gap-2">
            {isAuthed && !isTutor && currentQuestion && (
              <button
                onClick={() => toggleBookmark(currentQuestion.id)}
                className="p-2 rounded-lg text-ink-muted transition-colors hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label={bookmarkSet.has(currentQuestion.id) ? 'Remove bookmark' : 'Save question'}
                title={bookmarkSet.has(currentQuestion.id) ? 'Saved' : 'Save'}
              >
                <Star className={`h-5 w-5 ${bookmarkSet.has(currentQuestion.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
              </button>
            )}
            <button
              onClick={() => setFocusMode((f) => !f)}
              className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                focusMode ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-surface-card'
              }`}
              aria-pressed={focusMode}
              aria-label={focusMode ? 'Exit focus mode' : 'Focus mode (for screen sharing)'}
              title={focusMode ? 'Exit focus mode' : 'Focus mode (for screen sharing)'}
            >
              {focusMode ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setIsDrawing((d) => !d)}
              className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                isDrawing
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-muted hover:bg-surface-card'
              }`}
              aria-pressed={isDrawing}
              aria-label={isDrawing ? 'Stop drawing' : 'Draw on question'}
              title={isDrawing ? 'Stop drawing' : 'Draw on question'}
            >
              <Pencil className="h-5 w-5" />
            </button>
            {subjectArea === 'math' && (
              <>
                <button
                  onClick={() => setShowReferenceSheet(!showReferenceSheet)}
                  className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    showReferenceSheet
                      ? 'bg-brand-600 text-white'
                      : 'text-ink-muted hover:bg-surface-card'
                  }`}
                  aria-pressed={showReferenceSheet}
                  aria-label="Reference Sheet"
                  title="Reference Sheet"
                >
                  <FileText className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setShowCalculator(!showCalculator)}
                  className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    showCalculator
                      ? 'bg-brand-600 text-white'
                      : 'text-ink-muted hover:bg-surface-card'
                  }`}
                  aria-pressed={showCalculator}
                  aria-label="Calculator"
                  title="Calculator"
                >
                  <Calculator className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main content - shifts right when calculator is open; larger type in focus mode */}
        <div className={`flex-1 transition-all duration-300 bg-surface-card ${showCalculator ? 'mr-[440px]' : ''} ${hasPassage ? 'overflow-hidden' : 'overflow-y-auto'} ${focusMode ? 'text-lg [&_.prose]:prose-lg' : ''}`}>
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

        {/* Drawing canvas overlay */}
        <DrawingCanvas
          isActive={isDrawing}
          questionId={currentQuestion?.id ?? currentIndex}
        />

        {/* Fixed bottom navigation bar */}
        {bottomNavBar}
      </div>
    );
  };

  // ----- Filterable browser view (authenticated) -----
  const STATUS_ICON = { correct: CheckCircle2, incorrect: XCircle, untried: Circle };
  const DIFF_LABEL = { E: 'Easy', M: 'Medium', H: 'Hard' };

  const renderBrowseView = () => {
    const skillOptions = allSkills.filter(
      (s) => !filters.domain_id || String(s.domain_id) === String(filters.domain_id)
    );
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold text-ink-body">Question Bank</h1>
          {!isTutor && (
            <Button variant="secondary" size="sm" onClick={() => practiceFromBrowse()}>
              Practice these
            </Button>
          )}
        </div>

        {/* Progress strip + quick chips (students only) */}
        {!isTutor && bankStats && (
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-edge bg-surface-muted/40 px-4 py-3 text-sm">
            <span className="text-ink-muted">
              <span className="font-semibold text-ink-body">{bankStats.distinct_questions_attempted}</span> attempted
            </span>
            {bankStats.accuracy != null && (
              <span className="text-ink-muted">
                <span className="font-semibold text-ink-body">{bankStats.accuracy}%</span> accuracy
              </span>
            )}
            <button onClick={() => setFilters((f) => ({ ...f, status: 'incorrect', bookmarked: false }))}
              className="font-medium text-brand-700 hover:underline dark:text-brand-300">Review what I got wrong</button>
            <button onClick={() => setFilters((f) => ({ ...f, bookmarked: true, status: '' }))}
              className="font-medium text-brand-700 hover:underline dark:text-brand-300">Saved ({bankStats.bookmarks})</button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
          {/* Filters rail */}
          <aside className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="search" placeholder="Search questions"
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                className="w-full rounded-lg border border-edge bg-surface-input py-2 pl-9 pr-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Difficulty</p>
              <div className="flex gap-1.5">
                {['E', 'M', 'H'].map((d) => (
                  <button key={d}
                    onClick={() => setFilters((f) => ({ ...f, difficulty: f.difficulty === d ? '' : d }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      filters.difficulty === d ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted hover:bg-edge-subtle'
                    }`}>{DIFF_LABEL[d]}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Skill</p>
              <select
                value={filters.skill_id}
                onChange={(e) => setFilters((f) => ({ ...f, skill_id: e.target.value }))}
                className="w-full rounded-lg border border-edge bg-surface-input px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <option value="">All skills</option>
                {skillOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {!isTutor && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Status</p>
                <div className="flex flex-col gap-1">
                  {[['', 'All'], ['unattempted', 'Unattempted'], ['incorrect', 'Got wrong'], ['correct', 'Got right']].map(([v, label]) => (
                    <button key={v}
                      onClick={() => setFilters((f) => ({ ...f, status: v }))}
                      className={`rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                        filters.status === v ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted hover:bg-edge-subtle'
                      }`}>{label}</button>
                  ))}
                </div>
              </div>
            )}
            {(filters.difficulty || filters.skill_id || filters.status || filters.bookmarked || filters.q) && (
              <button
                onClick={() => setFilters({ difficulty: '', skill_id: '', domain_id: '', status: '', bookmarked: false, q: '' })}
                className="text-xs text-ink-muted hover:text-ink-body underline">Clear filters</button>
            )}
          </aside>

          {/* Results */}
          <div>
            {/* Tutor assign bar */}
            {isTutor && selectedForAssign.size > 0 && (
              <div className="mb-3 flex items-center justify-between rounded-lg border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm dark:border-brand-800/50 dark:bg-brand-900/20">
                <span className="font-medium text-ink-body">{selectedForAssign.size} selected</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedForAssign(new Set())} className="text-ink-muted hover:text-ink-body">Clear</button>
                  <Button variant="primary" size="sm" onClick={assignSelected}>Assign to student</Button>
                </div>
              </div>
            )}

            {browseLoading ? (
              <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
            ) : browseItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-edge px-4 py-12 text-center text-sm text-ink-subtle">
                {filters.status === 'incorrect' ? "You haven't missed any questions matching this filter."
                  : filters.bookmarked ? "No saved questions yet."
                  : "Nothing matches these filters."}
              </p>
            ) : (
              <ul className="space-y-2">
                {browseItems.map((item) => {
                  const StatusI = STATUS_ICON[item.status] || Circle;
                  const statusCls = item.status === 'correct' ? 'text-accent-600 dark:text-accent-300'
                    : item.status === 'incorrect' ? 'text-rose-500' : 'text-ink-faint';
                  const isBm = bookmarkSet.has(item.id);
                  return (
                    <Card key={item.id} className="flex items-start gap-3 p-4 transition-colors hover:bg-surface-muted">
                      {isTutor && (
                        <input type="checkbox" checked={selectedForAssign.has(item.id)}
                          onChange={() => toggleAssignSelect(item.id)}
                          className="mt-1 h-4 w-4 rounded border-edge text-brand-600 focus:ring-brand-500" />
                      )}
                      {!isTutor && <StatusI className={`mt-0.5 h-4 w-4 shrink-0 ${statusCls}`} />}
                      <button onClick={() => practiceFromBrowse(item.id)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm text-ink-body">{item.prompt_snippet}</p>
                        <p className="mt-1 flex items-center gap-2 text-xs text-ink-subtle">
                          {item.skill && <span>{item.skill}</span>}
                          {item.difficulty && <Badge size="sm">{DIFF_LABEL[item.difficulty] || item.difficulty}</Badge>}
                        </p>
                      </button>
                      {!isTutor && (
                        <button onClick={() => toggleBookmark(item.id)} aria-label={isBm ? 'Remove bookmark' : 'Save question'}
                          className="shrink-0 rounded-md p-1.5 hover:bg-surface-input">
                          <Star className={`h-4 w-4 ${isBm ? 'fill-amber-400 text-amber-400' : 'text-ink-faint'}`} />
                        </button>
                      )}
                    </Card>
                  );
                })}
              </ul>
            )}

            {/* Pagination */}
            {browseTotal > BROWSE_LIMIT && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <Button variant="secondary" size="sm" disabled={browseOffset === 0}
                  onClick={() => loadBrowse(Math.max(0, browseOffset - BROWSE_LIMIT))}>Previous</Button>
                <span className="text-ink-subtle">
                  {browseOffset + 1}–{Math.min(browseOffset + BROWSE_LIMIT, browseTotal)} of {browseTotal}
                </span>
                <Button variant="secondary" size="sm" disabled={browseOffset + BROWSE_LIMIT >= browseTotal}
                  onClick={() => loadBrowse(browseOffset + BROWSE_LIMIT)}>Next</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (isLoading && !isAuthed) {
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
  if (isAuthed) {
    return renderBrowseView();
  }
  return renderDomainsView();
};

export default QuestionBankPage;
