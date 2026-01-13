/**
 * Lesson Viewer Page
 * Beautiful, engaging lesson content viewer
 * Supports rich content with sections, examples, tips, and more
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  BookOpen,
  Target,
  ChevronRight,
  ChevronLeft,
  Zap,
  Brain,
  Play,
} from 'lucide-react';
import { Button, LoadingSpinner, Badge } from '../../components/ui';
import { lessonService } from '../../services';

// Section type icons and colors
const sectionConfig = {
  text: { icon: BookOpen, color: 'gray' },
  example: { icon: Target, color: 'blue' },
  tip: { icon: Lightbulb, color: 'yellow' },
  warning: { icon: AlertTriangle, color: 'red' },
  formula: { icon: Zap, color: 'purple' },
  concept: { icon: Brain, color: 'indigo' },
};

const LessonViewerPage = () => {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const startTimeRef = useRef(Date.now());

  const [lesson, setLesson] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);

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
  const examples = content.examples || [];
  const keyTakeaways = content.key_takeaways || [];
  const commonMistakes = content.common_mistakes || [];

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

      {/* Introduction */}
      {content.introduction && (
        <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
          <div
            className="prose prose-blue dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"
            dangerouslySetInnerHTML={{ __html: content.introduction }}
          />
        </div>
      )}

      {/* Main Content Sections */}
      {sections.length > 0 && (
        <div className="space-y-6 mb-8">
          {sections.map((section, index) => (
            <LessonSection key={index} section={section} />
          ))}
        </div>
      )}

      {/* Worked Examples */}
      {examples.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Worked Examples
          </h2>
          <div className="space-y-6">
            {examples.map((example, index) => (
              <ExampleCard key={index} example={example} index={index + 1} />
            ))}
          </div>
        </div>
      )}

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
                <span className="text-green-900 dark:text-green-100">{takeaway}</span>
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
                <span className="text-red-900 dark:text-red-100">{mistake}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Practice Tips */}
      {content.practice_tips && (
        <div className="mb-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-200 dark:border-yellow-800">
          <h2 className="text-lg font-bold text-yellow-800 dark:text-yellow-300 mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Practice Tips
          </h2>
          <div
            className="prose prose-yellow dark:prose-invert max-w-none text-yellow-900 dark:text-yellow-100"
            dangerouslySetInnerHTML={{ __html: content.practice_tips }}
          />
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

// Section Component
const LessonSection = ({ section }) => {
  const config = sectionConfig[section.type] || sectionConfig.text;
  const Icon = config.icon;

  const colorClasses = {
    gray: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
  };

  const iconColors = {
    gray: 'text-gray-500',
    blue: 'text-blue-500',
    yellow: 'text-yellow-500',
    red: 'text-red-500',
    purple: 'text-purple-500',
    indigo: 'text-indigo-500',
  };

  // Plain text sections don't need special styling
  if (section.type === 'text' && !section.title) {
    return (
      <div
        className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"
        dangerouslySetInnerHTML={{ __html: section.content }}
      />
    );
  }

  return (
    <div className={`p-6 rounded-2xl border ${colorClasses[config.color]}`}>
      {section.title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColors[config.color]}`} />
          {section.title}
        </h3>
      )}
      <div
        className="prose dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: section.content }}
      />
      {section.image_url && (
        <div className="mt-4">
          <img
            src={section.image_url}
            alt={section.image_caption || 'Lesson illustration'}
            className="rounded-lg max-w-full h-auto mx-auto"
          />
          {section.image_caption && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
              {section.image_caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Example Card Component
const ExampleCard = ({ example, index }) => {
  const [showSolution, setShowSolution] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      {/* Problem Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <span className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-sm">
            {index}
          </span>
          {example.title}
        </h3>
      </div>

      {/* Problem */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div
          className="prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: example.problem }}
        />
      </div>

      {/* Solution Toggle */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
        <button
          onClick={() => setShowSolution(!showSolution)}
          className="w-full flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:underline"
        >
          {showSolution ? 'Hide Solution' : 'Show Solution'}
          <ChevronRight className={`h-4 w-4 transition-transform ${showSolution ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {/* Solution */}
      {showSolution && (
        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-blue-800">
          {/* Step by step if available */}
          {example.steps && example.steps.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3">Step-by-Step:</h4>
              <ol className="space-y-2">
                {example.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center text-sm font-bold text-blue-800 dark:text-blue-200">
                      {i + 1}
                    </span>
                    <span className="text-blue-900 dark:text-blue-100">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Full explanation */}
          <div
            className="prose prose-blue dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: example.solution }}
          />

          {/* Tip */}
          {example.tip && (
            <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">{example.tip}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LessonViewerPage;
