/**
 * Tutor Assignments Page
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList, Clock, Brain, AlertTriangle, Calendar, TimerOff } from 'lucide-react';
import { Card, Button, Badge, Table, EmptyState, LoadingSpinner } from '../../components/ui';
import { assignmentService } from '../../services';

/**
 * Check if assignment is overdue
 */
const isOverdue = (dueDate, status) => {
  if (!dueDate || status === 'completed') return false;
  return new Date(dueDate) < new Date();
};

const AssignmentsPage = () => {
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const response = await assignmentService.getAssignments();
        setAssignments(response.data.items || []);
      } catch (error) {
        console.error('Failed to fetch assignments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignments();
  }, []);

  const getStatusBadge = (assignment) => {
    const { status, due_date, time_expired } = assignment;
    const overdue = isOverdue(due_date, status);

    if (overdue && status !== 'completed') {
      return <Badge variant="danger">Overdue</Badge>;
    }

    // Show time expired indicator for completed assignments that ran out of time
    if (status === 'completed' && time_expired) {
      return (
        <div className="flex items-center gap-1.5">
          <Badge variant="warning">Time Expired</Badge>
        </div>
      );
    }

    const variants = {
      pending: 'default',
      in_progress: 'info',
      completed: 'success',
    };
    const labels = {
      pending: 'Not Started',
      in_progress: 'In Progress',
      completed: 'Completed',
    };
    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Assignments</h1>
          <p className="text-gray-500 mt-1">Create and manage student assignments</p>
        </div>
        <Link to="/tutor/assignments/new">
          <Button variant="primary">
            <Plus className="h-4 w-4 mr-2" />
            Create Assignment
          </Button>
        </Link>
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No assignments yet"
            description="Create your first assignment for a student"
            action={
              <Link to="/tutor/assignments/new">
                <Button variant="primary" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Create Assignment
                </Button>
              </Link>
            }
          />
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Assignment</Table.Head>
                <Table.Head>Student</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Progress</Table.Head>
                <Table.Head>Settings</Table.Head>
                <Table.Head>Due Date</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {assignments.map((assignment) => {
                const overdue = isOverdue(assignment.due_date, assignment.status);
                return (
                  <Table.Row key={assignment.id} className={overdue ? 'bg-red-50' : ''}>
                    <Table.Cell>
                      <div>
                        <span className="font-medium text-gray-900">{assignment.title}</span>
                        {assignment.is_adaptive && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            <Brain className="h-3 w-3" />
                            Adaptive
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>{assignment.student_name}</Table.Cell>
                    <Table.Cell>{getStatusBadge(assignment)}</Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900">
                          {assignment.questions_answered}
                          {assignment.total_questions ? `/${assignment.total_questions}` : ''}
                        </span>
                        {assignment.score_percentage !== null && (
                          <span className={`text-sm ${
                            assignment.score_percentage >= 70 ? 'text-green-600' :
                            assignment.score_percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            ({assignment.score_percentage.toFixed(0)}%)
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        {assignment.time_limit_minutes && (
                          <span className={`flex items-center gap-1 ${assignment.time_expired ? 'text-amber-600' : ''}`} title={assignment.time_expired ? 'Timer Ran Out' : 'Time Limit'}>
                            {assignment.time_expired ? (
                              <TimerOff className="h-3.5 w-3.5" />
                            ) : (
                              <Clock className="h-3.5 w-3.5" />
                            )}
                            {assignment.time_limit_minutes}m
                          </span>
                        )}
                        {!assignment.total_questions && (
                          <span className="text-xs text-gray-400">Unlimited</span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {assignment.due_date ? (
                        <div className={`flex items-center gap-1 text-sm ${
                          overdue ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {overdue && <AlertTriangle className="h-3.5 w-3.5" />}
                          {new Date(assignment.due_date).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No deadline</span>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default AssignmentsPage;
