/**
 * Student Dashboard
 * Personalized greeting, action-forward, clean data display
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList, Brain,
  PlayCircle, AlertTriangle, Target, ArrowRight,
  BookOpen, GraduationCap, BarChart3,
} from 'lucide-react';
import { Button, Badge, EmptyState, LoadingSpinner } from '../../components/ui';
import { assignmentService, progressService } from '../../services';
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assignmentsRes, progressRes, inProgressRes, skillsRes] = await Promise.all([
          assignmentService.getAssignments({ status: 'pending', limit: 5 }),
          progressService.getSummary(),
          progressService.getInProgressAssessments(),
          progressService.getSkills().catch(() => ({ data: { skills: [], weak_skills: [], strong_skills: [] } })),
        ]);
        setAssignments(assignmentsRes.data.items || []);
        setProgress(progressRes.data);
        setInProgressAssessments(inProgressRes.data.items || []);
        setSkills(skillsRes.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

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
        </div>
      </div>

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
                    {' · '}{a.subject_area === 'math' ? 'Math' : 'Reading & Writing'}
                    {' · '}From {a.tutor_name}
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

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/student/adaptive', icon: Brain, label: 'Adaptive Practice', color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/20' },
          { to: '/student/questions', icon: BookOpen, label: 'Question Bank', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
          { to: '/student/lessons', icon: GraduationCap, label: 'Skill Lessons', color: 'text-accent-600', bg: 'bg-accent-50 dark:bg-accent-900/20' },
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

      {/* ── Areas to improve ── */}
      {skills?.weak_skills?.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Areas to improve</h2>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">From your intake assessment</span>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
            {skills.weak_skills.map((skill) => {
              const pct = Math.round(skill.mastery_level);
              const color = pct < 30 ? 'bg-rose-400' : pct < 60 ? 'bg-amber-400' : 'bg-accent-400';
              return (
                <div key={skill.skill_id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-300">{skill.domain_code}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{skill.skill_name}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-[120px]">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">{pct}% mastery</span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/student/adaptive?skill=${skill.skill_id}&autostart=true`)}
                    className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors flex-shrink-0"
                  >
                    Practice <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
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
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-card px-4 py-3.5 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-accent-50 dark:bg-accent-900/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-accent-600 dark:text-accent-400">{skill.domain_code}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{skill.skill_name}</p>
                  <p className="text-xs text-accent-600 dark:text-accent-400 font-semibold mt-0.5">{Math.round(skill.mastery_level)}% mastery</p>
                </div>
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
