/**
 * My Progress Page
 * Comprehensive view of student's learning progress using Khan Academy-style 4-level mastery
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Target, Award, Clock, BookOpen, ChevronDown, ChevronUp, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, Badge, LoadingSpinner } from '../../components/ui';
import {
  MasteryBadge,
  MasterySummary,
  SkillMasteryRow,
} from '../../components/ui/MasteryBadge';
import { progressService } from '../../services';

const ProgressPage = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [skills, setSkills] = useState(null);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDomains, setExpandedDomains] = useState(new Set());

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const [summaryRes, skillsRes, historyRes] = await Promise.all([
          progressService.getSummary(),
          progressService.getSkills().catch(() => ({
            data: {
              skills: [],
              weak_skills: [],
              strong_skills: [],
              skills_mastered: 0,
              skills_proficient: 0,
              skills_familiar: 0,
              skills_not_started: 0,
              needs_review_count: 0,
            }
          })),
          progressService.getScoreHistory().catch(() => ({ data: { history: [] } })),
        ]);
        setProgress(summaryRes.data);
        setSkills(skillsRes.data);
        setScoreHistory(historyRes.data.history || []);
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgress();
  }, []);

  const toggleDomain = (domain) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  // Group skills by domain
  const groupedSkills = skills?.skills?.reduce((acc, skill) => {
    const domain = skill.domain_name || 'Other';
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(skill);
    return acc;
  }, {}) || {};

  // Calculate average mastery level for a domain (using the 0-3 scale)
  const getDomainAvgLevel = (domainSkills) => {
    if (!domainSkills.length) return 0;
    return domainSkills.reduce((sum, s) => sum + (s.mastery_level || 0), 0) / domainSkills.length;
  };

  // Get badge variant based on mastery level
  const getLevelBadgeVariant = (level) => {
    if (level >= 2.5) return 'success';
    if (level >= 1.5) return 'info';
    if (level >= 0.5) return 'warning';
    return 'default';
  };

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
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">My Progress</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Track your preparation journey</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {progress?.overall_accuracy?.toFixed(0) || 0}%
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Accuracy</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {progress?.total_questions_answered || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Questions</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {progress?.assignments_completed || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Assignments</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {Math.round((progress?.total_time_spent || 0) / 60)}m
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Practice Time</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Score History Chart */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-500" />
            Score History
          </Card.Title>
          <Card.Description>Estimated SAT score over time</Card.Description>
        </Card.Header>
        <Card.Content>
          {scoreHistory.length >= 2 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={scoreHistory.map(h => ({
                date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                score: h.estimated_score,
                low: h.score_low,
                high: h.score_high,
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[400, 1600]} tick={{ fontSize: 12 }} tickCount={5} />
                <Tooltip
                  formatter={(val, name) => name === 'score' ? [`${val}`, 'Estimated Score'] : null}
                  labelStyle={{ fontWeight: 600 }}
                />
                <ReferenceLine y={1600} stroke="#e5e7eb" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={{ fill: '#4f46e5', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center text-center">
              <TrendingUp className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Complete 2+ tests (diagnostic or practice) to see your score trend
              </p>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Mastery Summary */}
      {skills && (skills.skills_mastered > 0 || skills.skills_proficient > 0 ||
                  skills.skills_familiar > 0 || skills.total_skills_practiced > 0) && (
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Mastery Overview
            </Card.Title>
            <Card.Description>
              Your progress across all skill levels
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <MasterySummary
              mastered={skills.skills_mastered || 0}
              proficient={skills.skills_proficient || 0}
              familiar={skills.skills_familiar || 0}
              notStarted={skills.skills_not_started || 0}
            />
          </Card.Content>
        </Card>
      )}

      {/* Skills Needing Review */}
      {skills?.needs_review_count > 0 && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10">
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-orange-500" />
              Skills Needing Review
              <Badge variant="warning">{skills.needs_review_count}</Badge>
            </Card.Title>
            <Card.Description>
              Practice these skills to maintain your mastery
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="space-y-2">
              {skills.skills
                .filter(s => s.needs_review)
                .slice(0, 5)
                .map((skill) => (
                  <SkillMasteryRow
                    key={skill.skill_id}
                    skillName={skill.skill_name}
                    level={skill.mastery_level}
                    theta={skill.theta}
                    abilitySe={skill.ability_se}
                    responsesCount={skill.responses_count}
                    daysAgo={skill.days_since_practice}
                    isStale={skill.is_stale}
                  />
                ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Skills to Improve */}
      {skills?.weak_skills?.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <Target className="h-5 w-5 text-red-500" />
              Areas to Focus On
            </Card.Title>
            <Card.Description>Skills that need more practice</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="space-y-2">
              {skills.weak_skills.slice(0, 5).map((skill) => (
                <SkillMasteryRow
                  key={skill.skill_id}
                  skillName={skill.skill_name}
                  level={skill.mastery_level}
                  theta={skill.theta}
                  abilitySe={skill.ability_se}
                  responsesCount={skill.responses_count}
                  daysAgo={skill.days_since_practice}
                  isStale={skill.is_stale}
                />
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Strong Skills */}
      {skills?.strong_skills?.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2">
              <Award className="h-5 w-5 text-green-500" />
              Your Strengths
            </Card.Title>
            <Card.Description>Skills you're performing well on</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="space-y-2">
              {skills.strong_skills.slice(0, 5).map((skill) => (
                <SkillMasteryRow
                  key={skill.skill_id}
                  skillName={skill.skill_name}
                  level={skill.mastery_level}
                  theta={skill.theta}
                  abilitySe={skill.ability_se}
                  responsesCount={skill.responses_count}
                  daysAgo={skill.days_since_practice}
                  isStale={skill.is_stale}
                />
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* All Skills by Domain */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            All Skills
          </Card.Title>
          <Card.Description>Your progress across all skill areas</Card.Description>
        </Card.Header>
        <Card.Content>
          {Object.keys(groupedSkills).length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Start practicing to see your skill progress here.
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(groupedSkills).map(([domain, domainSkills]) => {
                const avgLevel = getDomainAvgLevel(domainSkills);
                const masteredCount = domainSkills.filter(s => s.mastery_level === 3).length;
                const proficientCount = domainSkills.filter(s => s.mastery_level === 2).length;
                const isExpanded = expandedDomains.has(domain);

                return (
                  <div key={domain} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                    <button
                      onClick={() => toggleDomain(domain)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{domain}</span>
                        <Badge variant={getLevelBadgeVariant(avgLevel)}>
                          {masteredCount > 0 && `${masteredCount} mastered`}
                          {masteredCount > 0 && proficientCount > 0 && ' / '}
                          {proficientCount > 0 && `${proficientCount} proficient`}
                          {masteredCount === 0 && proficientCount === 0 && 'In Progress'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {domainSkills.length} skills
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2">
                        {domainSkills.map((skill) => (
                          <div
                            key={skill.skill_id}
                            className="flex items-center justify-between py-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {skill.skill_name}
                              </span>
                              {skill.is_stale && (
                                <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                              )}
                              {skill.lesson_id && (
                                <button
                                  onClick={() => navigate(`/student/lessons/${skill.lesson_id}`)}
                                  title={skill.lesson_completed ? 'Lesson completed' : 'Study lesson'}
                                  className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full transition-colors ${
                                    skill.lesson_completed
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900/50'
                                  }`}
                                >
                                  {skill.lesson_completed
                                    ? <CheckCircle className="h-3 w-3" />
                                    : <BookOpen className="h-3 w-3" />
                                  }
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {skill.accuracy_percent?.toFixed(0) || 0}% accuracy
                              </span>
                              <MasteryBadge
                                level={skill.mastery_level}
                                size="sm"
                                isStale={skill.is_stale}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};

export default ProgressPage;
