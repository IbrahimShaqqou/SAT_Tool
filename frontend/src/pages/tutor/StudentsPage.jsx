/**
 * Tutor Students List Page
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, UserPlus } from 'lucide-react';
import { Card, Button, Table, Avatar, Badge, EmptyState, LoadingSpinner, Modal, Input } from '../../components/ui';
import { tutorService } from '../../services';
import { useDebounce } from '../../hooks';
import { useToast } from '../../components/ui/Toast';

const StudentsPage = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Add student modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const toast = useToast();

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const response = await tutorService.getStudents({
        search: debouncedSearch || undefined,
      });
      setStudents(response.data.items || []);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [debouncedSearch]);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setAddError('');
    setIsAdding(true);

    try {
      await tutorService.addStudent(studentEmail);
      toast.success(`Student ${studentEmail} added successfully`);
      setShowAddModal(false);
      setStudentEmail('');
      fetchStudents(); // Refresh list
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to add student';
      setAddError(typeof message === 'string' ? message : 'Failed to add student. Make sure the email is registered as a student.');
    } finally {
      setIsAdding(false);
    }
  };

  const getAccuracyBadge = (accuracy) => {
    if (accuracy === null || accuracy === undefined) return null;
    if (accuracy >= 80) return <Badge variant="success">{accuracy.toFixed(0)}%</Badge>;
    if (accuracy >= 60) return <Badge variant="warning">{accuracy.toFixed(0)}%</Badge>;
    return <Badge variant="danger">{accuracy.toFixed(0)}%</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
          <p className="text-gray-500 mt-1">Manage your student roster</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card padding="sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </Card>

      {/* Students Table */}
      <Card padding="none">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students found"
            description={searchQuery ? "Try a different search term" : "Add your first student to get started"}
            action={
              !searchQuery && (
                <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add Student
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Student</Table.Head>
                <Table.Head>Accuracy</Table.Head>
                <Table.Head>Questions</Table.Head>
                <Table.Head>Assignments</Table.Head>
                <Table.Head>Last Active</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {students.map((student) => (
                <Table.Row
                  key={student.id}
                  onClick={() => navigate(`/tutor/students/${student.id}`)}
                  className="cursor-pointer"
                >
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <Avatar name={`${student.first_name} ${student.last_name}`} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-sm text-gray-500">{student.email}</p>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {getAccuracyBadge(student.overall_accuracy)}
                  </Table.Cell>
                  <Table.Cell>
                    {student.total_questions_answered || 0}
                  </Table.Cell>
                  <Table.Cell>
                    {student.assignments_pending || 0} pending
                  </Table.Cell>
                  <Table.Cell className="text-gray-500">
                    {student.last_active_at
                      ? new Date(student.last_active_at).toLocaleDateString()
                      : 'Never'}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>

      {/* Add Student Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setStudentEmail('');
          setAddError('');
        }}
        title="Add Student"
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter the email address of a registered student account to add them to your roster.
          </p>

          {addError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
              {addError}
            </div>
          )}

          <Input
            label="Student Email"
            type="email"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            placeholder="student@example.com"
            required
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddModal(false);
                setStudentEmail('');
                setAddError('');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isAdding}>
              Add Student
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StudentsPage;
