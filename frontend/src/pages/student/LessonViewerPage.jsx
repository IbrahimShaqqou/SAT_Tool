/**
 * Lesson Viewer Page
 * Beautiful, engaging lesson content viewer
 * Supports rich content with sections, examples, tips, and more
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { Button, LoadingSpinner, Badge } from '../../components/ui';
import { lessonService } from '../../services';
import 'katex/dist/katex.min.css';
import katex from 'katex';

/**
 * Parse simple markdown to HTML
 * Supports: **bold**, *italic*, $math$, $$display math$$
 */
const parseMarkdown = (text) => {
  if (!text) return '';

  let html = text;

  // Escape HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Display math $$...$$
  html = html.replace(/\$\$(.*?)\$\$/g, (match, math) => {
    try {
      return katex.renderToString(math, { displayMode: true, throwOnError: false });
    } catch (e) {
      return match;
    }
  });

  // Inline math $...$
  html = html.replace(/\$([^$]+)\$/g, (match, math) => {
    try {
      return katex.renderToString(math, { displayMode: false, throwOnError: false });
    } catch (e) {
      return match;
    }
  });

  // Bold **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic *text*
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');

  // Wrap in paragraph if not already
  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`;
  }

  return html;
};

const LessonViewerPage = () => {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const startTimeRef = useRef(Date.now());

  const [lesson, setLesson] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    const fetchLesson = async () => {
      setIsLoading(true);
      try {
        const response = await lessonService.getLesson(lessonId);
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
  }, [lessonId]);

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
    navigate('/student/adaptive', { state: { focusSkill: lesson?.skill_name } });
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
  const keyTakeaways = content.key_takeaways || content.key_concepts || [];
  const commonMistakes = content.common_mistakes || [];
  const satTips = content.sat_tips || [];

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/student/lessons')}
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
        {sections.map((section, index) => (
          <LessonSection key={section.id || index} section={section} />
        ))}
      </div>

      {/* Key Takeaways */}
      {keyTakeaways.length > 0 && (
        <div className="mb-8 p-6 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800">
          <h2 className="text-lg font-bold text-green-800 dark:text-green-300 mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Key Takeaways
          </h2>
          <ul className="space-y-3">
            {keyTakeaways.map((takeaway, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-200 dark:bg-green-800 rounded-full flex items-center justify-center text-sm font-bold text-green-800 dark:text-green-200">
                  {index + 1}
                </span>
                <span
                  className="text-green-900 dark:text-green-100"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(takeaway) }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Common Mistakes */}
      {commonMistakes.length > 0 && (
        <div className="mb-8 p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
          <h2 className="text-lg font-bold text-red-800 dark:text-red-300 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Common Mistakes to Avoid
          </h2>
          <ul className="space-y-3">
            {commonMistakes.map((mistake, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-red-200 dark:bg-red-800 rounded-full flex items-center justify-center text-sm font-bold text-red-800 dark:text-red-200">
                  ✗
                </span>
                <span
                  className="text-red-900 dark:text-red-100"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(mistake) }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* SAT Tips */}
      {satTips.length > 0 && (
        <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            SAT Tips
          </h2>
          <ul className="space-y-3">
            {satTips.map((tip, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center text-sm font-bold text-blue-800 dark:text-blue-200">
                  💡
                </span>
                <span
                  className="text-blue-900 dark:text-blue-100"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(tip) }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="secondary"
            onClick={() => navigate('/student/lessons')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            All Lessons
          </Button>

          <div className="flex items-center gap-3">
            {!lesson.is_completed && (
              <Button
                variant="primary"
                onClick={handleComplete}
                loading={isCompleting}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Complete
              </Button>
            )}
            <Button
              variant={lesson.is_completed ? 'primary' : 'secondary'}
              onClick={handlePractice}
            >
              <Play className="h-4 w-4 mr-2" />
              Practice This Skill
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Render a lesson section based on its type
 */
const LessonSection = ({ section }) => {
  const type = section.type;

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

  // Image - with border
  if (type === 'image') {
    return (
      <div className="my-6">
        {section.title && (
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {section.title}
          </h3>
        )}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
          <img
            src={section.url}
            alt={section.alt || section.title || 'Lesson illustration'}
            className="w-full h-auto"
          />
          {section.caption && (
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 py-3 px-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              {section.caption}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Math display - centered equations
  if (type === 'math-display') {
    return (
      <div className="my-6">
        {section.title && (
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {section.title}
          </h3>
        )}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center">
          {section.equations && section.equations.map((eq, i) => (
            <div
              key={i}
              className="my-2 text-xl"
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(eq, { displayMode: true, throwOnError: false })
              }}
            />
          ))}
          {section.caption && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
              {section.caption}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Comparison table
  if (type === 'comparison-table') {
    return (
      <div className="my-6 overflow-x-auto">
        {section.title && (
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {section.title}
          </h3>
        )}
        <table className="w-full border-collapse rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              {section.headers?.map((header, i) => (
                <th key={i} className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows?.map((row, i) => (
              <tr key={i} className="bg-white dark:bg-gray-900">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(cell) }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Worked example
  if (type === 'worked-example') {
    return <WorkedExample section={section} />;
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

  // Practice prompt
  if (type === 'practice-prompt') {
    return (
      <div className="my-6 p-6 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 text-center">
        <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-300 mb-2">
          {section.title}
        </h3>
        <div
          className="text-purple-900 dark:text-purple-100"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(section.content) }}
        />
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
 * Worked Example Component with collapsible solution
 */
const WorkedExample = ({ section }) => {
  const [showSolution, setShowSolution] = useState(false);

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
          className="text-gray-800 dark:text-gray-200"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(section.problem) }}
        />
      </div>

      {/* Solution Toggle */}
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowSolution(!showSolution)}
          className="w-full flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:underline"
        >
          {showSolution ? 'Hide Solution' : 'Show Solution'}
        </button>
      </div>

      {/* Solution */}
      {showSolution && (
        <div className="p-5 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
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

          {/* Multiple choice options */}
          {section.options && (
            <div className="mt-4">
              <h5 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Answer Choices:</h5>
              <div className="space-y-2">
                {section.options.map((opt, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg ${
                      opt.correct
                        ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={opt.correct ? 'text-green-800 dark:text-green-200' : 'text-gray-700 dark:text-gray-300'}
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(opt.text) }}
                    />
                    {opt.correct && <span className="ml-2 text-green-600">✓ Correct</span>}
                    {opt.explanation && !opt.correct && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Why not: {opt.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LessonViewerPage;
