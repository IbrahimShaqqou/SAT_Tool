/**
 * Lessons Page
 * Browse and learn skill lessons organized by domain
 * Beautiful visual design with progress tracking
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Clock,
  CheckCircle2,
  ChevronRight,
  Calculator,
  BookText,
  Sparkles,
  Lock,
  PlayCircle,
  GraduationCap,
} from 'lucide-react';
import { Card, Button, Badge, LoadingSpinner, EmptyState } from '../../components/ui';
import { lessonService } from '../../services';

// Domain color mapping for visual appeal
const domainColors = {
  // Math domains
  H: { bg: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  Q: { bg: 'bg-purple-500', light: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
  P: { bg: 'bg-green-500', light: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  S: { bg: 'bg-orange-500', light: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  // Reading domains
  INI: { bg: 'bg-teal-500', light: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  CAS: { bg: 'bg-indigo-500', light: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
  EOI: { bg: 'bg-pink-500', light: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' },
  SEC: { bg: 'bg-amber-500', light: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
};

const getColorScheme = (code) => domainColors[code] || domainColors.H;

// Domain icons
const domainIcons = {
  H: Calculator,
  Q: Sparkles,
  P: BookText,
  S: GraduationCap,
  INI: BookOpen,
  CAS: BookText,
  EOI: Sparkles,
  SEC: GraduationCap,
};

const LessonsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('subject') || 'math';

  const [mathLessons, setMathLessons] = useState(null);
  const [readingLessons, setReadingLessons] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLessons = async () => {
      setIsLoading(true);
      try {
        const [mathRes, readingRes] = await Promise.all([
          lessonService.getMathLessons(),
          lessonService.getReadingLessons(),
        ]);
        setMathLessons(mathRes.data);
        setReadingLessons(readingRes.data);
      } catch (err) {
        console.error('Failed to fetch lessons:', err);
        setError('Failed to load lessons');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLessons();
  }, []);

  const handleTabChange = (tab) => {
    setSearchParams({ subject: tab });
  };

  const handleLessonClick = (lesson) => {
    if (lesson.status === 'published') {
      navigate(`/student/lessons/${lesson.id}`);
    }
  };

  const currentLessons = activeTab === 'math' ? mathLessons : readingLessons;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 dark:text-red-400">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Skill Lessons
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Learn concepts before you practice
          </p>
        </div>

        {/* Progress Summary */}
        {currentLessons && (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentLessons.completed_lessons} / {currentLessons.total_lessons} completed
            </span>
          </div>
        )}
      </div>

      {/* Subject Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button
          onClick={() => handleTabChange('math')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'math'
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Calculator className="h-4 w-4" />
          Math
          {mathLessons && (
            <Badge variant={activeTab === 'math' ? 'default' : 'default'} size="sm">
              {mathLessons.total_lessons}
            </Badge>
          )}
        </button>
        <button
          onClick={() => handleTabChange('reading')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'reading'
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <BookText className="h-4 w-4" />
          Reading & Writing
          {readingLessons && (
            <Badge variant={activeTab === 'reading' ? 'default' : 'default'} size="sm">
              {readingLessons.total_lessons}
            </Badge>
          )}
        </button>
      </div>

      {/* Domains and Lessons */}
      {currentLessons && currentLessons.domains.length > 0 ? (
        <div className="space-y-8">
          {currentLessons.domains.map((domain) => {
            const colors = getColorScheme(domain.domain_code);
            const DomainIcon = domainIcons[domain.domain_code] || BookOpen;

            return (
              <div key={domain.domain_id} className="space-y-4">
                {/* Domain Header */}
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${colors.bg}`}>
                    <DomainIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {domain.domain_name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {domain.completed_lessons} of {domain.total_lessons} lessons completed
                    </p>
                  </div>
                  {/* Domain Progress Bar */}
                  <div className="hidden sm:flex items-center gap-2 w-32">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors.bg} transition-all duration-300`}
                        style={{
                          width: `${domain.total_lessons > 0
                            ? (domain.completed_lessons / domain.total_lessons) * 100
                            : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
                      {domain.total_lessons > 0
                        ? Math.round((domain.completed_lessons / domain.total_lessons) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>

                {/* Lesson Cards */}
                {domain.lessons.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {domain.lessons.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        colors={colors}
                        onClick={() => handleLessonClick(lesson)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={`p-6 rounded-lg border-2 border-dashed ${colors.border} ${colors.light}`}>
                    <div className="text-center">
                      <BookOpen className={`h-8 w-8 mx-auto mb-2 ${colors.text}`} />
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Lessons coming soon
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        We're working on lessons for this domain
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No lessons available"
          description="Lessons are being created. Check back soon!"
        />
      )}
    </div>
  );
};

// Lesson Card Component
const LessonCard = ({ lesson, colors, onClick }) => {
  const isPublished = lesson.status === 'published';
  const isInProgress = lesson.status === 'in_progress';
  const isCompleted = lesson.is_completed;

  return (
    <button
      onClick={onClick}
      disabled={!isPublished}
      className={`
        relative w-full text-left p-4 rounded-xl border transition-all duration-200
        ${isPublished
          ? `bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer`
          : `bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-75 cursor-not-allowed`
        }
      `}
    >
      {/* Completion indicator */}
      {isCompleted && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        </div>
      )}

      {/* Status badge for non-published */}
      {!isPublished && (
        <div className="absolute top-3 right-3">
          {isInProgress ? (
            <Badge variant="warning" size="sm">Coming Soon</Badge>
          ) : (
            <Lock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          )}
        </div>
      )}

      {/* Skill code badge */}
      <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${colors.light} ${colors.text} mb-3`}>
        {lesson.skill_code}
      </div>

      {/* Title */}
      <h3 className={`font-semibold mb-1 pr-8 ${
        isPublished
          ? 'text-gray-900 dark:text-gray-100'
          : 'text-gray-500 dark:text-gray-400'
      }`}>
        {lesson.title}
      </h3>

      {/* Subtitle */}
      {lesson.subtitle && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
          {lesson.subtitle}
        </p>
      )}

      {/* Meta info */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {lesson.estimated_minutes} min
        </span>
        <span className={`capitalize px-2 py-0.5 rounded ${
          lesson.difficulty_level === 'beginner'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : lesson.difficulty_level === 'advanced'
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
        }`}>
          {lesson.difficulty_level}
        </span>
      </div>

      {/* Action indicator */}
      {isPublished && !isCompleted && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            Start Learning
          </span>
          <PlayCircle className={`h-5 w-5 ${colors.text}`} />
        </div>
      )}

      {isCompleted && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            Completed
          </span>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      )}
    </button>
  );
};

export default LessonsPage;
