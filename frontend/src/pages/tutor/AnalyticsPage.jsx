/**
 * Tutor Analytics Page
 * Class-wide analytics with charts using real API data
 */
import { useState, useEffect } from 'react';
import { Card, LoadingSpinner, Tabs } from '../../components/ui';
import {
  AccuracyTrend,
  SkillBreakdown,
  DomainRadar,
  ActivityHeatmap,
  ScoreDistribution,
} from '../../components/charts';
import { tutorService } from '../../services';

const StatCard = ({ label, value, subtext }) => (
  <Card>
    <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
    {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>}
  </Card>
);

const AnalyticsPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analyticsRes, chartsRes] = await Promise.all([
          tutorService.getAnalytics(),
          tutorService.getChartData({ days: 30 }),
        ]);
        setAnalytics(analyticsRes.data);
        setChartData(chartsRes.data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
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

  // Transform chart data for components
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
  const activityData = chartData?.activity_heatmap || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Class-wide performance insights</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Students"
          value={analytics?.total_students || 0}
        />
        <StatCard
          label="Active This Week"
          value={analytics?.active_students_this_week || 0}
        />
        <StatCard
          label="Assignments"
          value={`${analytics?.assignments_completed || 0}/${analytics?.total_assignments_created || 0}`}
          subtext="completed"
        />
        <StatCard
          label="Average Score"
          value={`${analytics?.average_score?.toFixed(1) || 0}%`}
        />
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="skills">Skills</Tabs.Trigger>
          <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Accuracy Trend */}
            <Card>
              <Card.Header>
                <Card.Title>Class Performance Trend</Card.Title>
                <Card.Description>Average accuracy over time</Card.Description>
              </Card.Header>
              <Card.Content>
                {accuracyData.length > 0 ? (
                  <AccuracyTrend data={accuracyData} height={250} />
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-16">No data yet</p>
                )}
              </Card.Content>
            </Card>

            {/* Domain Performance */}
            <Card>
              <Card.Header>
                <Card.Title>Domain Coverage</Card.Title>
                <Card.Description>Performance across subject areas</Card.Description>
              </Card.Header>
              <Card.Content>
                {domainData.length > 0 ? (
                  <DomainRadar data={domainData} height={250} />
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-16">No data yet</p>
                )}
              </Card.Content>
            </Card>

            {/* Score Distribution */}
            <Card>
              <Card.Header>
                <Card.Title>Score Distribution</Card.Title>
                <Card.Description>How students are performing</Card.Description>
              </Card.Header>
              <Card.Content>
                <ScoreDistribution height={200} />
              </Card.Content>
            </Card>

            {/* Common Struggles */}
            <Card>
              <Card.Header>
                <Card.Title>Common Struggles</Card.Title>
                <Card.Description>Skills where students need help</Card.Description>
              </Card.Header>
              <Card.Content>
                {analytics?.common_struggles?.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.common_struggles.slice(0, 5).map((skill, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{skill.skill_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {skill.students_struggling} student{skill.students_struggling !== 1 ? 's' : ''} below 70%
                          </p>
                        </div>
                        <span className={`text-sm font-medium ${
                          skill.avg_accuracy < 50 ? 'text-rose-600 dark:text-rose-400' :
                          skill.avg_accuracy < 70 ? 'text-amber-600 dark:text-amber-400' :
                          'text-gray-600 dark:text-gray-300'
                        }`}>
                          {skill.avg_accuracy?.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data yet</p>
                )}
              </Card.Content>
            </Card>
          </div>
        </Tabs.Content>

        <Tabs.Content value="skills">
          <Card>
            <Card.Header>
              <Card.Title>Skill Performance</Card.Title>
              <Card.Description>Class accuracy by skill (top 10 by practice volume)</Card.Description>
            </Card.Header>
            <Card.Content>
              {skillData.length > 0 ? (
                <SkillBreakdown data={skillData} height={400} />
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-16">No data yet</p>
              )}
            </Card.Content>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="activity">
          <Card>
            <Card.Header>
              <Card.Title>Practice Activity</Card.Title>
              <Card.Description>Questions answered per day across all students</Card.Description>
            </Card.Header>
            <Card.Content>
              {activityData.length > 0 ? (
                <ActivityHeatmap data={activityData} weeks={12} />
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-16">No activity data yet</p>
              )}
            </Card.Content>
          </Card>
        </Tabs.Content>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;
