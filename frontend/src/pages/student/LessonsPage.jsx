/**
 * Lessons — Study Hall.
 * Browsable lesson tiles (cards earn their place here) grouped by domain under
 * hairline headers, warm single-accent treatment, difficulty pills. Tokens,
 * dark mode, a11y, motion.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  BookOpen, Clock, CheckCircle2, ChevronRight, Calculator,
  BookText, Lock, PlayCircle,
} from 'lucide-react';
import { Button, EmptyState, Skeleton, PageHeader, Surface, Reveal } from '../../components/ui';
import { lessonService } from '../../services';

const difficultyPill = (level) => {
  if (level === 'beginner') return 'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300';
  if (level === 'advanced') return 'bg-rose-50 text-rose-700 dark:bg-rose-900/25 dark:text-rose-300';
  return 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300';
};

const LessonsPage = ({ isPublic = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('subject') || 'math';

  const [mathLessons, setMathLessons] = useState(null);
  const [readingLessons, setReadingLessons] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const isTutorRoute = location.pathname.startsWith('/tutor');
  const basePath = isPublic ? '/lessons' : isTutorRoute ? '/tutor/lessons' : '/student/lessons';

  useEffect(() => {
    const fetchLessons = async () => {
      setIsLoading(true);
      try {
        const [mathRes, readingRes] = await Promise.all([
          isPublic ? lessonService.getPublicMathLessons() : lessonService.getMathLessons(),
          isPublic ? lessonService.getPublicReadingLessons() : lessonService.getReadingLessons(),
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
  }, [isPublic]);

  const currentLessons = activeTab === 'math' ? mathLessons : readingLessons;
  const handleLessonClick = (lesson) => { if (lesson.status === 'published') navigate(`${basePath}/${lesson.id}`); };

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-rose-600 dark:text-rose-400">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Retry</Button>
      </div>
    );
  }

  const TABS = [
    { key: 'math', label: 'Math', icon: Calculator, count: mathLessons?.total_lessons },
    { key: 'reading', label: 'Reading & Writing', icon: BookText, count: readingLessons?.total_lessons },
  ];

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <PageHeader
        eyebrow="Learn the concepts"
        title="Skill lessons"
        subtitle="Short, worked lessons for every SAT skill. Learn the idea, then practice it."
        actions={
          currentLessons && (
            <span className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1.5 text-sm font-medium text-ink-muted">
              <CheckCircle2 className="h-4 w-4 text-accent-600 dark:text-accent-400" />
              {currentLessons.completed_lessons}/{currentLessons.total_lessons} done
            </span>
          )
        }
      />

      {/* Subject tabs */}
      <div role="tablist" aria-label="Subject" className="mb-8 flex flex-wrap gap-1.5 border-b border-edge pb-3">
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key} role="tab" aria-selected={active} onClick={() => setSearchParams({ subject: t.key })}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted hover:text-ink-body hover:bg-edge-subtle'}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {t.count != null && <span className={`text-xs ${active ? 'text-white/80' : 'text-ink-faint'}`}>{t.count}</span>}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-40 w-full" rounded="rounded-2xl" />)}
        </div>
      ) : currentLessons && currentLessons.domains.length > 0 ? (
        <div className="space-y-10">
          {currentLessons.domains.map((domain) => {
            const pct = domain.total_lessons > 0 ? Math.round((domain.completed_lessons / domain.total_lessons) * 100) : 0;
            return (
              <Reveal key={domain.domain_id} as="section">
                <div className="mb-4 flex items-end justify-between gap-3 border-b border-edge pb-2.5">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-body">{domain.domain_name}</h2>
                    <p className="mt-0.5 text-xs text-ink-subtle">{domain.completed_lessons} of {domain.total_lessons} completed</p>
                  </div>
                  <div className="hidden w-32 items-center gap-2 sm:flex">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-brand-500 transition-[width] duration-700 ease-out-expo" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs text-ink-faint">{pct}%</span>
                  </div>
                </div>

                {domain.lessons.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {domain.lessons.map((lesson) => (
                      <LessonCard key={lesson.id} lesson={lesson} onClick={() => handleLessonClick(lesson)} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-edge-strong bg-surface-muted/50 py-6 text-center text-sm text-ink-subtle">
                    Lessons for this domain are coming soon.
                  </p>
                )}
              </Reveal>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={BookOpen} title="No lessons available" description="Lessons are being created. Check back soon." />
      )}
    </div>
  );
};

const LessonCard = ({ lesson, onClick }) => {
  const isPublished = lesson.status === 'published';
  const isInProgress = lesson.status === 'in_progress';
  const isCompleted = lesson.is_completed;

  return (
    <Surface
      as="button"
      onClick={onClick}
      disabled={!isPublished}
      interactive={isPublished}
      elevation="sm"
      padded={false}
      className={`w-full p-4 text-left ${!isPublished ? 'cursor-not-allowed opacity-70' : ''}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          {lesson.skill_code}
        </span>
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5 text-accent-600 dark:text-accent-400" />
        ) : !isPublished ? (
          isInProgress
            ? <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-ink-subtle">Coming soon</span>
            : <Lock className="h-4 w-4 text-ink-faint" />
        ) : null}
      </div>

      <h3 className={`mb-1 font-semibold ${isPublished ? 'text-ink-body' : 'text-ink-subtle'}`}>{lesson.title}</h3>
      {lesson.subtitle && <p className="mb-3 line-clamp-2 text-sm text-ink-subtle">{lesson.subtitle}</p>}

      <div className="flex items-center gap-3 text-xs text-ink-faint">
        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{lesson.estimated_minutes} min</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold capitalize ${difficultyPill(lesson.difficulty_level)}`}>{lesson.difficulty_level}</span>
      </div>

      {isPublished && (
        <div className="mt-3 flex items-center justify-between border-t border-edge-subtle pt-3">
          <span className={`text-sm font-medium ${isCompleted ? 'text-accent-700 dark:text-accent-400' : 'text-ink-muted'}`}>
            {isCompleted ? 'Review lesson' : 'Start learning'}
          </span>
          {isCompleted ? <ChevronRight className="h-5 w-5 text-ink-faint" /> : <PlayCircle className="h-5 w-5 text-brand-600 dark:text-brand-400" />}
        </div>
      )}
    </Surface>
  );
};

export default LessonsPage;
