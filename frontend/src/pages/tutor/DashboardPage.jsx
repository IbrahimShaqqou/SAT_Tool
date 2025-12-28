/**
 * Tutor Dashboard Page
 * Overview with student count, recent activity, quick stats
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, ClipboardList, TrendingUp, Plus } from 'lucide-react';
import { Card, Button, EmptyState, LoadingSpinner } from '../../components/ui';
import { tutorService } from '../../services';

const StatCard = ({ icon: Icon, label, value, subtext }) => (
  <Card className="flex items-center gap-4">
    <div className="p-3 bg-gray-100 rounded-lg">
      <Icon className="h-6 w-6 text-gray-600" />
    </div>
    <div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {subtext && <p className="text-xs text-gray-400 mt-0.5">{subtext}</p>}
    </div>
  </Card>
);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const hasStudents = students.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your tutoring activity</p>
        </div>
        <Link to="/tutor/invites">
          <Button variant="primary">
            <Plus className="h-4 w-4 mr-2" />
            Invite Student
          </Button>
        </Link>
      </div>

      {/* Stats */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total Students"
            value={analytics.total_students}
          />
          <StatCard
            icon={Users}
            label="Active This Week"
            value={analytics.active_students_this_week}
          />
          <StatCard
            icon={ClipboardList}
            label="Assignments"
            value={`${analytics.assignments_completed}/${analytics.total_assignments_created}`}
            subtext="completed"
          />
          <StatCard
            icon={TrendingUp}
            label="Average Score"
            value={`${analytics.average_score?.toFixed(1) || 0}%`}
          />
        </div>
      )}

      {/* Recent Students or Empty State */}
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <Card.Title>Recent Students</Card.Title>
            {hasStudents && (
              <Link to="/tutor/students" className="text-sm text-gray-500 hover:text-gray-700">
                View all
              </Link>
            )}
          </div>
        </Card.Header>
        <Card.Content>
          {hasStudents ? (
            <div className="divide-y divide-gray-100">
              {students.map((student) => (
                <Link
                  key={student.id}
                  to={`/tutor/students/${student.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {student.first_name} {student.last_name}
                    </p>
                    <p className="text-sm text-gray-500">{student.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {student.overall_accuracy?.toFixed(0) || 0}%
                    </p>
                    <p className="text-xs text-gray-500">
                      {student.total_questions_answered} questions
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No students yet"
              description="Invite your first student to get started"
              action={
                <Link to="/tutor/invites">
                  <Button variant="primary" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Invite Student
                  </Button>
                </Link>
              }
            />
          )}
        </Card.Content>
      </Card>

      {/* Common Struggles */}
      {analytics?.common_struggles?.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>Common Struggles</Card.Title>
            <Card.Description>Skills where students need more practice</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3">
              {analytics.common_struggles.slice(0, 5).map((skill) => (
                <div key={skill.skill_id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{skill.skill_name}</p>
                    <p className="text-xs text-gray-500">
                      {skill.students_struggling} students below 70%
                    </p>
                  </div>
                  <span className="text-sm text-gray-600">
                    {skill.avg_accuracy?.toFixed(0)}% avg
                  </span>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
};

export default TutorDashboard;
