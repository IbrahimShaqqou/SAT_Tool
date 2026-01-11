/**
 * My Progress Page
 * Comprehensive view of student's learning progress
 */
import { useState, useEffect } from 'react';
import { TrendingUp, Target, Award, Clock, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, Badge, LoadingSpinner } from '../../components/ui';
import { progressService } from '../../services';

const ProgressPage = () => {
  const [progress, setProgress] = useState(null);
  const [skills, setSkills] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDomains, setExpandedDomains] = useState(new Set());

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const [summaryRes, skillsRes] = await Promise.all([
          progressService.getSummary(),
          progressService.getSkills().catch(() => ({ data: { skills: [], weak_skills: [], strong_skills: [] } })),
        ]);
        setProgress(summaryRes.data);
        setSkills(skillsRes.data);
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

  const getMasteryColor = (mastery) => {
    if (mastery >= 80) return 'bg-green-500';
    if (mastery >= 60) return 'bg-blue-500';
    if (mastery >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getMasteryLabel = (mastery) => {
    if (mastery >= 80) return 'Mastered';
    if (mastery >= 60) return 'Proficient';
    if (mastery >= 40) return 'Developing';
    return 'Needs Practice';
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
        <h1 className="text-2xl font-semibold text-gray-900">My Progress</h1>
        <p className="text-gray-500 mt-1">Track your preparation journey</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{progress?.overall_accuracy?.toFixed(0) || 0}%</p>
              <p className="text-sm text-gray-500">Accuracy</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Target className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{progress?.total_questions_answered || 0}</p>
              <p className="text-sm text-gray-500">Questions</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Award className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{progress?.assignments_completed || 0}</p>
              <p className="text-sm text-gray-500">Assignments</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">
                {Math.round((progress?.total_time_spent || 0) / 60)}m
              </p>
              <p className="text-sm text-gray-500">Practice Time</p>
            </div>
          </div>
        </Card>
      </div>

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
            <div className="space-y-3">
              {skills.weak_skills.slice(0, 5).map((skill, index) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-700">{skill.skill_name || skill.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getMasteryColor(skill.mastery_level || 0)}`}
                        style={{ width: `${skill.mastery_level || 0}%` }}
                      />
                    </div>
                    <Badge variant="danger">
                      {(skill.mastery_level || 0).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
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
            <Card.Description>Skills you've mastered</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3">
              {skills.strong_skills.slice(0, 5).map((skill, index) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-700">{skill.skill_name || skill.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getMasteryColor(skill.mastery_level || 0)}`}
                        style={{ width: `${skill.mastery_level || 0}%` }}
                      />
                    </div>
                    <Badge variant="success">
                      {(skill.mastery_level || 0).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* All Skills by Domain */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-gray-500" />
            All Skills
          </Card.Title>
          <Card.Description>Your progress across all skill areas</Card.Description>
        </Card.Header>
        <Card.Content>
          {Object.keys(groupedSkills).length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Start practicing to see your skill progress here.
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(groupedSkills).map(([domain, domainSkills]) => {
                const avgMastery = domainSkills.reduce((sum, s) => sum + (s.mastery_level || 0), 0) / domainSkills.length;
                const isExpanded = expandedDomains.has(domain);

                return (
                  <div key={domain} className="border rounded-lg">
                    <button
                      onClick={() => toggleDomain(domain)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{domain}</span>
                        <Badge variant={avgMastery >= 60 ? 'success' : avgMastery >= 40 ? 'warning' : 'danger'}>
                          {avgMastery.toFixed(0)}% avg
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{domainSkills.length} skills</span>
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
                            key={skill.skill_id || skill.id}
                            className="flex items-center justify-between py-2 pl-4 border-l-2 border-gray-200"
                          >
                            <span className="text-sm text-gray-700">{skill.skill_name || skill.name}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${getMasteryColor(skill.mastery_level || 0)}`}
                                  style={{ width: `${skill.mastery_level || 0}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-16 text-right">
                                {getMasteryLabel(skill.mastery_level || 0)}
                              </span>
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
