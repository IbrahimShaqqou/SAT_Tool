/**
 * Student Detail Page - Comprehensive student analytics with domain/skill mastery
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  Target,
  Clock,
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle,
  XCircle,
  BarChart3,
  Zap,
} from 'lucide-react';
import { Card, Button, Badge, ProgressBar, Tabs, LoadingSpinner } from '../../components/ui';
import { AccuracyTrend, SkillBreakdown, DomainRadar } from '../../components/charts';
import { tutorService } from '../../services';

// Mastery level helper
const getMasteryLevel = (accuracy, questionsAttempted) => {
  if (questionsAttempted < 3) return { level: 'Not enough data', color: 'gray', icon: null };
  if (accuracy >= 90) return { level: 'Mastered', color: 'green', icon: CheckCircle };
  if (accuracy >= 70) return { level: 'Proficient', color: 'blue', icon: TrendingUp };
  if (accuracy >= 50) return { level: 'Developing', color: 'amber', icon: Target };
  return { level: 'Needs Practice', color: 'red', icon: AlertTriangle };
};

// IRT ability level helper
const getAbilityLevel = (theta) => {
  if (theta === null || theta === undefined) return { level: 'Unknown', color: 'gray' };
  if (theta >= 1.5) return { level: 'Advanced', color: 'green' };
  if (theta >= 0.5) return { level: 'Proficient', color: 'blue' };
  if (theta >= -0.5) return { level: 'Developing', color: 'amber' };
  return { level: 'Beginning', color: 'red' };
};

// Domain Card Component
const DomainMasteryCard = ({ domain, skills }) => {
  const domainSkills = skills?.filter(s => s.domain_name === domain.domain_name) || [];
  const mastery = getMasteryLevel(domain.accuracy, domain.questions_attempted);
  const MasteryIcon = mastery.icon;

  return (
    <Card className="overflow-hidden">
      <div className={`h-2 bg-${mastery.color}-500`} />
      <Card.Content className="pt-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">{domain.domain_name}</h3>
            <p className="text-sm text-gray-500">{domain.questions_attempted} questions</p>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold text-${mastery.color}-600`}>
              {domain.accuracy.toFixed(0)}%
            </span>
            <div className="flex items-center gap-1 mt-1">
              {MasteryIcon && <MasteryIcon className={`h-3 w-3 text-${mastery.color}-500`} />}
              <span className={`text-xs text-${mastery.color}-600`}>{mastery.level}</span>
            </div>
          </div>
        </div>

        <ProgressBar value={domain.accuracy} variant="auto" size="sm" />

        {domainSkills.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Skills in this domain</p>
            {domainSkills.slice(0, 4).map(skill => (
              <div key={skill.skill_id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 truncate flex-1 mr-2">{skill.skill_name}</span>
                <span className={`font-medium ${
                  skill.accuracy >= 70 ? 'text-green-600' :
                  skill.accuracy >= 50 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {skill.accuracy.toFixed(0)}%
                </span>
              </div>
            ))}
            {domainSkills.length > 4 && (
              <p className="text-xs text-gray-400">+{domainSkills.length - 4} more skills</p>
            )}
          </div>
        )}
      </Card.Content>
    </Card>
  );
};

// Skill Mastery Row Component
const SkillMasteryRow = ({ skill }) => {
  const mastery = getMasteryLevel(skill.accuracy, skill.questions_attempted);
  const ability = getAbilityLevel(skill.ability_theta);
  const MasteryIcon = mastery.icon;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {MasteryIcon && <MasteryIcon className={`h-4 w-4 text-${mastery.color}-500`} />}
            <h4 className="font-medium text-gray-900">{skill.skill_name}</h4>
          </div>
          <p className="text-sm text-gray-500 mt-1">{skill.domain_name}</p>
        </div>
        <div className="text-right">
          <span className={`text-xl font-bold text-${mastery.color}-600`}>
            {skill.accuracy.toFixed(0)}%
          </span>
          <p className="text-xs text-gray-500">{skill.questions_attempted} questions</p>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar value={skill.accuracy} variant="auto" size="sm" />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className={`px-2 py-0.5 rounded-full text-xs bg-${mastery.color}-100 text-${mastery.color}-700`}>
          {mastery.level}
        </span>
        {skill.ability_theta !== null && skill.ability_theta !== undefined && (
          <span className={`flex items-center gap-1 text-xs text-${ability.color}-600`}>
            <Brain className="h-3 w-3" />
            IRT: {skill.ability_theta > 0 ? '+' : ''}{skill.ability_theta.toFixed(2)}
            <span className="text-gray-400">({ability.level})</span>
          </span>
        )}
      </div>
    </div>
  );
};

const StudentDetailPage = () => {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [progress, setProgress] = useState(null);
  const [weaknesses, setWeaknesses] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [partialErrors, setPartialErrors] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      setPartialErrors({});

      try {
        // First fetch the student to verify they exist
        const studentRes = await tutorService.getStudent(id);
        setStudent(studentRes.data);
      } catch (err) {
        console.error('Failed to fetch student:', err);
        const message = err.response?.data?.detail || 'Failed to load student data';
        setError(message);
        setIsLoading(false);
        return;
      }

      // Fetch additional data with individual error handling
      const fetchProgress = async () => {
        try {
          const res = await tutorService.getStudentProgress(id);
          setProgress(res.data);
        } catch (err) {
          console.error('Failed to fetch progress:', err);
          setPartialErrors(prev => ({ ...prev, progress: true }));
        }
      };

      const fetchWeaknesses = async () => {
        try {
          const res = await tutorService.getStudentWeaknesses(id);
          setWeaknesses(res.data);
        } catch (err) {
          console.error('Failed to fetch weaknesses:', err);
          setPartialErrors(prev => ({ ...prev, weaknesses: true }));
        }
      };

      const fetchCharts = async () => {
        try {
          const res = await tutorService.getStudentChartData(id, { days: 30 });
          setChartData(res.data);
        } catch (err) {
          console.error('Failed to fetch charts:', err);
          setPartialErrors(prev => ({ ...prev, charts: true }));
        }
      };

      await Promise.all([fetchProgress(), fetchWeaknesses(), fetchCharts()]);
      setIsLoading(false);
    };

    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to load student</h2>
        <p className="text-gray-500 mb-6">
          {error || 'The student may not be in your roster or the student ID is invalid.'}
        </p>
        <Link to="/tutor/students">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Students
          </Button>
        </Link>
      </div>
    );
  }

  // Transform chart data
  const accuracyData = chartData?.accuracy_trend || [];
  const skillData = chartData?.skill_breakdown?.map(s => ({
    name: s.name,
    accuracy: s.accuracy,
    questions: s.questions,
  })) || [];
  const domainData = chartData?.domain_performance?.map(d => ({
    domain: d.domain,
    accuracy: d.accuracy,
    fullMark: 100,
  })) || [];

  // Calculate summary stats
  const totalQuestions = progress?.total_questions_answered || 0;
  const overallAccuracy = progress?.overall_accuracy || 0;
  const weakAreasCount = weaknesses?.weak_skills?.length || 0;
  const masteredCount = progress?.skills?.filter(s => s.accuracy >= 90 && s.questions_attempted >= 3).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/tutor/students">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {student.first_name} {student.last_name}
            </h1>
            <p className="text-gray-500">{student.email}</p>
          </div>
        </div>
        <Link to={`/tutor/assignments/new?student=${id}`}>
          <Button variant="primary">
            <Zap className="h-4 w-4 mr-2" />
            Create Assignment
          </Button>
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 opacity-80" />
            <div>
              <p className="text-3xl font-bold">{overallAccuracy.toFixed(0)}%</p>
              <p className="text-sm opacity-80">Overall Accuracy</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Target className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{totalQuestions}</p>
              <p className="text-sm text-gray-500">Questions</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{masteredCount}</p>
              <p className="text-sm text-gray-500">Skills Mastered</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{weakAreasCount}</p>
              <p className="text-sm text-gray-500">Weak Areas</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Clock className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{progress?.sessions_completed || 0}</p>
              <p className="text-sm text-gray-500">Sessions</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="domains">
        <Tabs.List>
          <Tabs.Trigger value="domains">
            <BookOpen className="h-4 w-4 mr-2" />
            Domain Mastery
          </Tabs.Trigger>
          <Tabs.Trigger value="skills">
            <Brain className="h-4 w-4 mr-2" />
            Skill Details
          </Tabs.Trigger>
          <Tabs.Trigger value="weaknesses">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Focus Areas
          </Tabs.Trigger>
          <Tabs.Trigger value="trends">
            <BarChart3 className="h-4 w-4 mr-2" />
            Trends
          </Tabs.Trigger>
        </Tabs.List>

        {/* Domain Mastery Tab */}
        <Tabs.Content value="domains">
          <div className="space-y-6">
            {progress?.domains?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {progress.domains.map(domain => (
                  <DomainMasteryCard
                    key={domain.domain_id}
                    domain={domain}
                    skills={progress.skills}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Domain Data Yet</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    As {student.first_name} completes practice sessions, their domain mastery will appear here.
                  </p>
                </div>
              </Card>
            )}

            {/* Domain Performance Chart */}
            {domainData.length > 0 && (
              <Card>
                <Card.Header>
                  <Card.Title>Domain Performance Overview</Card.Title>
                  <Card.Description>Visual comparison across all domains</Card.Description>
                </Card.Header>
                <Card.Content>
                  <DomainRadar data={domainData} height={300} />
                </Card.Content>
              </Card>
            )}
          </div>
        </Tabs.Content>

        {/* Skill Details Tab */}
        <Tabs.Content value="skills">
          <Card>
            <Card.Header>
              <Card.Title>All Skills Progress</Card.Title>
              <Card.Description>
                Detailed breakdown of each skill with IRT ability estimates
              </Card.Description>
            </Card.Header>
            <Card.Content>
              {progress?.skills?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {progress.skills
                    .sort((a, b) => b.questions_attempted - a.questions_attempted)
                    .map(skill => (
                      <SkillMasteryRow key={skill.skill_id} skill={skill} />
                    ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Brain className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Skill Data Yet</h3>
                  <p className="text-gray-500">
                    Skills will appear here once {student.first_name} answers some practice questions.
                  </p>
                </div>
              )}
            </Card.Content>
          </Card>
        </Tabs.Content>

        {/* Focus Areas Tab */}
        <Tabs.Content value="weaknesses">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <Card.Header>
                <Card.Title className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  Skills Needing Practice
                </Card.Title>
                <Card.Description>Below 70% accuracy with at least 3 attempts</Card.Description>
              </Card.Header>
              <Card.Content>
                {weaknesses?.weak_skills?.length > 0 ? (
                  <div className="space-y-3">
                    {weaknesses.weak_skills.map(skill => (
                      <div
                        key={skill.skill_id}
                        className={`p-4 rounded-lg border-l-4 ${
                          skill.priority === 'high'
                            ? 'bg-red-50 border-red-500'
                            : skill.priority === 'medium'
                            ? 'bg-amber-50 border-amber-500'
                            : 'bg-gray-50 border-gray-400'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{skill.skill_name}</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              {skill.questions_attempted} questions attempted
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xl font-bold ${
                              skill.accuracy < 50 ? 'text-red-600' : 'text-amber-600'
                            }`}>
                              {skill.accuracy.toFixed(0)}%
                            </span>
                            <Badge
                              variant={skill.priority === 'high' ? 'danger' : 'warning'}
                              className="block mt-1"
                            >
                              {skill.priority} priority
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Great Progress!</h3>
                    <p className="text-gray-500">
                      No significant weak areas detected. Keep up the good work!
                    </p>
                  </div>
                )}
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <Card.Title>Recommended Actions</Card.Title>
                <Card.Description>Suggested next steps for improvement</Card.Description>
              </Card.Header>
              <Card.Content>
                {weaknesses?.weak_skills?.length > 0 ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Create Targeted Practice</h4>
                      <p className="text-sm text-blue-700 mb-3">
                        Focus on the {weaknesses.weak_skills.filter(s => s.priority === 'high').length || 1} high-priority skill(s) listed.
                      </p>
                      <Link to={`/tutor/assignments/new?student=${id}&skills=${weaknesses.weak_skills.slice(0, 3).map(s => s.skill_id).join(',')}`}>
                        <Button variant="primary" size="sm">
                          <Zap className="h-4 w-4 mr-2" />
                          Create Practice Assignment
                        </Button>
                      </Link>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Review Mistakes</h4>
                      <p className="text-sm text-gray-600">
                        Look at the specific questions {student.first_name} got wrong in these skill areas to identify patterns.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">Keep Challenging!</h4>
                    <p className="text-sm text-green-700">
                      {student.first_name} is doing well. Consider introducing more advanced questions or new topics to continue growth.
                    </p>
                  </div>
                )}
              </Card.Content>
            </Card>
          </div>
        </Tabs.Content>

        {/* Trends Tab */}
        <Tabs.Content value="trends">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <Card.Header>
                <Card.Title>Accuracy Over Time</Card.Title>
                <Card.Description>Performance trend over the past 30 days</Card.Description>
              </Card.Header>
              <Card.Content>
                {accuracyData.length > 0 ? (
                  <AccuracyTrend data={accuracyData} height={250} />
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Not enough data points for trend analysis</p>
                  </div>
                )}
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <Card.Title>Top Practiced Skills</Card.Title>
                <Card.Description>Skills with most practice activity</Card.Description>
              </Card.Header>
              <Card.Content>
                {skillData.length > 0 ? (
                  <SkillBreakdown data={skillData.slice(0, 8)} height={250} />
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No skill data available yet</p>
                  </div>
                )}
              </Card.Content>
            </Card>
          </div>
        </Tabs.Content>
      </Tabs>
    </div>
  );
};

export default StudentDetailPage;
