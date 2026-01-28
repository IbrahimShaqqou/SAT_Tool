/**
 * Student Dashboard Page
 * Simple overview with assignments due and recent scores
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, TrendingUp, Clock, Brain, Zap, PlayCircle, AlertTriangle, Target, ArrowRight } from 'lucide-react';
import { Card, Button, Badge, EmptyState, LoadingSpinner } from '../../components/ui';
import { assignmentService, progressService } from '../../services';

const StudentDashboard = () => {
  const navigate = useNavigate();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Your ZooPrep overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{progress?.overall_accuracy?.toFixed(0) || 0}%</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overall Accuracy</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{progress?.total_questions_answered || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Questions Answered</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{progress?.sessions_completed || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sessions Completed</p>
            </div>
          </div>
        </Card>
      </div>

      {/* In-Progress Assessments */}
      {inProgressAssessments.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10">
          <Card.Header>
            <div className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <Card.Title className="text-amber-900 dark:text-amber-200">Continue Your Assessment</Card.Title>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3">
              {inProgressAssessments.map((assessment) => (
                <div
                  key={assessment.session_id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-amber-100 dark:border-amber-800/30"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {assessment.title || 'Intake Assessment'}
                      </p>
                      <Badge variant="warning">In Progress</Badge>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {assessment.questions_answered} of {assessment.total_questions} questions answered
                      <span className="mx-2">•</span>
                      {assessment.subject_area === 'math' ? 'Math' : 'Reading & Writing'}
                      <span className="mx-2">•</span>
                      From {assessment.tutor_name}
                    </p>
                  </div>
                  <Link to={`/assess/${assessment.invite_token}`}>
                    <Button variant="primary" size="sm">
                      Resume
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

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

      {/* Weak Skills - Areas to Improve */}
      {skills && skills.weak_skills && skills.weak_skills.length > 0 && (
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                <Card.Title>Areas to Improve</Card.Title>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Based on your intake assessment</span>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3">
              {skills.weak_skills.map((skill) => (
                <div
                  key={skill.skill_id}
                  className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 bg-amber-100 dark:bg-amber-800/40 rounded-full flex items-center justify-center text-xs font-medium text-amber-700 dark:text-amber-300">
                        {skill.domain_code}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{skill.skill_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{skill.domain_name}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <span className={`font-medium ${skill.mastery_level < 30 ? 'text-rose-600 dark:text-rose-400' : skill.mastery_level < 60 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {Math.round(skill.mastery_level)}% mastery
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {skill.questions_correct}/{skill.questions_attempted} correct
                      </span>
                      {skill.ability_theta !== null && (
                        <span className="text-gray-500 dark:text-gray-400">
                          Ability: {skill.ability_theta > 0 ? '+' : ''}{skill.ability_theta}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/student/adaptive?skill=${skill.skill_id}&autostart=true`)}
                    className="ml-4 flex-shrink-0"
                  >
                    Practice
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Strong Skills */}
      {skills && skills.strong_skills && skills.strong_skills.length > 0 && (
        <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              <Card.Title>Your Strengths</Card.Title>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {skills.strong_skills.slice(0, 3).map((skill) => (
                <div
                  key={skill.skill_id}
                  className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-800/30 rounded-lg"
                >
                  <span className="w-8 h-8 bg-emerald-100 dark:bg-emerald-800/40 rounded-full flex items-center justify-center text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {skill.domain_code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">{skill.skill_name}</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{Math.round(skill.mastery_level)}% mastery</p>
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Pending Assignments */}
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <Card.Title>Pending Assignments</Card.Title>
            <Link to="/student/assignments" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
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
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{assignment.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
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
