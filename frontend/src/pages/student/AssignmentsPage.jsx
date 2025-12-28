/**
 * Student Assignments Page
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { Card, Button, Badge, Tabs, EmptyState, LoadingSpinner } from '../../components/ui';
import { assignmentService } from '../../services';

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
        <h1 className="text-2xl font-semibold text-gray-900">My Assignments</h1>
        <p className="text-gray-500 mt-1">View and complete your assigned practice</p>
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
          {assignments.map((assignment) => (
            <Card key={assignment.id}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-gray-900">{assignment.title}</h3>
                    {getStatusBadge(assignment.status)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {assignment.questions_answered}/{assignment.total_questions} questions
                    {assignment.score_percentage !== null && (
                      <> - Score: {assignment.score_percentage.toFixed(0)}%</>
                    )}
                  </p>
                  {assignment.due_date && (
                    <p className="text-sm text-gray-400 mt-0.5">
                      Due: {new Date(assignment.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div>
                  {assignment.status === 'completed' ? (
                    <Link to={`/student/results/${assignment.id}`}>
                      <Button variant="secondary" size="sm">View Results</Button>
                    </Link>
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
          ))}
        </div>
      )}
    </div>
  );
};

export default AssignmentsPage;
