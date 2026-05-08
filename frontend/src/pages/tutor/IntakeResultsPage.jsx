/**
 * Tutor-facing intake assessment results page.
 * Replaces the modal flow on InvitesPage. Subcomponents are kept inline
 * because they are not reused elsewhere.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, BookOpen, Zap, ChevronDown, ChevronRight, ClipboardCopy, User } from 'lucide-react';
import {
  Card,
  Button,
  LoadingSpinner,
} from '../../components/ui';
import { inviteService } from '../../services';

const formatDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '';
  const m = Math.round(seconds / 60);
  return `${m} min`;
};

const SECTION_LABELS = { math: 'Math', reading_writing: 'Reading & Writing' };
const getSectionLabel = (sectionKey) => SECTION_LABELS[sectionKey] ?? 'Section';

const pickWeakestSkills = (skillBreakdown, count = 3) =>
  [...(skillBreakdown || [])]
    .filter((s) => s.total >= 1)
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
    .slice(0, count);

const ALL_STRONG_THRESHOLD = 80;

const buildSummary = (data) => {
  const section = data.section_abilities?.[0];
  const sectionLabel = section ? getSectionLabel(section.section) : 'Section';
  const date = data.completed_at
    ? new Date(data.completed_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : '';
  const overall = data.overall || { correct: 0, total: 0 };
  const breakdown = (data.skill_breakdown || []).filter((s) => s.total >= 1);
  const allStrong =
    breakdown.length > 0 &&
    breakdown.every((s) => s.total >= 2 && s.accuracy >= ALL_STRONG_THRESHOLD);
  const weakest = pickWeakestSkills(data.skill_breakdown);

  const headerLines = [
    `${data.student_name || 'Student'} — ${sectionLabel} Intake (${date})`,
    section
      ? `Predicted: ${section.predicted_score_mid} (range ${section.predicted_score_low}–${section.predicted_score_high}) · ${overall.correct}/${overall.total} correct`
      : `${overall.correct}/${overall.total} correct`,
    '',
  ];

  if (allStrong || weakest.length === 0) {
    headerLines.push(
      allStrong
        ? 'No weak areas — consider advancing to harder material.'
        : 'No skill data available.'
    );
    return headerLines.join('\n');
  }

  return [
    ...headerLines,
    'Teach next:',
    ...weakest.map((s) => `- ${s.skill_name}: ${s.correct}/${s.total} (${s.accuracy}%)`),
  ].join('\n');
};
const ACCURACY_STRONG_THRESHOLD = 70;
const ACCURACY_MEDIUM_THRESHOLD = 50;

const accuracyToneClass = (accuracy) =>
  accuracy >= ACCURACY_STRONG_THRESHOLD
    ? 'text-emerald-600 dark:text-emerald-400'
    : accuracy >= ACCURACY_MEDIUM_THRESHOLD
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

const groupSkillsByDomain = (skillBreakdown) => {
  const groups = new Map();
  for (const skill of skillBreakdown || []) {
    const key = skill.domain_id;
    if (!groups.has(key)) {
      groups.set(key, {
        domain_id: skill.domain_id,
        domain_code: skill.domain_code,
        domain_name: skill.domain_name,
        skills: [],
        correct: 0,
        total: 0,
      });
    }
    const g = groups.get(key);
    g.skills.push(skill);
    g.correct += skill.correct;
    g.total += skill.total;
  }
  for (const g of groups.values()) {
    g.skills.sort((a, b) => a.accuracy - b.accuracy);
    g.accuracy = g.total > 0 ? Math.round((g.correct / g.total) * 1000) / 10 : 0;
  }
  return [...groups.values()].sort((a, b) => a.accuracy - b.accuracy);
};

const Header = ({ data, onPrint }) => (
  <div className="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h1 className="text-2xl font-semibold text-ink-body">
        {data.student_name || 'Guest Student'}
        <span className="text-ink-subtle font-normal"> — Intake</span>
      </h1>
      <p className="text-sm text-ink-subtle mt-1">
        {data.student_email && <span>{data.student_email} · </span>}
        Completed {formatDateTime(data.completed_at)}
        {data.time_spent_seconds ? ` · ${formatDuration(data.time_spent_seconds)}` : ''}
      </p>
    </div>
    <Button variant="secondary" size="sm" onClick={onPrint} className="no-print">
      <Printer className="h-4 w-4 mr-2" />
      Print
    </Button>
  </div>
);

const ScoreCard = ({ data }) => {
  const section = data.section_abilities?.[0];
  const overall = data.overall || { correct: 0, total: 0, accuracy: 0 };

  if (!section) {
    return (
      <Card>
        <p className="text-sm text-ink-subtle">No score available.</p>
      </Card>
    );
  }

  const sectionLabel = getSectionLabel(section.section);

  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-ink-subtle mb-2">
        Predicted {sectionLabel} Score
      </p>
      <div className="flex items-baseline gap-3">
        <span className="text-5xl font-bold text-brand-600 dark:text-brand-400">
          {section.predicted_score_mid}
        </span>
        <span className="text-sm text-ink-subtle">
          range {section.predicted_score_low}–{section.predicted_score_high}
        </span>
      </div>
      <p className="text-sm text-ink-muted mt-3">
        {overall.correct}/{overall.total} correct ({overall.accuracy}%)
      </p>
      {data.student_id && data.test_session_id && (
        <Link
          to={`/tutor/students/${data.student_id}/results/${data.test_session_id}`}
          className="inline-flex items-center text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 hover:underline mt-4 no-print"
        >
          Review every question →
        </Link>
      )}
    </Card>
  );
};

const SkillCtaButtons = ({ skill, studentId }) => (
  <div className="flex gap-2 flex-wrap">
    {skill.lesson_id && (
      <Link to={`/tutor/lessons/${skill.lesson_id}`} className="no-print">
        <Button variant="secondary" size="sm">
          <BookOpen className="h-4 w-4 mr-2" />
          Lesson
        </Button>
      </Link>
    )}
    {studentId && (
      <Link
        to={`/tutor/assignments/new?student=${studentId}&skills=${skill.skill_id}`}
        className="no-print"
      >
        <Button variant="primary" size="sm">
          <Zap className="h-4 w-4 mr-2" />
          Assign Practice
        </Button>
      </Link>
    )}
  </div>
);

const TeachThisNext = ({ data }) => {
  const breakdown = (data.skill_breakdown || []).filter((s) => s.total >= 1);
  const allStrong =
    breakdown.length > 0 &&
    breakdown.every((s) => s.total >= 2 && s.accuracy >= ALL_STRONG_THRESHOLD);

  if (allStrong) {
    return (
      <Card>
        <p className="text-xs uppercase tracking-wider text-ink-subtle mb-2">
          Teach this next
        </p>
        <p className="text-ink-body">
          No weak areas — consider advancing to harder material.
        </p>
      </Card>
    );
  }

  const weakest = pickWeakestSkills(data.skill_breakdown);

  if (weakest.length === 0) {
    return (
      <Card>
        <p className="text-xs uppercase tracking-wider text-ink-subtle mb-2">
          Teach this next
        </p>
        <p className="text-ink-subtle">No skill data available.</p>
      </Card>
    );
  }

  const heading = weakest.length === 3 ? 'Top 3 weakest skills' : 'Teach this next';

  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-ink-subtle mb-3">
        {heading}
      </p>
      <ol className="space-y-4">
        {weakest.map((skill, idx) => (
          <li key={skill.skill_id} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="font-medium text-ink-body">
                {idx + 1}. {skill.skill_name}
              </span>
              <span className={`text-sm font-semibold ${accuracyToneClass(skill.accuracy)}`}>
                {skill.correct}/{skill.total} ({skill.accuracy}%)
              </span>
            </div>
            <SkillCtaButtons skill={skill} studentId={data.student_id} />
          </li>
        ))}
      </ol>
    </Card>
  );
};

const SkillRow = ({ skill, studentId }) => (
  <div className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg hover:bg-surface-muted">
    <div className="min-w-0">
      <p className="text-sm font-medium text-ink-body truncate">{skill.skill_name}</p>
      <p className={`text-xs ${accuracyToneClass(skill.accuracy)}`}>
        {skill.correct}/{skill.total} ({skill.accuracy}%)
      </p>
    </div>
    <SkillCtaButtons skill={skill} studentId={studentId} />
  </div>
);

const DomainBreakdown = ({ data }) => {
  const grouped = useMemo(() => groupSkillsByDomain(data.skill_breakdown), [data.skill_breakdown]);
  const [openDomains, setOpenDomains] = useState(
    () => new Set(grouped.filter((g) => g.accuracy < ACCURACY_MEDIUM_THRESHOLD).map((g) => g.domain_id))
  );

  const toggle = (domainId) => {
    setOpenDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domainId)) next.delete(domainId);
      else next.add(domainId);
      return next;
    });
  };

  if (grouped.length === 0) {
    return null;
  }

  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-ink-subtle mb-3">
        Per-domain performance
      </p>
      <div className="divide-y divide-edge-subtle">
        {grouped.map((g) => {
          const isOpen = openDomains.has(g.domain_id);
          const Icon = isOpen ? ChevronDown : ChevronRight;
          return (
            <div key={g.domain_id} className="py-2">
              <button
                type="button"
                onClick={() => toggle(g.domain_id)}
                className="w-full flex items-center justify-between gap-3 px-1 py-2 rounded hover:bg-surface-muted"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 text-ink-subtle flex-shrink-0" />
                  <span className="font-medium text-ink-body truncate">{g.domain_name}</span>
                </span>
                <span className={`text-sm font-semibold ${accuracyToneClass(g.accuracy)}`}>
                  {g.correct}/{g.total} ({g.accuracy}%)
                </span>
              </button>
              {isOpen && (
                <div className="pl-6 pt-1 pb-2 space-y-1">
                  {g.skills.map((skill) => (
                    <SkillRow key={skill.skill_id} skill={skill} studentId={data.student_id} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const FooterActions = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);
  const weakest = pickWeakestSkills(data.skill_breakdown);
  const top3SkillIds = weakest.map((s) => s.skill_id).join(',');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildSummary(data));
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <Card className="no-print">
      <div className="flex flex-wrap gap-3">
        {data.student_id && weakest.length > 0 && (
          <Link to={`/tutor/assignments/new?student=${data.student_id}&skills=${top3SkillIds}`}>
            <Button variant="primary">
              <Zap className="h-4 w-4 mr-2" />
              Create assignment for top {weakest.length} weak skill{weakest.length === 1 ? '' : 's'}
            </Button>
          </Link>
        )}
        <Button variant="secondary" onClick={handleCopy}>
          <ClipboardCopy className="h-4 w-4 mr-2" />
          {copied ? 'Copied!' : 'Copy summary'}
        </Button>
        {data.student_id && (
          <Link to={`/tutor/students/${data.student_id}`}>
            <Button variant="secondary">
              <User className="h-4 w-4 mr-2" />
              View full profile
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
};

const IntakeResultsPage = () => {
  const { inviteId } = useParams();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchResults = async () => {
      // TODO: switch to backend-provided error codes once available; current 400-detail
      // string matches are fragile to upstream rewording.
      try {
        setIsLoading(true);
        setError(null);
        const response = await inviteService.getResults(inviteId);
        if (!cancelled) setData(response.data);
      } catch (err) {
        if (cancelled) return;
        const status = err.response?.status;
        const detail = err.response?.data?.detail;
        if (status === 404) {
          setError({ kind: 'not_found', message: "This intake assessment doesn't exist or you don't have access." });
        } else if (status === 400 && detail === 'Assessment not started') {
          setError({ kind: 'not_started', message: "The student hasn't started this intake yet." });
        } else if (status === 400 && detail === 'Assessment not completed') {
          setError({ kind: 'in_progress', message: "The student is still working on this intake — results will appear when it's submitted." });
        } else {
          setError({ kind: 'unknown', message: "Couldn't load results." });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchResults();
    return () => { cancelled = true; };
  }, [inviteId, retryNonce]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/tutor/invites">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Intake Assessments
          </Button>
        </Link>
        <Card>
          <div className="text-center py-8 space-y-4">
            <p className="text-ink-body">{error.message}</p>
            {error.kind === 'unknown' && (
              <Button variant="primary" onClick={() => setRetryNonce((n) => n + 1)}>
                Retry
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/tutor/invites" className="no-print">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Intake Assessments
        </Button>
      </Link>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      {!data.student_id && (
        <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This student hasn't accepted the invite as a registered user yet — assignments and full-profile actions are unavailable until they sign up.
          </p>
        </Card>
      )}
      <Header data={data} onPrint={() => window.print()} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScoreCard data={data} />
        <TeachThisNext data={data} />
      </div>
      <DomainBreakdown data={data} />
      <FooterActions data={data} />
    </div>
  );
};

export default IntakeResultsPage;
