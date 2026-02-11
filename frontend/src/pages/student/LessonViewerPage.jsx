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
import 'katex/dist/katex.min.css';
import katex from 'katex';

/**
 * Parse simple markdown to HTML
 * Supports: **bold**, *italic*, $math$, $$display math$$
 * Handles dollar amounts by requiring math to have letters/operators
 */
const parseMarkdown = (text) => {
  if (!text) return '';

  const placeholders = [];   // rendered HTML
  const mathSources = [];    // original math text (for inline math only)
  let html = text;

  // Helper to create a placeholder
  const addPlaceholder = (rendered, prefix, source) => {
    const placeholder = `__${prefix}_${placeholders.length}__`;
    placeholders.push(rendered);
    mathSources.push(source || '');
    return placeholder;
  };

  // 1. Bold **text** FIRST — prevents **$5** from being matched as math
  html = html.replace(/\*\*([^*]+)\*\*/g, (match) => {
    return addPlaceholder(match, 'BOLD');
  });

  // 2. Display math $$...$$ (before HTML escaping to preserve & in \begin{aligned})
  html = html.replace(/\$\$([^$]+)\$\$/g, (match, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
      return addPlaceholder(rendered, 'DMATH');
    } catch (e) {
      return match;
    }
  });

  // 3. Inline math $...$ — must contain letters/operators to be math (not dollar amounts)
  html = html.replace(/\$([^$]+)\$/g, (match, math) => {
    const looksLikeMath = /[a-zA-Z=+\-*/\\^_{}]/.test(math);
    if (!looksLikeMath) {
      return match; // Keep as-is (probably a dollar amount like $5)
    }
    try {
      const rendered = katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      return addPlaceholder(rendered, 'IMATH', math);
    } catch (e) {
      return match;
    }
  });

  // 4. Convert " and " between two inline math expressions into a stacked system
  //    Only stack when BOTH expressions are actual equations (contain "=")
  //    e.g. "$2x + y = 5$ and $x - y = 1$" → stacked display
  //    but "$x$ and $y$" stays inline
  html = html.replace(/__IMATH_(\d+)__\s+and\s+__IMATH_(\d+)__/g, (_match, idx1, idx2) => {
    const i1 = parseInt(idx1);
    const i2 = parseInt(idx2);
    const src1 = mathSources[i1] || '';
    const src2 = mathSources[i2] || '';
    // Only stack if both are equations (contain =)
    if (src1.includes('=') && src2.includes('=')) {
      const eq1 = placeholders[i1] || '';
      const eq2 = placeholders[i2] || '';
      const stacked = `<div class="system-of-equations">${eq1}${eq2}</div>`;
      return addPlaceholder(stacked, 'SYSTEM');
    }
    return _match; // Leave as-is (e.g. "$x$ and $y$")
  });

  // 5. Escape HTML (math and bold are already replaced with placeholders)
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 6. Italic *text* (but not placeholder markers which use __)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // 7. Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');

  // 8. Remove <br/> between consecutive display math blocks (reduces excess whitespace)
  html = html.replace(/__DMATH_(\d+)__(<br\/>)+__DMATH_/g, (_match, idx) => {
    return `__DMATH_${idx}____DMATH_`;
  });

  // 9. Restore ALL placeholders
  html = html.replace(/__BOLD_(\d+)__/g, (match, index) => {
    const original = placeholders[parseInt(index)] || match;
    const boldMatch = original.match(/\*\*([^*]+)\*\*/);
    if (boldMatch) {
      const inner = boldMatch[1]
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<strong>${inner}</strong>`;
    }
    return match;
  });
  html = html.replace(/__(DMATH|IMATH|SYSTEM)_(\d+)__/g, (m, _type, index) => {
    return placeholders[parseInt(index)] || m;
  });

  // 10. Wrap in paragraph if not already
  if (!html.startsWith('<') && !html.startsWith(' ')) {
    html = `<p>${html}</p>`;
  }

  return html;
};

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
        <p className="text-red-500 dark:text-red-400">{error || 'Lesson not found'}</p>
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
    <div className="max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(lessonsPath)}
          className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Lessons
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="info" className="mb-2">{lesson.skill_code}</Badge>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lesson.title}
            </h1>
            {lesson.subtitle && (
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {lesson.subtitle}
              </p>
            )}
          </div>

          {lesson.is_completed && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Completed
              </span>
            </div>
          )}
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-4 mt-4 text-sm text-gray-500 dark:text-gray-400">
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
        <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-4">
            SAT Tips
          </h2>
          <ul className="space-y-2 list-disc list-inside text-blue-900 dark:text-blue-100">
            {satTips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 z-40">
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
            <div key={index} className="flex flex-col bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              {/* Title */}
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-center">
                {item.title}
              </h4>
              {/* Image - 1.5x taller for better visibility */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 mb-3">
                <img
                  src={item.image.url}
                  alt={item.image.alt || item.title}
                  className="w-full h-auto max-h-80 object-contain"
                />
              </div>
              {/* Caption */}
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-2">
                {item.image.caption}
              </p>
              {/* Text */}
              <div
                className="text-gray-700 dark:text-gray-300 text-sm"
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
      <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-l-4 border-blue-500">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            {section.title && (
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
                {section.title}
              </h3>
            )}
            <div
              className="text-blue-900 dark:text-blue-100"
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
      <div className="p-5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border-l-4 border-amber-500">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {section.title}
          </h3>
        )}
        <div className="flex justify-center">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 inline-block max-w-xs">
            <img
              src={section.url}
              alt={section.alt || section.title || 'Lesson illustration'}
              className="max-w-full h-auto"
            />
            {section.caption && (
              <p className="text-center text-sm text-gray-600 dark:text-gray-400 py-2 px-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
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
      <div className="my-8 pt-6 border-t-2 border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {section.title}
        </h2>
      </div>
    );
  }

  // Summary section
  if (type === 'summary') {
    return (
      <div className="my-6 p-6 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-4">
          {section.title}
        </h3>
        <ul className="space-y-2">
          {section.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span
                className="text-green-900 dark:text-green-100"
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
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {section.title}
        </h3>
      )}
      <div
        className="text-gray-700 dark:text-gray-300 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(section.content) }}
      />
    </div>
  );
};

/**
 * Parse a linear equation like "2x + 8y = 198" into { a, b, c } for ax + by = c
 * Returns null if it can't parse.
 */
const parseLinearEquation = (eq) => {
  // Normalize: remove spaces
  let s = eq.replace(/\s+/g, '');

  const sides = s.split('=');
  if (sides.length !== 2) return null;

  // Extract coefficients of x, y, and constants from an expression
  const extractCoeffs = (expr) => {
    let a = 0, b = 0, c = 0;
    // Match terms: sign + optional number + optional variable (x or y)
    // Each term must have at least a number or a variable
    const termRegex = /([+-]?)(\d+\.?\d*)(x|y)|([+-]?)(x|y)|([+-]?\d+\.?\d*)/g;
    let m;
    while ((m = termRegex.exec(expr)) !== null) {
      if (m[3]) {
        // number + variable: e.g. 2x, 8y, -5x
        const sign = m[1] === '-' ? -1 : 1;
        const val = sign * parseFloat(m[2]);
        if (m[3] === 'x') a += val;
        else b += val;
      } else if (m[5]) {
        // bare variable: e.g. x, -y
        const sign = m[4] === '-' ? -1 : 1;
        if (m[5] === 'x') a += sign;
        else b += sign;
      } else if (m[6]) {
        // constant: e.g. 198, -21
        c += parseFloat(m[6]);
      }
    }
    return { a, b, c };
  };

  const left = extractCoeffs(sides[0]);
  const right = extractCoeffs(sides[1]);

  return {
    a: left.a - right.a,
    b: left.b - right.b,
    c: right.c - left.c,
  };
};

/**
 * Compute Desmos viewport bounds from a list of equations.
 * Finds intercepts and intersection points, then sets bounds with padding.
 */
const computeBoundsFromEquations = (equations) => {
  const defaultBounds = { left: -10, right: 10, bottom: -10, top: 10 };
  if (!equations || equations.length === 0) return defaultBounds;

  const keyPoints = [];

  // Parse equations and find intercepts
  const parsed = equations.map(parseLinearEquation).filter(Boolean);

  parsed.forEach(({ a, b, c }) => {
    // x-intercept (y=0): ax = c → x = c/a
    if (Math.abs(a) > 0.001) keyPoints.push({ x: c / a, y: 0 });
    // y-intercept (x=0): by = c → y = c/b
    if (Math.abs(b) > 0.001) keyPoints.push({ x: 0, y: c / b });
  });

  // Find intersection points between pairs
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const { a: a1, b: b1, c: c1 } = parsed[i];
      const { a: a2, b: b2, c: c2 } = parsed[j];
      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) > 0.001) {
        const x = (c1 * b2 - c2 * b1) / det;
        const y = (a1 * c2 - a2 * c1) / det;
        keyPoints.push({ x, y });
      }
    }
  }

  if (keyPoints.length === 0) return defaultBounds;

  // Find bounding box of all key points
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  keyPoints.forEach(({ x, y }) => {
    if (isFinite(x)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    if (isFinite(y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  });

  if (!isFinite(minX)) return defaultBounds;

  // Add padding (at least 5 units, or 30% of range)
  const padX = Math.max(5, (maxX - minX) * 0.3);
  const padY = Math.max(5, (maxY - minY) * 0.3);

  return {
    left: Math.floor(minX - padX),
    right: Math.ceil(maxX + padX),
    bottom: Math.floor(minY - padY),
    top: Math.ceil(maxY + padY),
  };
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
        script.src = 'https://www.desmos.com/api/v1.8/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
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
    <div className="my-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-500">
        <h3 className="text-white font-semibold">
          {section.title}
        </h3>
        {section.source && (
          <span className="text-blue-100 text-sm">{section.source}</span>
        )}
      </div>

      {/* Problem */}
      <div className="p-5">
        <div
          className="text-gray-800 dark:text-gray-200 mb-6"
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
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                      : showIncorrect
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                      : isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    showCorrect
                      ? 'bg-green-500 text-white'
                      : showIncorrect
                      ? 'bg-red-500 text-white'
                      : isSelected
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                    {letter}
                  </span>
                  <span
                    className={`flex-1 ${
                      showCorrect
                        ? 'text-green-800 dark:text-green-200'
                        : showIncorrect
                        ? 'text-red-800 dark:text-red-200'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(opt.text) }}
                  />
                  {showCorrect && (
                    <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
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
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
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
        <div className="p-5 bg-blue-50 dark:bg-blue-900/20 border-t border-gray-200 dark:border-gray-700">
          {/* Steps */}
          {section.steps && section.steps.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3">Solution:</h4>
              <div className="space-y-4">
                {section.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center text-sm font-bold text-blue-800 dark:text-blue-200">
                      {step.step || i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-blue-900 dark:text-blue-100 mb-1">{step.description}</p>
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
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3">Graphing Calculator:</h4>
              <div
                ref={desmosRef}
                className="w-full h-80 rounded-lg border border-blue-200 dark:border-blue-700 bg-white"
              />
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                The intersection point shows the solution. Click on it to see the coordinates!
              </p>
            </div>
          )}

          {/* Answer */}
          {section.answer && (
            <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <span className="font-semibold text-green-800 dark:text-green-300">Answer: </span>
              <span
                className="text-green-900 dark:text-green-100"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(section.answer) }}
              />
            </div>
          )}

          {/* Tip */}
          {section.tip && (
            <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border-l-4 border-yellow-500">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-800 dark:text-yellow-200">{section.tip}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Show Solution toggle - always available when explanation is hidden */}
      {!showExplanation && !showResult && (
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowExplanation(true)}
            className="w-full flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:underline"
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
