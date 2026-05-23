/**
 * Student Dashboard
 * Personalized greeting, action-forward, clean data display
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList, Brain,
  PlayCircle, AlertTriangle, Target, ArrowRight,
  BookOpen, BarChart3, BarChart2, FileText,
} from 'lucide-react';
import { Button, Badge, EmptyState, LoadingSpinner, ThetaBar } from '../../components/ui';
import { assignmentService, progressService, recommendationService } from '../../services';
import { useAuth } from '../../hooks/useAuth';

// Organic blob decoration — personality without gradients
const Blob = ({ className }) => (
  <svg
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      fill="currentColor"
      d="M38.5,-65.2C50.2,-56.7,60.3,-47.1,68.1,-35C75.9,-22.9,81.3,-8.3,79.8,5.5C78.3,19.3,69.9,32.4,60.1,43.1C50.3,53.9,39.2,62.4,26.5,68.2C13.8,74.1,-0.5,77.3,-14.3,74.2C-28.1,71.1,-41.3,61.7,-52.1,50C-62.9,38.3,-71.2,24.3,-73.5,9C-75.8,-6.3,-72,-22.9,-63.7,-36.3C-55.4,-49.7,-42.6,-59.9,-29,-66.6C-15.5,-73.3,-1.1,-76.5,12.3,-75.5C25.7,-74.5,26.9,-73.8,38.5,-65.2Z"
      transform="translate(100 100)"
    />
  </svg>
);

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
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
  const [hasDiagnostic, setHasDiagnostic] = useState(true); // assume true until loaded
  const [diagnosticBannerDismissed, setDiagnosticBannerDismissed] = useState(
    () => sessionStorage.getItem('diagnostic_banner_dismissed') === '1'
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assignmentsRes, progressRes, inProgressRes, skillsRes, studyPlanRes] = await Promise.all([
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

        // Check if student has completed a diagnostic
        setHasDiagnostic(progressRes.data?.has_diagnostic || false);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const dismissDiagnosticBanner = () => {
    sessionStorage.setItem('diagnostic_banner_dismissed', '1');
    setDiagnosticBannerDismissed(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const accuracy = Math.round(progress?.overall_accuracy || 0);
  const questionsAnswered = progress?.total_questions_answered || 0;
  const sessions = progress?.sessions_completed || 0;

  // Filter study plan tasks by checked-off state (syncs with StudyPlanPage)
  let studyPlanCompleted = {};
  try { studyPlanCompleted = JSON.parse(localStorage.getItem('study_plan_completed') || '{}'); } catch {}
  const studyPlanVisible = studyPlan.filter(t => !studyPlanCompleted[t.skill_id]);

  return (
    <div className="space-y-7">

      {/* ── Greeting hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-brand-600 px-7 py-8">
        {/* Blob decorations */}
        <Blob className="absolute -right-8 -top-10 w-48 h-48 text-brand-500/40 pointer-events-none" />
        <Blob className="absolute right-24 -bottom-14 w-36 h-36 text-brand-700/30 pointer-events-none" />

        <div className="relative z-10">
          <p className="text-brand-100 text-sm font-medium mb-1">{getGreeting()},</p>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-4">{firstName}</h1>

          {/* Inline stats */}
          <div className="flex flex-wrap gap-5">
            <div>
              <span className="text-2xl font-bold text-white">{accuracy}%</span>
              <span className="text-brand-200 text-sm ml-1.5">accuracy</span>
            </div>
            <div className="w-px bg-brand-400/40 self-stretch" />
            <div>
              <span className="text-2xl font-bold text-white">{questionsAnswered}</span>
              <span className="text-brand-200 text-sm ml-1.5">questions answered</span>
            </div>
            <div className="w-px bg-brand-400/40 self-stretch" />
            <div>
              <span className="text-2xl font-bold text-white">{sessions}</span>
              <span className="text-brand-200 text-sm ml-1.5">sessions</span>
            </div>
          </div>

          {/* Score goal chip */}
          {user?.target_score && (
            <div className="mt-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-sm text-white">
                <Target className="h-3.5 w-3.5 text-brand-200" />
                Goal: <span className="font-bold">{user.target_score}</span>
                {user.test_date && (
                  <span className="text-brand-200">
                    {' '}by{' '}
                    {new Date(user.test_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Diagnostic banner (shown when no sessions yet) ── */}
      {!hasDiagnostic && !diagnosticBannerDismissed && (
        <div className="relative overflow-hidden rounded-2xl bg-violet-600 px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <BarChart2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">Start with a diagnostic to find out what to study</p>
                <p className="text-violet-200 text-sm mt-0.5">30 questions · 25 min · identify your strengths and weak spots</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link to="/student/diagnostic">
                <Button size="sm" className="!bg-white !text-violet-700 hover:!bg-violet-50 border-0 font-semibold">
                  Take Diagnostic
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <button
                onClick={dismissDiagnosticBanner}
                className="text-violet-300 hover:text-white p-1 rounded transition-colors"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assessment in progress banner ── */}
      {inProgressAssessments.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-amber-100 dark:border-amber-800/30 bg-amber-50 dark:bg-amber-900/10">
            <PlayCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Continue your assessment</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {inProgressAssessments.map((a) => (
              <div key={a.session_id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {a.title || 'Intake Assessment'}
                    </p>
                    <Badge variant="warning" size="sm">In Progress</Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {a.questions_answered}/{a.total_questions} answered
                    {a.subject_area && <>{' · '}{a.subject_area === 'math' ? 'Math' : 'Reading & Writing'}</>}
                    {a.tutor_name !== 'Self-Assessment' && <>{' · '}From {a.tutor_name}</>}
                  </p>
                </div>
                <Link to={`/assess/${a.invite_token}`}>
                  <Button size="sm">Resume</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Full-Length SAT Practice Test Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0077C8] px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">Take a Full-Length SAT Practice Test</p>
              <p className="text-blue-100 text-sm mt-0.5">98 questions · 2 hrs 14 min · realistic Bluebook format</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              className="!bg-white !text-[#0077C8] hover:!bg-blue-50 border-0 font-semibold"
              onClick={() => navigate('/student/practice-tests')}
            >
              Start Test
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/student/practice-tests', icon: FileText, label: 'Practice Tests', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
          { to: '/student/adaptive', icon: Brain, label: 'Adaptive Practice', color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/20' },
          { to: '/student/questions', icon: BookOpen, label: 'Question Bank', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
          { to: '/student/progress', icon: BarChart3, label: 'My Progress', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        ].map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group bg-white dark:bg-slate-800 rounded-2xl shadow-card p-4 flex flex-col items-start gap-3 hover:shadow-card-md transition-shadow"
          >
            <div className={`w-9 h-9 rounded-xl ${action.bg} flex items-center justify-center`}>
              <action.icon className={`h-5 w-5 ${action.color}`} />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-tight">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* ── Study Plan preview ── */}
      {studyPlanVisible.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-brand-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Study Plan</h2>
            </div>
            <Link to="/student/study-plan" className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors">
              View full plan
            </Link>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
            {studyPlanVisible.slice(0, 4).map((task, i) => {
              const typeColor = {
                review: 'bg-amber-400',
                level_up: 'bg-blue-500',
                lesson_then_practice: 'bg-violet-500',
                practice: 'bg-brand-500',
                new_skill: 'bg-emerald-500',
                nudge: 'bg-slate-400',
              };
              const primaryAction = task.actions?.[0] || task;
              const href = primaryAction.href || primaryAction.cta_href;
              const label = primaryAction.label || primaryAction.cta_label || 'Start';
              return (
                <div key={i} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${typeColor[task.type] || 'bg-slate-400'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{task.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {task.domain_code && <span className="font-medium">{task.domain_code}</span>}
                        {task.domain_code && ' · '}
                        ~{task.estimated_minutes} min
                      </p>
                    </div>
                  </div>
                  {href && (
                    <Link to={href} className="flex-shrink-0 ml-4">
                      <Button size="sm" variant="secondary">
                        {label}
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Areas to improve ── */}
      {skills?.weak_skills?.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Areas to improve</h2>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">From your practice</span>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
            {skills.weak_skills.map((skill) => (
              <div key={skill.skill_id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-300">{skill.domain_code}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate mb-1.5">{skill.skill_name}</p>
                  <ThetaBar
                    theta={skill.theta}
                    masteryLevel={skill.mastery_level}
                    isStale={skill.is_stale}
                    size="full"
                  />
                </div>
                <button
                  onClick={() => navigate(`/student/adaptive?skill=${skill.skill_id}&autostart=true`)}
                  className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors flex-shrink-0"
                >
                  Practice <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Strengths ── */}
      {skills?.strong_skills?.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-accent-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Your strengths</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {skills.strong_skills.slice(0, 3).map((skill) => (
              <div
                key={skill.skill_id}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-card px-4 py-3.5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-accent-50 dark:bg-accent-900/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-accent-600 dark:text-accent-400">{skill.domain_code}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{skill.skill_name}</p>
                </div>
                <ThetaBar
                  theta={skill.theta}
                  masteryLevel={skill.mastery_level}
                  isStale={skill.is_stale}
                  size="full"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Pending assignments ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Pending assignments</h2>
          </div>
          <Link to="/student/assignments" className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors">
            View all
          </Link>
        </div>

        {assignments.length > 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{a.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {a.total_questions} questions
                    {a.due_date && ` · Due ${new Date(a.due_date).toLocaleDateString()}`}
                  </p>
                </div>
                <Link to={`/student/test/${a.id}`}>
                  <Button size="sm">Start</Button>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card">
            <EmptyState
              icon={ClipboardList}
              title="No pending assignments"
              description="Check back later for new assignments from your tutor"
            />
          </div>
        )}
      </section>

    </div>
  );
};

export default StudentDashboard;
