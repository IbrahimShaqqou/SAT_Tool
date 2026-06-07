/**
 * Lesson Viewer Page
 * Beautiful, engaging lesson content viewer
 * Supports rich content with sections, examples, tips, and more
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  Play,
  ChevronDown,
} from 'lucide-react';
import { Button, LoadingSpinner, Badge } from '../../components/ui';
import { lessonService } from '../../services';
import katex from 'katex';
import parseMarkdown from '../../utils/parseMarkdown';
import computeBoundsFromEquations from '../../utils/computeBounds';

const LessonViewerPage = ({ isPublic = false }) => {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const startTimeRef = useRef(Date.now());

  const [lesson, setLesson] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Determine the base path based on context (tutor, student, or public)
  const isTutorRoute = location.pathname.startsWith('/tutor');
  const lessonsPath = isPublic ? '/lessons' : isTutorRoute ? '/tutor/lessons' : '/student/lessons';

  useEffect(() => {
    const fetchLesson = async () => {
      setIsLoading(true);
      try {
        // Use public endpoint if isPublic, otherwise use authenticated endpoint
        const response = isPublic
          ? await lessonService.getPublicLesson(lessonId)
          : await lessonService.getLesson(lessonId);
        setLesson(response.data);
      } catch (err) {
        console.error('Failed to fetch lesson:', err);
        setError('Failed to load lesson');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLesson();
    startTimeRef.current = Date.now();
  }, [lessonId, isPublic]);

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      await lessonService.markComplete(lessonId, {
        timeSpentSeconds: timeSpent,
        progressPercent: 100,
      });
      setLesson(prev => ({ ...prev, is_completed: true }));
    } catch (err) {
      console.error('Failed to mark complete:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  const handlePractice = () => {
    // Tutors go to question bank, students go to adaptive practice
    if (isTutorRoute) {
      navigate('/tutor/questions');
    } else if (lesson?.skill_id) {
      // Direct start infinite practice for this skill
      navigate(`/student/adaptive?skill=${lesson.skill_id}&autostart=true`);
    } else {
      // Fallback to setup page if no skill ID
      navigate('/student/adaptive');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="text-center py-12">
        <p className="text-rose-600 dark:text-rose-400">{error || 'Lesson not found'}</p>
        <Button onClick={() => navigate(-1)} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const content = lesson.content || {};
  const sections = content.sections || [];
  const satTips = content.sat_tips || [];

  // Process sections to group solution types into a grid
  const processedSections = processSectionsForGrid(sections);

  return (
    <div className="max-w-4xl mx-auto pb-24 bg-surface-card rounded-2xl shadow-card px-8 py-7 -mt-2">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(lessonsPath)}
          className="flex items-center gap-2 text-ink-subtle hover:text-ink-body mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Lessons
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="info" className="mb-2">{lesson.skill_code}</Badge>
            <h1 className="text-3xl font-bold text-ink-body mb-2">
              {lesson.title}
            </h1>
            {lesson.subtitle && (
              <p className="text-lg text-ink-muted">
                {lesson.subtitle}
              </p>
            )}
          </div>

          {lesson.is_completed && (
            <div className="flex items-center gap-2 px-3 py-2 bg-accent-100 dark:bg-accent-900/30 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-accent-600 dark:text-accent-400" />
              <span className="text-sm font-medium text-accent-700 dark:text-accent-400">
                Completed
              </span>
            </div>
          )}
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-4 mt-4 text-sm text-ink-subtle">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {lesson.estimated_minutes} min read
          </span>
          <Badge variant={
            lesson.difficulty_level === 'beginner' ? 'success' :
            lesson.difficulty_level === 'advanced' ? 'danger' : 'warning'
          }>
            {lesson.difficulty_level}
          </Badge>
          <span>{lesson.domain_name}</span>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="space-y-6 mb-8">
        {processedSections.map((section, index) => (
          <LessonSection key={section.id || index} section={section} />
        ))}
      </div>

      {/* SAT Tips - with normal bullet points */}
      {satTips.length > 0 && (
        <div className="mb-8 p-6 bg-brand-50 dark:bg-brand-900/20 rounded-2xl border border-brand-200 dark:border-brand-800/50">
          <h2 className="text-lg font-bold text-brand-800 dark:text-brand-300 mb-4">
            SAT Tips
          </h2>
          <ul className="space-y-2 list-disc list-inside text-ink-body">
            {satTips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Lesson Complete CTA — appears after marking complete */}
      {!isPublic && !isTutorRoute && lesson.is_completed && lesson.skill_id && (
        <div className="mb-8 rounded-2xl overflow-hidden border border-brand-200 dark:border-brand-800">
          <div className="bg-brand-50 dark:bg-brand-900/20 px-6 py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-brand-600 dark:text-brand-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-brand-900 dark:text-brand-100">Lesson complete!</p>
                <p className="text-sm text-brand-700 dark:text-brand-300 mt-0.5">Ready to practice? Apply what you just learned.</p>
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={handlePractice} className="flex-shrink-0">
              <Play className="h-4 w-4 mr-1.5" />
              Practice {lesson.skill_name || 'This Skill'}
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface-card border-t border-edge p-4 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="secondary"
            onClick={() => navigate(lessonsPath)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            All Lessons
          </Button>

          <div className="flex items-center gap-3">
            {/* Only show Mark Complete for authenticated users */}
            {!isPublic && !lesson.is_completed && (
              <Button
                variant="primary"
                onClick={handleComplete}
                loading={isCompleting}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Complete
              </Button>
            )}
            {/* Practice button - redirect to login for public users */}
            {isPublic ? (
              <Button
                variant="primary"
                onClick={() => navigate('/login')}
              >
                <Play className="h-4 w-4 mr-2" />
                Log In to Practice
              </Button>
            ) : (
              <Button
                variant={lesson.is_completed ? 'primary' : 'secondary'}
                onClick={handlePractice}
              >
                <Play className="h-4 w-4 mr-2" />
                Practice This Skill
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Process sections to group solution types (one/no/infinite solutions) into a grid
 */
const processSectionsForGrid = (sections) => {
  const processed = [];
  let i = 0;

  // Build lookup of all sections by id for finding items that may appear before the trigger
  const sectionById = {};
  sections.forEach(s => { sectionById[s.id] = s; });

  // Track which section ids get consumed into the grid so we skip them
  const consumedIds = new Set();

  while (i < sections.length) {
    const section = sections[i];

    // Skip sections already consumed into the grid
    if (consumedIds.has(section.id)) {
      i++;
      continue;
    }

    // Check if this is the "three-cases-intro" trigger
    if (section.id === 'three-cases-intro') {
      const caseIds = ['case-1', 'case-2', 'case-3'];
      const imageIds = ['one-solution-image', 'no-solution-image', 'infinite-solution-image'];

      // Search the entire sections array for the needed items
      const caseMap = {};
      const imageMap = {};

      for (const s of sections) {
        if (caseIds.includes(s.id)) caseMap[s.id] = s;
        if (imageIds.includes(s.id)) imageMap[s.id] = s;
      }

      // Build grid items if we have all three cases and images
      if (Object.keys(caseMap).length === 3 && Object.keys(imageMap).length === 3) {
        // Mark all consumed sections so they get skipped
        [...caseIds, ...imageIds].forEach(id => consumedIds.add(id));

        // Remove any already-processed sections that were consumed (e.g. one-solution-image before trigger)
        for (let p = processed.length - 1; p >= 0; p--) {
          if (consumedIds.has(processed[p].id)) {
            processed.splice(p, 1);
          }
        }

        // Add intro section
        processed.push(section);

        // Add grid section
        processed.push({
          id: 'solution-types-grid',
          type: 'solution-types-grid',
          items: [
            {
              title: 'One Solution',
              image: imageMap['one-solution-image'],
              text: caseMap['case-1'],
            },
            {
              title: 'No Solution',
              image: imageMap['no-solution-image'],
              text: caseMap['case-2'],
            },
            {
              title: 'Infinite Solutions',
              image: imageMap['infinite-solution-image'],
              text: caseMap['case-3'],
            },
          ],
        });

        // Skip past consumed sections after the trigger
        let j = i + 1;
        while (j < sections.length && consumedIds.has(sections[j].id)) {
          j++;
        }

        // Add the infinite tip if it exists right after
        if (j < sections.length && sections[j].id === 'infinite-tip') {
          processed.push(sections[j]);
          j++;
        }

        i = j;
        continue;
      }
    }

    processed.push(section);
    i++;
  }

  return processed;
};

/**
 * Render a lesson section based on its type
 */
const LessonSection = ({ section }) => {
  const type = section.type;

  // Solution types grid (3-column layout)
  if (type === 'solution-types-grid') {
    return (
      <div className="my-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {section.items.map((item, index) => (
            <div key={index} className="flex flex-col bg-surface-muted rounded-xl p-4">
              {/* Title */}
              <h4 className="font-semibold text-ink-body mb-2 text-center">
                {item.title}
              </h4>
              {/* Image - 1.5x taller for better visibility */}
              <div className="rounded-lg border border-edge overflow-hidden bg-white mb-3">
                <img
                  src={item.image.url}
                  alt={item.image.alt || item.title}
                  className="w-full h-auto max-h-80 object-contain"
                />
              </div>
              {/* Caption */}
              <p className="text-xs text-ink-subtle text-center mb-2">
                {item.image.caption}
              </p>
              {/* Text */}
              <div
                className="text-ink-muted text-sm"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(item.text.content) }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Tip - blue box with icon
  if (type === 'tip') {
    return (
      <div className="p-5 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-200 dark:border-brand-800/50">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5" />
          <div>
            {section.title && (
              <h3 className="font-semibold text-brand-800 dark:text-brand-300 mb-1">
                {section.title}
              </h3>
            )}
            <div
              className="text-ink-body"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(section.content) }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Warning - red/orange box with icon
  if (type === 'warning') {
    return (
      <div className="p-5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            {section.title && (
              <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                {section.title}
              </h3>
            )}
            <div
              className="text-amber-900 dark:text-amber-100"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(section.content) }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Image - smaller size (max-w-xs for half size)
  if (type === 'image') {
    return (
      <div className="my-6">
        {section.title && (
          <h3 className="text-lg font-semibold text-ink-body mb-3">
            {section.title}
          </h3>
        )}
        <div className="flex justify-center">
          <div className="rounded-xl border border-edge overflow-hidden bg-surface-card inline-block max-w-xs">
            <img
              src={section.url}
              alt={section.alt || section.title || 'Lesson illustration'}
              className="max-w-full h-auto"
            />
            {section.caption && (
              <p className="text-center text-sm text-ink-muted py-2 px-3 bg-surface-muted border-t border-edge">
                {section.caption}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Worked example - interactive with answer selection
  if (type === 'worked-example') {
    return <InteractiveExample section={section} />;
  }

  // Divider/section header
  if (type === 'divider') {
    return (
      <div className="my-8 pt-6 border-t-2 border-edge">
        <h2 className="text-2xl font-bold text-ink-body">
          {section.title}
        </h2>
      </div>
    );
  }

  // Summary section
  if (type === 'summary') {
    return (
      <div className="my-6 p-6 bg-accent-50 dark:bg-accent-900/20 rounded-xl border border-accent-200 dark:border-accent-800">
        <h3 className="text-lg font-semibold text-accent-800 dark:text-accent-300 mb-4">
          {section.title}
        </h3>
        <ul className="space-y-2">
          {section.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-accent-600 dark:text-accent-400 flex-shrink-0 mt-0.5" />
              <span
                className="text-accent-900 dark:text-accent-100"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(item) }}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Default: concept or regular text - NO border, just flowing content
  return (
    <div className="my-4">
      {section.title && (
        <h3 className="text-xl font-semibold text-ink-body mb-3">
          {section.title}
        </h3>
      )}
      <div
        className="text-ink-muted leading-relaxed"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(section.content) }}
      />
    </div>
  );
};

/**
 * Interactive Example Component
 * Shows question with answer options, lets user select and check answer
 * Includes embedded Desmos calculator in explanation
 */
const InteractiveExample = ({ section }) => {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const desmosRef = useRef(null);
  const calculatorRef = useRef(null);

  const hasOptions = section.options && section.options.length > 0;
  const isCorrect = selectedAnswer !== null && section.options?.[selectedAnswer]?.correct;

  // Use custom desmos_equations if provided, otherwise extract from problem
  const getEquations = () => {
    if (section.desmos_equations && section.desmos_equations.length > 0) {
      return section.desmos_equations;
    }
    // Fallback: Extract equations from the problem
    const equations = [];
    const displayMathRegex = /\$\$([^$]+)\$\$/g;
    let match;
    while ((match = displayMathRegex.exec(section.problem)) !== null) {
      let eq = match[1].trim();
      eq = eq.replace(/\\text\{[^}]*\}/g, '');
      eq = eq.replace(/\\Rightarrow.*$/, '');
      eq = eq.replace(/\\begin\{aligned\}/g, '');
      eq = eq.replace(/\\end\{aligned\}/g, '');
      eq = eq.replace(/&/g, '');
      // Split by \\ for multiple equations
      const parts = eq.split('\\\\').map(p => p.trim()).filter(p => p.includes('='));
      equations.push(...parts);
    }

    // Replace non-x/y variables with x and y so Desmos can graph them
    // Find all single-letter variables used (excluding x and y)
    const allVars = new Set();
    equations.forEach(eq => {
      const vars = eq.match(/(?<![a-zA-Z])[a-zA-Z](?![a-zA-Z])/g) || [];
      vars.forEach(v => { if (v !== 'x' && v !== 'y') allVars.add(v); });
    });

    if (allVars.size > 0 && allVars.size <= 2) {
      const varsArr = [...allVars].sort();
      const mapping = {};
      // Map first variable to x, second to y
      if (varsArr.length >= 1) mapping[varsArr[0]] = 'x';
      if (varsArr.length >= 2) mapping[varsArr[1]] = 'y';

      return equations.map(eq => {
        let result = eq;
        for (const [from, to] of Object.entries(mapping)) {
          // Replace variable but not when part of a longer word
          result = result.replace(new RegExp(`(?<![a-zA-Z])${from}(?![a-zA-Z])`, 'g'), to);
        }
        return result;
      });
    }

    return equations;
  };

  const equations = getEquations();
  const showDesmos = equations.length > 0;

  // Initialize Desmos when explanation is shown
  useEffect(() => {
    if (showExplanation && showDesmos && desmosRef.current && !calculatorRef.current) {
      // Load Desmos API if not already loaded
      if (!window.Desmos) {
        const script = document.createElement('script');
        const desmosKey = process.env.REACT_APP_DESMOS_API_KEY || 'dcb31709b452b1cf9dc26972add0fda6';
        script.src = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${desmosKey}`;
        script.async = true;
        script.onload = () => initDesmos();
        document.body.appendChild(script);
      } else {
        initDesmos();
      }
    }

    function initDesmos() {
      if (desmosRef.current && window.Desmos) {
        calculatorRef.current = window.Desmos.GraphingCalculator(desmosRef.current, {
          expressions: true,
          settingsMenu: false,
          zoomButtons: true,
          expressionsTopbar: false,
          pointsOfInterest: true,
          trace: true,
        });

        // Add equations
        equations.forEach((eq, i) => {
          calculatorRef.current.setExpression({ id: `eq${i}`, latex: eq });
        });

        // Compute appropriate viewport bounds
        const bounds = section.desmos_bounds || computeBoundsFromEquations(equations);
        calculatorRef.current.setMathBounds(bounds);
      }
    }

    return () => {
      if (calculatorRef.current) {
        calculatorRef.current.destroy();
        calculatorRef.current = null;
      }
    };
  }, [showExplanation, showDesmos, equations, section.desmos_bounds]);

  const handleCheckAnswer = () => {
    if (selectedAnswer !== null) {
      setShowResult(true);
    }
  };

  const handleTryAgain = () => {
    setSelectedAnswer(null);
    setShowResult(false);
    setShowExplanation(false);
  };

  return (
    <div className="my-6 bg-surface-card rounded-xl border border-edge overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-brand-600">
        <h3 className="text-white font-semibold">
          {section.title}
        </h3>
        {section.source && (
          <span className="text-brand-100 text-sm">{section.source}</span>
        )}
      </div>

      {/* Problem */}
      <div className="p-5">
        <div
          className="text-ink-body mb-6"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(section.problem) }}
        />

        {/* Answer Options */}
        {hasOptions && (
          <div className="space-y-3 mb-4">
            {section.options.map((opt, index) => {
              const letter = String.fromCharCode(65 + index); // A, B, C, D
              const isSelected = selectedAnswer === index;
              const showCorrect = showResult && opt.correct;
              const showIncorrect = showResult && isSelected && !opt.correct;

              return (
                <button
                  key={index}
                  onClick={() => !showResult && setSelectedAnswer(index)}
                  disabled={showResult}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                    showCorrect
                      ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/30'
                      : showIncorrect
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/30'
                      : isSelected
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                      : 'border-edge hover:border-edge-strong'
                  }`}
                >
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    showCorrect
                      ? 'bg-accent-500 text-white'
                      : showIncorrect
                      ? 'bg-rose-500 text-white'
                      : isSelected
                      ? 'bg-brand-500 text-white'
                      : 'bg-surface-muted text-ink-muted'
                  }`}>
                    {letter}
                  </span>
                  <span
                    className={`flex-1 ${
                      showCorrect
                        ? 'text-accent-800 dark:text-accent-200'
                        : showIncorrect
                        ? 'text-rose-800 dark:text-rose-200'
                        : 'text-ink-muted'
                    }`}
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(opt.text) }}
                  />
                  {showCorrect && (
                    <CheckCircle2 className="h-6 w-6 text-accent-600 dark:text-accent-400 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Check Answer / Try Again Buttons */}
        {hasOptions && (
          <div className="flex gap-3">
            {!showResult ? (
              <Button
                variant="primary"
                onClick={handleCheckAnswer}
                disabled={selectedAnswer === null}
              >
                Check Answer
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={handleTryAgain}>
                  Try Again
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setShowExplanation(!showExplanation)}
                >
                  {showExplanation ? 'Hide' : 'Show'} Explanation
                </Button>
              </>
            )}
          </div>
        )}

        {/* Result Message */}
        {showResult && (
          <div className={`mt-4 p-4 rounded-lg ${
            isCorrect
              ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-800 dark:text-accent-200'
              : 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200'
          }`}>
            {isCorrect ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Correct!</span>
              </div>
            ) : (
              <div>
                <span className="font-semibold">Not quite.</span>
                {section.options?.[selectedAnswer]?.explanation && (
                  <p className="mt-1 text-sm">
                    {section.options[selectedAnswer].explanation}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Explanation Section - only show when explicitly requested */}
      {showExplanation && (
        <div className="p-5 bg-brand-50 dark:bg-brand-900/20 border-t border-edge-subtle">
          {/* Steps */}
          {section.steps && section.steps.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-brand-800 dark:text-brand-300 mb-3">Solution:</h4>
              <div className="space-y-4">
                {section.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 bg-brand-100 dark:bg-brand-800 rounded-full flex items-center justify-center text-sm font-bold text-brand-700 dark:text-brand-200">
                      {step.step || i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-brand-900 dark:text-brand-100 mb-1">{step.description}</p>
                      {step.math && (
                        <div
                          className="text-lg"
                          dangerouslySetInnerHTML={{
                            __html: katex.renderToString(step.math, { displayMode: true, throwOnError: false })
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Embedded Desmos Calculator */}
          {showDesmos && (
            <div className="mb-4">
              <h4 className="font-semibold text-brand-800 dark:text-brand-300 mb-3">Graphing Calculator:</h4>
              <div
                ref={desmosRef}
                className="w-full h-80 rounded-lg border border-edge bg-white"
              />
              <p className="text-xs text-ink-subtle mt-2">
                The intersection point shows the solution. Click on it to see the coordinates!
              </p>
            </div>
          )}

          {/* Answer */}
          {section.answer && (
            <div className="mt-4 p-4 bg-accent-100 dark:bg-accent-900/30 rounded-lg">
              <span className="font-semibold text-accent-800 dark:text-accent-300">Answer: </span>
              <span
                className="text-accent-900 dark:text-accent-100"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(section.answer) }}
              />
            </div>
          )}

          {/* Tip */}
          {section.tip && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-ink-body">{section.tip}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Show Solution toggle - always available when explanation is hidden */}
      {!showExplanation && !showResult && (
        <div className="px-5 py-3 bg-surface-muted border-t border-edge">
          <button
            onClick={() => setShowExplanation(true)}
            className="w-full flex items-center justify-center gap-2 text-brand-700 dark:text-brand-400 font-medium hover:underline"
          >
            Show Solution
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default LessonViewerPage;
