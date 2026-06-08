/**
 * Tutor Dashboard — Study Hall.
 * Big-number stats (no gray BI cards), an act-on-able roster, and "common
 * struggles" that link straight to creating targeted practice. Borderless,
 * tokens, dark mode, a11y.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, ArrowRight, ArrowUpRight } from 'lucide-react';
import {
  Button, EmptyState, Skeleton, Avatar,
  PageHeader, Section, StatBlock, StatusPill,
} from '../../components/ui';
import { tutorService } from '../../services';

const TutorDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analyticsRes, studentsRes] = await Promise.all([
          tutorService.getAnalytics(),
          tutorService.getStudents({ limit: 5 }),
        ]);
        setAnalytics(analyticsRes.data);
        setStudents(studentsRes.data.items || []);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const hasStudents = students.length > 0;

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <PageHeader
        eyebrow="Your studio"
        title="Tutor dashboard"
        actions={
          <Link to="/tutor/students">
            <Button variant="primary"><Plus className="h-4 w-4" /> Invite student</Button>
          </Link>
        }
      />

      {/* Big-number stats — borderless row */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-edge py-6 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2"><Skeleton className="h-9 w-16" /><Skeleton className="h-3 w-20" /></div>
          ))}
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-edge py-6 lg:grid-cols-4">
          <StatBlock value={analytics.total_students} label="Total students" />
          <StatBlock value={analytics.active_students_this_week} label="Active this week" />
          <StatBlock
            value={analytics.assignments_completed}
            label="Assignments completed"
            hint={`of ${analytics.total_assignments_created} created`}
            animate
          />
          <StatBlock value={analytics.average_score ?? 0} suffix="%" decimals={0} label="Average score" />
        </div>
      ) : null}

      <div className="mt-10 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-5">
        {/* Roster */}
        <div className="lg:col-span-3">
          <Section
            title="Recent students"
            icon={Users}
            action={hasStudents ? <Link to="/tutor/students" className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-400">View all</Link> : null}
          >
            {isLoading ? (
              <ul className="divide-y divide-edge-subtle">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex items-center justify-between py-3.5">
                    <div className="flex items-center gap-3"><Skeleton className="h-9 w-9" rounded="rounded-full" /><div className="space-y-1.5"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-40" /></div></div>
                    <Skeleton className="h-5 w-10" />
                  </li>
                ))}
              </ul>
            ) : hasStudents ? (
              <ul className="divide-y divide-edge-subtle">
                {students.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/tutor/students/${s.id}`}
                      className="group flex items-center justify-between gap-3 rounded-xl py-3.5 transition-colors hover:bg-surface-muted -mx-2 px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={`${s.first_name} ${s.last_name}`} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-body">{s.first_name} {s.last_name}</p>
                          <p className="truncate text-xs text-ink-subtle">{s.email}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <StatusPill value={s.overall_accuracy} size="sm" />
                          <p className="mt-0.5 text-[11px] text-ink-faint">{s.total_questions_answered} questions</p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Users}
                title="No students yet"
                description="Invite your first student to start tracking their progress."
                action={<Link to="/tutor/students"><Button variant="primary" size="sm"><Plus className="h-4 w-4" /> Invite student</Button></Link>}
              />
            )}
          </Section>
        </div>

        {/* Common struggles — now act-on-able */}
        <div className="lg:col-span-2">
          <Section title="Where students struggle" hint="Assign targeted practice">
            {isLoading ? (
              <ul className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</ul>
            ) : analytics?.common_struggles?.length > 0 ? (
              <ul className="divide-y divide-edge-subtle">
                {analytics.common_struggles.slice(0, 5).map((skill) => (
                  <li key={skill.skill_id} className="flex items-center justify-between gap-3 py-3.5 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-body">{skill.skill_name}</p>
                      <p className="text-xs text-ink-subtle">
                        {skill.students_struggling} student{skill.students_struggling === 1 ? '' : 's'} below 70% · {skill.avg_accuracy?.toFixed(0)}% avg
                      </p>
                    </div>
                    <Link
                      to={`/tutor/assignments/create?skill=${skill.skill_id}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      Assign <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-subtle">No clear struggle areas yet. As students practice, common weak skills will surface here with one-click assigning.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
};

export default TutorDashboard;
