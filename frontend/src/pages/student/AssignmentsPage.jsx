/**
 * Student Assignments — Study Hall.
 * Borderless list grouped under a hairline header, status via StatusPill,
 * filter as a quiet segmented control. Tokens, dark mode, skeletons, a11y.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button, EmptyState, Skeleton, PageHeader, Section, StatusPill } from '../../components/ui';
import { assignmentService } from '../../services';

const isOverdue = (dueDate, status) => {
  if (!dueDate || status === 'completed') return false;
  return new Date(dueDate) < new Date();
};

const getTimeUntilDue = (dueDate) => {
  if (!dueDate) return null;
  const diff = new Date(dueDate) - new Date();
  if (diff < 0) return 'Overdue';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;
  return 'Due soon';
};

const STATUS = {
  pending:     { tone: 'neutral', label: 'Not started' },
  in_progress: { tone: 'warn',    label: 'In progress' },
  completed:   { tone: 'good',    label: 'Completed' },
  overdue:     { tone: 'bad',     label: 'Overdue' },
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

const AssignmentsPage = () => {
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchAssignments = async () => {
      setIsLoading(true);
      try {
        const params = filter !== 'all' ? { status: filter } : {};
        const response = await assignmentService.getAssignments(params);
        setAssignments(response.data.items || []);
      } catch (error) {
        console.error('Failed to fetch assignments:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAssignments();
  }, [filter]);

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <PageHeader
        eyebrow="Your work"
        title="Assignments"
        subtitle="Practice your tutor assigned you. Finish what's due, then keep your streak going."
      />

      {/* Segmented filter */}
      <div role="tablist" aria-label="Filter assignments" className="mb-6 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                active
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-muted text-ink-muted hover:text-ink-body hover:bg-edge-subtle'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <ul className="divide-y divide-edge-subtle border-t border-edge">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center justify-between gap-4 py-5">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-9 w-20" rounded="rounded-xl" />
            </li>
          ))}
        </ul>
      ) : assignments.length === 0 ? (
        <Section>
          <EmptyState
            icon={ClipboardList}
            title={filter === 'all' ? 'No assignments yet' : `No ${filter.replace('_', ' ')} assignments`}
            description={
              filter === 'all'
                ? "When your tutor assigns practice, it'll show up here."
                : 'Try a different filter to see your other assignments.'
            }
          />
        </Section>
      ) : (
        <ul className="divide-y divide-edge-subtle border-t border-edge">
          {assignments.map((a) => {
            const overdue = isOverdue(a.due_date, a.status);
            const status = overdue ? STATUS.overdue : (STATUS[a.status] || STATUS.pending);
            const timeUntil = getTimeUntilDue(a.due_date);
            const done = a.status === 'completed';

            return (
              <li key={a.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-ink-body">{a.title}</h3>
                    <StatusPill tone={status.tone} size="sm">{status.label}</StatusPill>
                    {a.is_adaptive && (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-ink-subtle">Adaptive</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ink-subtle">
                    {a.total_questions
                      ? <>{a.questions_answered}/{a.total_questions} questions</>
                      : <>{a.questions_answered} questions answered</>}
                    {a.score_percentage != null && <> · Score {a.score_percentage.toFixed(0)}%</>}
                  </p>
                  {(a.due_date || a.time_limit_minutes) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                      {a.due_date && (
                        <p className={`flex items-center gap-1 text-xs ${overdue ? 'text-rose-600 dark:text-rose-400' : 'text-ink-faint'}`}>
                          {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          {overdue
                            ? <>Was due {new Date(a.due_date).toLocaleDateString()}</>
                            : <>Due {new Date(a.due_date).toLocaleDateString()} · {timeUntil}</>}
                        </p>
                      )}
                      {a.time_limit_minutes && (
                        <p className="flex items-center gap-1 text-xs text-ink-faint">
                          <Clock className="h-3.5 w-3.5" />{a.time_limit_minutes} min limit
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {done ? (
                    <Link to={`/student/results/${a.id}`}>
                      <Button variant="secondary" size="sm">View results <ArrowRight className="h-3.5 w-3.5" /></Button>
                    </Link>
                  ) : overdue ? (
                    <Link to={`/student/test/${a.id}`}>
                      <Button variant="secondary" size="sm">Catch up <ArrowRight className="h-3.5 w-3.5" /></Button>
                    </Link>
                  ) : (
                    <Link to={`/student/test/${a.id}`}>
                      <Button variant="primary" size="sm">
                        {a.status === 'in_progress' ? 'Continue' : 'Start'} <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AssignmentsPage;
