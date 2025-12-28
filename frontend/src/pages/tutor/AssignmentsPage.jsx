/**
 * Tutor Assignments Page
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList } from 'lucide-react';
import { Card, Button, Badge, Table, EmptyState, LoadingSpinner } from '../../components/ui';
import { assignmentService } from '../../services';

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

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'default',
      in_progress: 'info',
      completed: 'success',
      overdue: 'danger',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
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
                <Table.Head>Title</Table.Head>
                <Table.Head>Student</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Progress</Table.Head>
                <Table.Head>Due Date</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {assignments.map((assignment) => (
                <Table.Row key={assignment.id}>
                  <Table.Cell className="font-medium">{assignment.title}</Table.Cell>
                  <Table.Cell>{assignment.student_name}</Table.Cell>
                  <Table.Cell>{getStatusBadge(assignment.status)}</Table.Cell>
                  <Table.Cell>
                    {assignment.questions_answered}/{assignment.total_questions}
                  </Table.Cell>
                  <Table.Cell className="text-gray-500">
                    {assignment.due_date
                      ? new Date(assignment.due_date).toLocaleDateString()
                      : 'No deadline'}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default AssignmentsPage;
