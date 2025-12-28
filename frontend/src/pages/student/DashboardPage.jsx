/**
 * Student Dashboard Page
 * Simple overview with assignments due and recent scores
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, TrendingUp, Clock, Brain, Zap } from 'lucide-react';
import { Card, Button, EmptyState, LoadingSpinner } from '../../components/ui';
import { assignmentService, progressService } from '../../services';

const StudentDashboard = () => {
  const [assignments, setAssignments] = useState([]);
  const [progress, setProgress] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assignmentsRes, progressRes] = await Promise.all([
          assignmentService.getAssignments({ status: 'pending', limit: 5 }),
          progressService.getSummary(),
        ]);
        setAssignments(assignmentsRes.data.items || []);
        setProgress(progressRes.data);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Your SAT prep overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{progress?.overall_accuracy?.toFixed(0) || 0}%</p>
              <p className="text-sm text-gray-500">Overall Accuracy</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ClipboardList className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{progress?.total_questions_answered || 0}</p>
              <p className="text-sm text-gray-500">Questions Answered</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{progress?.sessions_completed || 0}</p>
              <p className="text-sm text-gray-500">Sessions Completed</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Adaptive Practice Card */}
      <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Brain className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Adaptive Practice</h3>
              <p className="text-purple-100 mt-1">
                AI-powered questions tailored to your skill level
              </p>
            </div>
          </div>
          <Link to="/student/adaptive">
            <button className="inline-flex items-center px-4 py-2 bg-white text-purple-600 hover:bg-purple-50 font-medium rounded-lg transition-colors">
              <Zap className="h-4 w-4 mr-2" />
              Start Practice
            </button>
          </Link>
        </div>
      </Card>

      {/* Pending Assignments */}
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <Card.Title>Pending Assignments</Card.Title>
            <Link to="/student/assignments" className="text-sm text-gray-500 hover:text-gray-700">
              View all
            </Link>
          </div>
        </Card.Header>
        <Card.Content>
          {assignments.length > 0 ? (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{assignment.title}</p>
                    <p className="text-sm text-gray-500">
                      {assignment.total_questions} questions
                      {assignment.due_date && (
                        <> - Due {new Date(assignment.due_date).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <Link to={`/student/test/${assignment.id}`}>
                    <Button variant="primary" size="sm">Start</Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="No pending assignments"
              description="Check back later for new assignments from your tutor"
            />
          )}
        </Card.Content>
      </Card>
    </div>
  );
};

export default StudentDashboard;
