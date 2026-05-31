/**
 * Tutor Student Detail — Study Hall.
 * Big-number stat row, borderless mastery sections, act-on-able focus areas
 * (no side-stripes, no dynamic Tailwind class bug), warm theme-aware charts.
 * Tokens, dark mode, a11y.
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, BookOpen, Brain, CheckCircle, BarChart3, Zap,
} from 'lucide-react';
import {
  Button, Skeleton, ThetaBar,
  PageHeader, Section, StatBlock, StatusPill,
} from '../../components/ui';
import { MasterySummary } from '../../components/ui/MasteryBadge';
import { AccuracyTrend, SkillBreakdown, DomainRadar } from '../../components/charts';
import { tutorService } from '../../services';

const TABS = [
  { value: 'skills', label: 'Skills', icon: Brain },
  { value: 'focus', label: 'Focus areas', icon: AlertTriangle },
  { value: 'trends', label: 'Trends', icon: BarChart3 },
];

const SkillRow = ({ skill }) => {
  const masteryLevel = typeof skill.mastery_level === 'number' && skill.mastery_level <= 3 ? skill.mastery_level : 0;
  return (
    <li className="flex items-center gap-4 py-4 first:pt-0">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-semibold text-ink-body">{skill.skill_name}</p>
          <span className="shrink-0 text-xs text-ink-faint">
            {skill.responses_count || skill.questions_attempted || 0}q
            {skill.days_since_practice > 0 && ` · ${skill.days_since_practice}d ago`}
          </span>
        </div>
        <ThetaBar
          theta={skill.theta ?? skill.ability_theta ?? null}
          masteryLevel={masteryLevel}
          se={skill.ability_se ?? null}
          isStale={skill.is_stale}
          size="full"
          showSE
        />
      </div>
    </li>
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
  const [tab, setTab] = useState('skills');

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      try {
        const studentRes = await tutorService.getStudent(id);
        setStudent(studentRes.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load student data');
        setIsLoading(false);
        return;
      }
      const safe = async (fn, set) => { try { const r = await fn(); set(r.data); } catch (e) { /* partial */ } };
      await Promise.all([
        safe(() => tutorService.getStudentProgress(id), setProgress),
        safe(() => tutorService.getStudentWeaknesses(id), setWeaknesses),
        safe(() => tutorService.getStudentChartData(id, { days: 30 }), setChartData),
      ]);
      setIsLoading(false);
    };
    fetchData();
  }, [id]);

  if (error || (!isLoading && !student)) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/30">
          <AlertTriangle className="h-8 w-8 text-brand-600 dark:text-brand-400" />
        </div>
        <h2 className="mb-2 font-display text-xl font-semibold text-ink-body">Unable to load student</h2>
        <p className="mb-6 text-ink-subtle">{error || 'The student may not be in your roster.'}</p>
        <Link to="/tutor/students"><Button variant="secondary"><ArrowLeft className="h-4 w-4" /> Back to students</Button></Link>
      </div>
    );
  }

  const accuracyData = chartData?.accuracy_trend || [];
  const skillData = (chartData?.skill_breakdown || []).map((s) => ({ name: s.name, accuracy: s.accuracy, questions: s.questions }));
  const domainData = (chartData?.domain_performance || []).map((d) => ({ domain: d.domain, accuracy: d.accuracy, fullMark: 100 }));

  const totalQuestions = progress?.total_questions_answered || 0;
  const overallAccuracy = progress?.overall_accuracy || 0;
  const weakAreasCount = weaknesses?.weak_skills?.length || 0;
  const masteredCount = progress?.skills?.filter((s) => s.mastery_level === 3 || (s.mastery_level === undefined && s.accuracy >= 90 && s.questions_attempted >= 3)).length || 0;
  const name = student ? `${student.first_name} ${student.last_name}` : '';

  return (
    <div className="mx-auto max-w-5xl pb-8">
      {/* Back link */}
      <Link to="/tutor/students" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-subtle transition-colors hover:text-ink-body">
        <ArrowLeft className="h-4 w-4" /> Students
      </Link>

      <PageHeader
        title={isLoading ? 'Loading…' : name}
        subtitle={student?.email}
        actions={
          <Link to={`/tutor/assignments/new?student=${id}`}>
            <Button variant="primary"><Zap className="h-4 w-4" /> Create assignment</Button>
          </Link>
        }
      />

      {/* Big-number stat row */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-edge py-6 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="space-y-2"><Skeleton className="h-9 w-16" /><Skeleton className="h-3 w-20" /></div>)}
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-x-10 gap-y-6 border-y border-edge py-6">
          <StatBlock value={overallAccuracy} suffix="%" decimals={0} label="Overall accuracy" size="lg" />
          <StatBlock value={totalQuestions} label="Questions answered" />
          <StatBlock value={masteredCount} label="Skills mastered" />
          <StatBlock value={weakAreasCount} label="Focus areas" />
          <StatBlock value={progress?.sessions_completed || 0} label="Sessions" />
        </div>
      )}

      {/* Mastery overview */}
      {progress?.skills?.length > 0 && (
        <Section className="mt-10" title="Mastery overview" icon={BookOpen} hint="Skill progression across all levels">
          <MasterySummary
            mastered={progress.skills.filter((s) => s.mastery_level === 3).length}
            proficient={progress.skills.filter((s) => s.mastery_level === 2).length}
            familiar={progress.skills.filter((s) => s.mastery_level === 1).length}
            notStarted={progress.skills.filter((s) => s.mastery_level === 0 || s.mastery_level === undefined).length}
          />
        </Section>
      )}

      {/* Tabbed detail */}
      <div className="mt-12">
        <div role="tablist" aria-label="Student detail" className="mb-5 flex flex-wrap gap-1.5 border-b border-edge pb-3">
          {TABS.map((tb) => {
            const active = tab === tb.value;
            return (
              <button
                key={tb.value} role="tab" aria-selected={active} onClick={() => setTab(tb.value)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted hover:text-ink-body hover:bg-edge-subtle'}`}
              >
                <tb.icon className="h-3.5 w-3.5" /> {tb.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" rounded="rounded-xl" />
        ) : tab === 'skills' ? (
          progress?.skills?.length > 0 ? (
            <ul className="grid grid-cols-1 gap-x-10 divide-y divide-edge-subtle md:grid-cols-2 md:divide-y-0 md:[&>li]:border-b md:[&>li]:border-edge-subtle">
              {[...progress.skills].sort((a, b) => (b.questions_attempted || 0) - (a.questions_attempted || 0)).map((skill) => (
                <SkillRow key={skill.skill_id} skill={skill} />
              ))}
            </ul>
          ) : <EmptyHint icon={Brain} text={`Skills appear once ${student.first_name} answers some practice questions.`} />
        ) : tab === 'focus' ? (
          <div className="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-2">
            <Section title="Skills needing practice" hint="Below 70% with 3+ attempts">
              {weaknesses?.weak_skills?.length > 0 ? (
                <ul className="divide-y divide-edge-subtle">
                  {weaknesses.weak_skills.map((skill) => (
                    <li key={skill.skill_id} className="flex items-center justify-between gap-3 py-3.5 first:pt-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-body">{skill.skill_name}</p>
                        <p className="text-xs text-ink-subtle">{skill.questions_attempted} attempted · {skill.priority} priority</p>
                      </div>
                      <StatusPill value={skill.accuracy} size="sm" />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-8 text-center">
                  <CheckCircle className="mx-auto mb-3 h-10 w-10 text-accent-500" />
                  <p className="text-sm text-ink-muted">No significant weak areas. {student.first_name} is on track.</p>
                </div>
              )}
            </Section>

            <Section title="Recommended next step">
              {weaknesses?.weak_skills?.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-ink-muted">
                    Assign targeted practice on {student.first_name}'s {weaknesses.weak_skills.filter((s) => s.priority === 'high').length || 1} highest-priority skill(s).
                  </p>
                  <Link to={`/tutor/assignments/new?student=${id}&skills=${weaknesses.weak_skills.slice(0, 3).map((s) => s.skill_id).join(',')}`}>
                    <Button variant="primary" size="sm"><Zap className="h-4 w-4" /> Create practice assignment</Button>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-ink-muted">{student.first_name} is doing well. Consider introducing more advanced topics to keep growth going.</p>
              )}
            </Section>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-2">
            <Section title="Accuracy over time" hint="Past 30 days">
              {accuracyData.length > 0 ? <AccuracyTrend data={accuracyData} height={250} /> : <EmptyHint icon={BarChart3} text="Not enough data points yet." />}
            </Section>
            <Section title="Domain coverage">
              {domainData.length > 0 ? <DomainRadar data={domainData} height={250} /> : <EmptyHint icon={BarChart3} text="No domain data yet." />}
            </Section>
            <Section title="Top practiced skills" className="lg:col-span-2">
              {skillData.length > 0 ? <SkillBreakdown data={skillData.slice(0, 8)} height={300} /> : <EmptyHint icon={BarChart3} text="No skill data yet." />}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyHint = ({ icon: Icon, text }) => (
  <div className="py-12 text-center">
    <Icon className="mx-auto mb-3 h-10 w-10 text-ink-faint" />
    <p className="text-sm text-ink-subtle">{text}</p>
  </div>
);

export default StudentDetailPage;
