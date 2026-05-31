/**
 * Student Dashboard — Study Hall.
 *
 * Big-number focus, borderless/hairline layout. The hero is a dominant
 * Fraunces projected score with an amber signature rule; trend, goal, and
 * stats orbit it quietly. Sections are separated by hairlines and whitespace,
 * not cards. Elevation is reserved for the single next-action. "Show the path,
 * not just the score": every metric carries a next action. Token-only, full
 * dark mode, responsive, a11y, choreographed motion with reduced-motion fallback.
 */
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList, Brain, PlayCircle, ArrowRight, ArrowUpRight,
  BookOpen, BarChart3, FileText, Target, Sparkles,
} from 'lucide-react';
import {
  Button, ThetaBar,
  Surface, AnimatedNumber, Skeleton, Reveal, Section,
} from '../../components/ui';
import { assignmentService, progressService, recommendationService } from '../../services';
import { useAuth } from '../../hooks/useAuth';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const TYPE_DOT = {
  review: 'bg-brand-400',
  level_up: 'bg-brand-500',
  lesson_then_practice: 'bg-accent-500',
  practice: 'bg-brand-500',
  new_skill: 'bg-accent-500',
  nudge: 'bg-ink-faint',
};

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.first_name || user?.email?.split('@')[0] || 'there';

  const [assignments, setAssignments] = useState([]);
  const [inProgressAssessments, setInProgressAssessments] = useState([]);
  const [progress, setProgress] = useState(null);
  const [skills, setSkills] = useState(null);
  const [studyPlan, setStudyPlan] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assignmentsRes, progressRes, inProgressRes, skillsRes, studyPlanRes] =
          await Promise.all([
            assignmentService.getAssignments({ status: 'pending', limit: 5 }),
            progressService.getSummary(),
            progressService.getInProgressAssessments(),
            progressService.getSkills().catch(() => ({ data: { skills: [], weak_skills: [], strong_skills: [] } })),
            recommendationService.getStudyPlan().catch(() => ({ data: { tasks: [] } })),
          ]);
        setAssignments(assignmentsRes.data.items || []);
        setProgress(progressRes.data);
        setInProgressAssessments(inProgressRes.data.items || []);
        setSkills(skillsRes.data);
        setStudyPlan(studyPlanRes.data.tasks || []);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const accuracy = Math.round(progress?.overall_accuracy || 0);
  const questionsAnswered = progress?.total_questions_answered || 0;
  const sessions = progress?.sessions_completed || 0;
  const hasDiagnostic = progress?.has_diagnostic || false;

  const studyPlanVisible = useMemo(() => {
    let completed = {};
    try { completed = JSON.parse(localStorage.getItem('study_plan_completed') || '{}'); } catch {}
    return studyPlan.filter((t) => !completed[t.skill_id]);
  }, [studyPlan]);

  const nextAction = useMemo(() => {
    if (inProgressAssessments.length > 0) {
      const a = inProgressAssessments[0];
      return { kind: 'resume-assessment', title: a.title || 'Intake Assessment', meta: `${a.questions_answered}/${a.total_questions} answered`, to: `/assess/${a.invite_token}`, cta: 'Resume' };
    }
    if (!hasDiagnostic) {
      return { kind: 'diagnostic', title: 'Take your diagnostic', meta: '30 questions · ~25 min · pinpoints what to study', to: '/student/diagnostic', cta: 'Start diagnostic' };
    }
    const weak = skills?.weak_skills?.[0];
    if (weak) {
      return { kind: 'practice', title: `Practice ${weak.skill_name}`, meta: `${weak.domain_code} · your lowest mastery right now`, to: `/student/adaptive?skill=${weak.skill_id}&autostart=true`, cta: 'Start practice' };
    }
    return { kind: 'adaptive', title: 'Adaptive practice', meta: 'Questions that adjust to your level', to: '/student/adaptive', cta: 'Start practice' };
  }, [inProgressAssessments, hasDiagnostic, skills]);

  if (isLoading) return <DashboardSkeleton greeting={getGreeting()} name={firstName} />;

  return (
    <div className="mx-auto max-w-5xl pb-6">

      {/* ── Hero: the next action leads, stats orbit quietly ── */}
      <Reveal as="header" className="pt-2 pb-7 sm:pt-4 sm:pb-8">
        <p className="text-sm font-medium text-ink-subtle">
          {getGreeting()}, <span className="text-ink-body">{firstName}</span>
        </p>

        {/* The one thing to do right now — the focal element */}
        <Surface
          elevation="md" interactive padded={false} as={Link} to={nextAction.to}
          className="group mt-5 flex items-center gap-5 px-5 py-5 sm:px-7 sm:py-6"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-glow">
            {nextAction.kind === 'resume-assessment' ? <PlayCircle className="h-7 w-7" /> : <Sparkles className="h-7 w-7" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">
              {nextAction.kind === 'diagnostic' ? 'Start here' : 'Pick up where you left off'}
            </p>
            <p className="truncate font-display text-xl font-semibold tracking-tight text-ink-body sm:text-2xl">
              {nextAction.title}
            </p>
            <p className="truncate text-sm text-ink-subtle">{nextAction.meta}</p>
          </div>
          <span className="hidden shrink-0 sm:block">
            <Button size="lg" tabIndex={-1} className="pointer-events-none">
              {nextAction.cta}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-quart group-hover:translate-x-0.5" />
            </Button>
          </span>
          <ArrowRight className="h-6 w-6 shrink-0 text-ink-faint transition-transform duration-200 ease-out-quart group-hover:translate-x-0.5 sm:hidden" />
        </Surface>

        {/* Supporting micro-stats — quiet orbit */}
        <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-3 border-t border-edge pt-6">
          <Stat label="accuracy" value={accuracy} suffix="%" />
          <Stat label="questions answered" value={questionsAnswered} />
          <Stat label="sessions" value={sessions} />
          {user?.target_score && (
            <Stat label="goal score" value={user.target_score} />
          )}
        </dl>
      </Reveal>

      {/* ── Quick actions — borderless tiles on a hairline row ── */}
      <Reveal stagger className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-edge pt-6 sm:grid-cols-4">
        {[
          { to: '/student/practice-tests', icon: FileText, label: 'Practice Tests' },
          { to: '/student/adaptive', icon: Brain, label: 'Adaptive Practice' },
          { to: '/student/questions', icon: BookOpen, label: 'Question Bank' },
          { to: '/student/progress', icon: BarChart3, label: 'My Progress' },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="group flex items-center gap-3 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-muted transition-colors group-hover:bg-brand-50 group-hover:text-brand-700 dark:group-hover:bg-brand-900/30 dark:group-hover:text-brand-300">
              <a.icon className="h-5 w-5" />
            </span>
            <span className="flex items-center gap-0.5 text-sm font-semibold leading-tight text-ink-body">
              {a.label}
              <ArrowUpRight className="h-3.5 w-3.5 text-ink-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            </span>
          </Link>
        ))}
      </Reveal>

      {/* ── Two-column body, borderless ── */}
      <div className="mt-10 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-5">
        {/* Left */}
        <div className="space-y-10 lg:col-span-3">
          {skills?.weak_skills?.length > 0 && (
            <Reveal>
              <Section title="Focus areas" hint="Lowest mastery from your practice" icon={Target}>
                <ul className="divide-y divide-edge-subtle">
                  {skills.weak_skills.map((skill) => (
                    <li key={skill.skill_id} className="flex items-center gap-4 py-4 first:pt-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-xs font-bold text-ink-subtle">
                        {skill.domain_code}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1.5 truncate text-sm font-semibold text-ink-body">{skill.skill_name}</p>
                        <ThetaBar theta={skill.theta} masteryLevel={skill.mastery_level} isStale={skill.is_stale} size="full" />
                      </div>
                      <Link to={`/student/adaptive?skill=${skill.skill_id}&autostart=true`} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                        Practice <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            </Reveal>
          )}

          {studyPlanVisible.length > 0 && (
            <Reveal>
              <Section title="Study plan" icon={ClipboardList} action={<Link to="/student/study-plan" className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-400">View full plan</Link>}>
                <ul className="divide-y divide-edge-subtle">
                  {studyPlanVisible.slice(0, 4).map((task) => {
                    const primary = task.actions?.[0] || task;
                    const href = primary.href || primary.cta_href;
                    const label = primary.label || primary.cta_label || 'Start';
                    return (
                      <li key={task.skill_id || task.title} className="flex items-center justify-between gap-4 py-3.5 first:pt-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[task.type] || 'bg-ink-faint'}`} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink-body">{task.title}</p>
                            <p className="truncate text-xs text-ink-subtle">
                              {task.domain_code && <span className="font-medium">{task.domain_code} · </span>}
                              ~{task.estimated_minutes} min
                            </p>
                          </div>
                        </div>
                        {href && (
                          <Link to={href} className="shrink-0">
                            <Button size="sm" variant="secondary">{label}<ArrowRight className="h-3.5 w-3.5" /></Button>
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Section>
            </Reveal>
          )}
        </div>

        {/* Right */}
        <div className="space-y-10 lg:col-span-2">
          {skills?.strong_skills?.length > 0 && (
            <Reveal>
              <Section title="Your strengths" icon={Sparkles}>
                <ul className="space-y-4">
                  {skills.strong_skills.slice(0, 3).map((skill) => (
                    <li key={skill.skill_id}>
                      <div className="mb-1.5 flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-[11px] font-bold text-accent-700 dark:bg-accent-900/30 dark:text-accent-300">
                          {skill.domain_code}
                        </span>
                        <p className="truncate text-sm font-semibold text-ink-body">{skill.skill_name}</p>
                      </div>
                      <ThetaBar theta={skill.theta} masteryLevel={skill.mastery_level} isStale={skill.is_stale} size="full" />
                    </li>
                  ))}
                </ul>
              </Section>
            </Reveal>
          )}

          {/* Full-length test — borderless callout */}
          <Reveal>
            <Section title="Go full length" icon={FileText}>
              <p className="text-sm text-ink-muted">A complete SAT under real conditions.</p>
              <p className="mt-1 text-xs text-ink-subtle">98 questions · 2 hr 14 min · realistic Bluebook format</p>
              <Button variant="primary" className="mt-3" onClick={() => navigate('/student/practice-tests')}>
                Start test <ArrowRight className="h-4 w-4" />
              </Button>
            </Section>
          </Reveal>

          <Reveal>
            <Section title="Assignments" icon={ClipboardList} action={assignments.length > 0 ? <Link to="/student/assignments" className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-400">View all</Link> : null}>
              {assignments.length > 0 ? (
                <ul className="divide-y divide-edge-subtle">
                  {assignments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-3.5 first:pt-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-body">{a.title}</p>
                        <p className="text-xs text-ink-subtle">
                          {a.total_questions} questions{a.due_date && ` · Due ${new Date(a.due_date).toLocaleDateString()}`}
                        </p>
                      </div>
                      <Link to={`/student/test/${a.id}`} className="shrink-0"><Button size="sm">Start</Button></Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-subtle">You're all caught up. New assignments from your tutor will show up here.</p>
              )}
            </Section>
          </Reveal>
        </div>
      </div>
    </div>
  );
};

/* ── Local presentational helpers ── */

const Stat = ({ label, value, suffix = '' }) => (
  <div>
    <dd className="font-display text-2xl font-semibold tracking-tight text-ink-body">
      <AnimatedNumber value={value} suffix={suffix} />
    </dd>
    <dt className="text-xs text-ink-subtle">{label}</dt>
  </div>
);

const DashboardSkeleton = ({ greeting, name }) => (
  <div className="mx-auto max-w-5xl">
    <header className="pt-2 pb-7 sm:pt-4 sm:pb-8">
      <p className="text-sm font-medium text-ink-subtle">{greeting}, <span className="text-ink-body">{name}</span></p>
      {/* Next-action hero */}
      <Skeleton className="mt-5 h-24 w-full" rounded="rounded-2xl" />
      <div className="mt-7 flex gap-10 border-t border-edge pt-6">
        <Skeleton className="h-10 w-16" /><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-16" />
      </div>
    </header>
    <div className="mt-2 grid grid-cols-2 gap-5 border-t border-edge pt-6 sm:grid-cols-4">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
    <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-5">
      <Skeleton className="h-56 w-full lg:col-span-3" rounded="rounded-xl" />
      <Skeleton className="h-56 w-full lg:col-span-2" rounded="rounded-xl" />
    </div>
  </div>
);

export default StudentDashboard;
