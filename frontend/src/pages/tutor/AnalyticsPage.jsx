/**
 * Tutor Analytics — Study Hall.
 * Leads with "who needs what next" (act-on-able struggles), not a chart wall.
 * Big-number stats, borderless sections, theme-aware warm charts as supporting
 * detail. Tokens, dark mode, a11y.
 */
import { useState } from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, TrendingUp, Radar, Activity } from 'lucide-react';
import {
  Skeleton, PageHeader, Section, StatBlock, StatusPill,
} from '../../components/ui';
import {
  AccuracyTrend, SkillBreakdown, DomainRadar, ActivityHeatmap, ScoreDistribution,
} from '../../components/charts';
import { tutorService } from '../../services';

const TABS = [
  { value: 'overview', label: 'Overview', icon: TrendingUp },
  { value: 'skills', label: 'Skills', icon: BarChart3 },
  { value: 'domains', label: 'Domains', icon: Radar },
  { value: 'activity', label: 'Activity', icon: Activity },
];

const AnalyticsPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState('overview');

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

  const accuracyData = chartData?.accuracy_trend || [];
  const skillData = (chartData?.skill_breakdown || []).map((s) => ({ name: s.name, accuracy: s.accuracy, questions: s.questions }));
  const domainData = (chartData?.domain_performance || []).map((d) => ({ domain: d.domain, accuracy: d.accuracy, fullMark: 100 }));
  const activityData = chartData?.activity_heatmap || [];
  const struggles = analytics?.common_struggles || [];

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <PageHeader
        eyebrow="Your studio"
        title="Class analytics"
        subtitle="Start with who needs help and what to assign. The trends are below when you want the bigger picture."
      />

      {/* Big-number stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-edge py-6 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="space-y-2"><Skeleton className="h-9 w-16" /><Skeleton className="h-3 w-20" /></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-edge py-6 lg:grid-cols-4">
          <StatBlock value={analytics?.total_students || 0} label="Total students" />
          <StatBlock value={analytics?.active_students_this_week || 0} label="Active this week" />
          <StatBlock value={analytics?.assignments_completed || 0} label="Assignments completed" hint={`of ${analytics?.total_assignments_created || 0} created`} />
          <StatBlock value={analytics?.average_score ?? 0} suffix="%" label="Average score" />
        </div>
      )}

      {/* Act-on-able: where students struggle */}
      <Section className="mt-10" title="Where the class struggles" hint="Assign targeted practice in one click">
        {isLoading ? (
          <ul className="space-y-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</ul>
        ) : struggles.length > 0 ? (
          <ul className="divide-y divide-edge-subtle">
            {struggles.slice(0, 6).map((skill) => (
              <li key={skill.skill_id} className="flex items-center justify-between gap-3 py-3.5 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-body">{skill.skill_name}</p>
                  <p className="text-xs text-ink-subtle">{skill.students_struggling} student{skill.students_struggling === 1 ? '' : 's'} below 70%</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusPill value={skill.avg_accuracy} size="sm" />
                  <Link
                    to={`/tutor/assignments/create?skill=${skill.skill_id}`}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    Assign <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-subtle">No clear struggle areas yet. As students practice, weak skills will surface here with one-click assigning.</p>
        )}
      </Section>

      {/* Trends — supporting detail behind a quiet tab strip */}
      <div className="mt-12">
        <div role="tablist" aria-label="Analytics charts" className="mb-5 flex flex-wrap gap-1.5 border-b border-edge pb-3">
          {TABS.map((tb) => {
            const active = tab === tb.value;
            return (
              <button
                key={tb.value}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(tb.value)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  active ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted hover:text-ink-body hover:bg-edge-subtle'
                }`}
              >
                <tb.icon className="h-3.5 w-3.5" /> {tb.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <Skeleton className="h-72 w-full" rounded="rounded-xl" />
        ) : tab === 'overview' ? (
          <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-2">
            <Section title="Class accuracy trend">
              {accuracyData.length > 0 ? <AccuracyTrend data={accuracyData} height={260} /> : <ChartEmpty />}
            </Section>
            <Section title="Score distribution">
              <ScoreDistribution height={260} />
            </Section>
          </div>
        ) : tab === 'skills' ? (
          <Section title="Skill performance" hint="Weakest first, by practice volume">
            {skillData.length > 0 ? <SkillBreakdown data={skillData} height={420} /> : <ChartEmpty />}
          </Section>
        ) : tab === 'domains' ? (
          <Section title="Domain coverage">
            {domainData.length > 0 ? <DomainRadar data={domainData} height={320} /> : <ChartEmpty />}
          </Section>
        ) : (
          <Section title="Practice activity" hint="Questions answered per day">
            {activityData.length > 0 ? <ActivityHeatmap data={activityData} weeks={12} /> : <ChartEmpty />}
          </Section>
        )}
      </div>
    </div>
  );
};

const ChartEmpty = () => (
  <p className="py-16 text-center text-sm text-ink-subtle">Not enough data yet for this view.</p>
);

export default AnalyticsPage;
