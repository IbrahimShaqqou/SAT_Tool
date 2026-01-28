/**
 * Student Assignments Page
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Clock, AlertTriangle } from 'lucide-react';
import { Card, Button, Badge, Tabs, EmptyState, LoadingSpinner } from '../../components/ui';
import { assignmentService } from '../../services';

/**
 * Check if assignment is overdue
 */
const isOverdue = (dueDate, status) => {
  if (!dueDate || status === 'completed') return false;
  return new Date(dueDate) < new Date();
};

/**
 * Get time until due date as a human-readable string
 */
const getTimeUntilDue = (dueDate) => {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due - now;

  if (diff < 0) return 'Overdue';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;
  return 'Due soon';
};

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

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'default',
      in_progress: 'info',
      completed: 'success',
      overdue: 'danger',
    };
    const labels = {
      pending: 'Not Started',
      in_progress: 'In Progress',
      completed: 'Completed',
      overdue: 'Overdue',
    };
    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">My Assignments</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">View and complete your assigned practice</p>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <Tabs.List>
          <Tabs.Trigger value="all">All</Tabs.Trigger>
          <Tabs.Trigger value="pending">Pending</Tabs.Trigger>
          <Tabs.Trigger value="in_progress">In Progress</Tabs.Trigger>
          <Tabs.Trigger value="completed">Completed</Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : assignments.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No assignments"
            description={
              filter === 'all'
                ? "You don't have any assignments yet"
                : `No ${filter.replace('_', ' ')} assignments`
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            const overdue = isOverdue(assignment.due_date, assignment.status);
            const timeUntil = getTimeUntilDue(assignment.due_date);

            return (
              <Card key={assignment.id} className={overdue ? 'border-rose-200 dark:border-rose-800/50 bg-rose-50/50 dark:bg-rose-900/10' : ''}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">{assignment.title}</h3>
                      {overdue ? (
                        <Badge variant="danger">Overdue</Badge>
                      ) : (
                        getStatusBadge(assignment.status)
                      )}
                      {assignment.is_adaptive && (
                        <Badge variant="info" size="sm">Adaptive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {assignment.total_questions ? (
                        <>{assignment.questions_answered}/{assignment.total_questions} questions</>
                      ) : (
                        <>{assignment.questions_answered} questions answered (unlimited)</>
                      )}
                      {assignment.score_percentage !== null && (
                        <> - Score: {assignment.score_percentage.toFixed(0)}%</>
                      )}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      {assignment.due_date && (
                        <p className={`text-sm flex items-center gap-1 ${overdue ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400 dark:text-gray-500'}`}>
                          {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          {overdue ? (
                            <>Overdue - was due {new Date(assignment.due_date).toLocaleDateString()}</>
                          ) : (
                            <>Due: {new Date(assignment.due_date).toLocaleDateString()} ({timeUntil})</>
                          )}
                        </p>
                      )}
                      {assignment.time_limit_minutes && (
                        <p className="text-sm text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {assignment.time_limit_minutes} min limit
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    {assignment.status === 'completed' ? (
                      <Link to={`/student/results/${assignment.id}`}>
                        <Button variant="secondary" size="sm">View Results</Button>
                      </Link>
                    ) : overdue ? (
                      <Button variant="secondary" size="sm" disabled>
                        Overdue
                      </Button>
                    ) : (
                      <Link to={`/student/test/${assignment.id}`}>
                        <Button variant="primary" size="sm">
                          {assignment.status === 'in_progress' ? 'Continue' : 'Start'}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AssignmentsPage;
