/**
 * Question Bank Browser
 * Hierarchical browser: Domains → Skills → Practice Mode (same UI as assignments)
 * Used by both tutors and students
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronRight,
  Book,
  Calculator,
  ArrowLeft,
  ArrowRight,
  FileText,
  Pencil,
  Star,
  Maximize2,
  Minimize2,
  Sparkles,
  History,
  XCircle,
  Layers,
} from 'lucide-react';
import { Button, LoadingSpinner, PageHeader, Section, Surface } from '../../components/ui';
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

const DIFF_LABEL = { E: 'Easy', M: 'Medium', H: 'Hard' };

const QuestionBankPage = ({ userRole = 'student', isPublic = false }) => {
  // Authenticated users get persistent progress + bookmarks + the practice
  // options step. Public/logged-out goes straight from skill → practice.
  const isAuthed = !isPublic && (() => {
    try { return !!localStorage.getItem('accessToken'); } catch { return false; }
  })();
  const isTutor = isAuthed && userRole === 'tutor';

  // Navigation state: 'domains' (tree) → 'options' (how to practice) → 'practice'.
  const [view, setView] = useState('domains');
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [expandedDomains, setExpandedDomains] = useState(new Set());

  // Per-student bookmarks (authed)
  const [bookmarkSet, setBookmarkSet] = useState(new Set());

  // Options-step difficulty selection
  const [optDifficulty, setOptDifficulty] = useState('');

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

  // Load this student's bookmark ids on mount (authed only).
  useEffect(() => {
    if (!isAuthed) return;
    questionService.listBookmarks()
      .then((r) => setBookmarkSet(new Set(r.data.question_ids || [])))
      .catch(() => {});
  }, [isAuthed]);

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Start a practice run for the selected skill with the chosen options.
  //   mode: 'new' | 'old' | 'wrong' | 'saved' | 'all'
  //   difficulty: '' | 'E' | 'M' | 'H'
  const startPractice = async (skill, domain, { mode = 'all', difficulty = '' } = {}) => {
    setSelectedSkill(skill);
    setSelectedDomain(domain);
    setIsLoadingQuestions(true);
    setAnswers({}); setCheckedAnswers({}); setShowExplanation(false);
    setCurrentIndex(0); setMarkedForReview(new Set());
    try {
      const params = { skill_id: skill.id, limit: 100 };
      if (difficulty) params.difficulty = difficulty;
      // Per-student modes go through the authed browse endpoint (which knows
      // attempted/correct/bookmarked); plain modes use the public detail list.
      let ids = null;
      if (isAuthed && mode !== 'all' && mode !== 'new') {
        const statusMap = { old: 'attempted', wrong: 'incorrect' };
        const bp = { skill_id: skill.id, limit: 100 };
        if (difficulty) bp.difficulty = difficulty;
        if (mode === 'saved') bp.bookmarked = true;
        else if (statusMap[mode]) bp.status = statusMap[mode];
        const br = await questionService.bankBrowse(bp);
        ids = new Set((br.data.items || []).map((i) => i.id));
        if (ids.size === 0) {
          alert(mode === 'wrong' ? "You haven't missed any questions here yet."
            : mode === 'saved' ? 'No saved questions for this skill yet.'
            : 'No questions match.');
          setIsLoadingQuestions(false); return;
        }
      }

      const res = await questionService.getQuestionsWithDetails(params);
      let questions = res.data.items || [];
      if (ids) questions = questions.filter((q) => ids.has(q.id));
      if (mode === 'new' && isAuthed) {
        // "New" = exclude attempted; ask browse for unattempted ids.
        const br = await questionService.bankBrowse({ skill_id: skill.id, status: 'unattempted', limit: 100, ...(difficulty ? { difficulty } : {}) });
        const fresh = new Set((br.data.items || []).map((i) => i.id));
        questions = questions.filter((q) => fresh.has(q.id));
      }
      if (questions.length === 0) { alert('No questions found for this skill'); setIsLoadingQuestions(false); return; }
      questions = shuffle(questions);

      setPracticeQuestions(questions.map((q, idx) => ({
        id: q.id, order: idx + 1, prompt_html: q.prompt_html, passage_html: q.passage_html,
        answer_type: q.answer_type || 'MCQ',
        choices_json: q.choices ? q.choices.map((c) => c.content) : [],
        choices: q.choices || [], correct_answer: q.correct_answer,
        explanation_html: q.explanation_html, explanation_available: q.explanation_available || false,
        difficulty: q.difficulty, subject_area: q.subject_area || domain?.subject_area || 'math',
      })));
      setView('practice');
    } catch (err) {
      console.error('Failed to load practice set:', err);
      alert('Failed to load questions. Please try again.');
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const toggleBookmark = useCallback(async (questionId) => {
    const has = bookmarkSet.has(questionId);
    setBookmarkSet((prev) => {
      const next = new Set(prev);
      if (has) next.delete(questionId); else next.add(questionId);
      return next;
    });
    try {
      if (has) await questionService.removeBookmark(questionId);
      else await questionService.addBookmark(questionId);
    } catch {
      setBookmarkSet((prev) => {
        const next = new Set(prev);
        if (has) next.add(questionId); else next.delete(questionId);
        return next;
      });
    }
  }, [bookmarkSet]);

  // Render domains view — Study Hall design language.
  const renderDomainsView = () => (
    <div className="mx-auto max-w-3xl pb-10">
      <PageHeader
        eyebrow="Practice library"
        title="Question Bank"
        subtitle="Pick a domain, choose a skill, then practice exactly the questions you want."
      />

      {/* Loading overlay for question loading */}
      {isLoadingQuestions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" role="alert" aria-busy="true">
          <div className="bg-surface-card p-6 rounded-2xl shadow-card-md flex items-center gap-4">
            <LoadingSpinner />
            <span className="text-ink-muted">Loading questions…</span>
          </div>
        </div>
      )}

      <div className="space-y-10">
        {['math', 'reading_writing'].map((subject) => {
          const SubjectIcon = subjectIcons[subject];
          const subjectDomains = domainsBySubject[subject] || [];
          if (subjectDomains.length === 0) return null;
          const totalQs = subjectDomains.reduce((sum, d) => sum + (d.question_count || 0), 0);

          return (
            <Section
              key={subject}
              title={subject === 'math' ? 'Math' : 'Reading & Writing'}
              icon={SubjectIcon}
              hint={`${totalQs.toLocaleString()} questions`}
            >
              <div className="space-y-2">
                {subjectDomains.map((domain) => {
                  const open = expandedDomains.has(domain.id);
                  const skills = skillsByDomain[domain.id] || [];
                  return (
                    <Surface key={domain.id} padded={false} className="overflow-hidden rounded-xl">
                      {/* Domain header */}
                      <button
                        onClick={() => toggleDomain(domain.id)}
                        aria-expanded={open}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <ChevronRight className={`h-4 w-4 shrink-0 text-ink-faint transition-transform ${open ? 'rotate-90' : ''}`} />
                          <span className="truncate font-medium text-ink-body">{domain.name}</span>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-ink-faint">
                          {domain.question_count || 0}
                        </span>
                      </button>

                      {/* Skills as chips */}
                      {open && (
                        <div className="border-t border-edge-subtle bg-surface-muted/40 px-4 py-3">
                          {isLoadingSkills[domain.id] ? (
                            <div className="flex items-center justify-center py-3">
                              <LoadingSpinner size="sm" />
                            </div>
                          ) : skills.length === 0 ? (
                            <p className="py-1 text-sm text-ink-faint">No skills found</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {skills.map((skill) => (
                                <button
                                  key={skill.id}
                                  onClick={() => {
                                    setSelectedSkill(skill);
                                    setSelectedDomain(domain);
                                    if (isAuthed) setView('options');
                                    else startPractice(skill, domain, { mode: 'all' });
                                  }}
                                  disabled={isLoadingQuestions}
                                  className="group inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface-card px-3 py-1.5 text-sm text-ink-body transition-colors hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-brand-900/20"
                                >
                                  <span>{skill.name}</span>
                                  {skill.question_count != null && (
                                    <span className="text-xs tabular-nums text-ink-faint">{skill.question_count}</span>
                                  )}
                                  <ChevronRight className="h-3 w-3 text-ink-faint transition-transform group-hover:translate-x-0.5" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Surface>
                  );
                })}
              </div>
            </Section>
          );
        })}
      </div>
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

  // ----- Options step: how to practice this skill (authed) -----
  const renderOptionsView = () => {
    const go = (mode) => startPractice(selectedSkill, selectedDomain, { mode, difficulty: optDifficulty });
    const Tile = ({ icon: Icon, title, desc, mode, primary }) => (
      <Surface
        as="button"
        onClick={() => go(mode)}
        disabled={isLoadingQuestions}
        glow={primary ? 'brand' : false}
        className={`flex w-full items-center gap-3.5 rounded-xl p-4 text-left transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          primary ? '' : 'hover:bg-surface-muted'
        }`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          primary ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted'
        }`}>
          <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-ink-body">{title}</span>
          <span className="block text-sm text-ink-subtle">{desc}</span>
        </span>
        <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-ink-faint" />
      </Surface>
    );
    return (
      <div className="mx-auto max-w-xl pb-10">
        <button
          onClick={() => setView('domains')}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-subtle transition-colors hover:text-ink-body"
        >
          <ArrowLeft className="h-4 w-4" /> Skills
        </button>

        <PageHeader
          eyebrow={selectedDomain?.name || 'Practice'}
          title={selectedSkill?.name || 'Practice'}
          subtitle="How would you like to practice this skill?"
        />

        {/* Difficulty (optional, applies to all modes) */}
        <Section title="Difficulty" hint="optional">
          <div className="flex gap-2">
            {['E', 'M', 'H'].map((d) => (
              <button key={d}
                onClick={() => setOptDifficulty((cur) => (cur === d ? '' : d))}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  optDifficulty === d ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted hover:bg-edge-subtle'
                }`}>{DIFF_LABEL[d]}</button>
            ))}
          </div>
        </Section>

        {/* How to practice */}
        <Section className="mt-8" title="Practice mode">
          <div className="space-y-2.5">
            <Tile icon={Sparkles} title="New questions" desc="Questions you haven't tried yet, shuffled." mode="new" primary />
            <Tile icon={History} title="Review old questions" desc="Questions you've answered before." mode="old" />
            <Tile icon={XCircle} title="Questions I got wrong" desc="Just the ones you missed in this skill." mode="wrong" />
            <Tile icon={Star} title="Saved questions" desc="Your bookmarked questions in this skill." mode="saved" />
            <Tile icon={Layers} title="All questions" desc="Everything in this skill, shuffled." mode="all" />
          </div>
        </Section>
      </div>
    );
  };

  // Loading state
  if (isLoading && view === 'domains') {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Render based on view
  if (view === 'practice') return renderPracticeView();
  if (view === 'options' && isAuthed) return renderOptionsView();
  return renderDomainsView();
};

export default QuestionBankPage;
