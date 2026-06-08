/**
 * Tutor-facing intake assessment results page — Study Hall.
 * Replaces the modal flow on InvitesPage. Borderless sections, tokens, dark
 * mode, a11y. Subcomponents are kept inline because they are not reused elsewhere.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Printer, BookOpen, Zap, ChevronDown, ChevronRight, ClipboardCopy, User } from 'lucide-react';
import {
  Button, Section, PageHeader, StatBlock, StatusPill, Skeleton, Surface,
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
    `${data.student_name || 'Student'}: ${sectionLabel} Intake (${date})`,
    section
      ? `Predicted: ${section.predicted_score_mid} (range ${section.predicted_score_low}–${section.predicted_score_high}) · ${overall.correct}/${overall.total} correct`
      : `${overall.correct}/${overall.total} correct`,
    '',
  ];

  if (allStrong || weakest.length === 0) {
    headerLines.push(
      allStrong
        ? 'No weak areas, consider advancing to harder material.'
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

const SkillCtaButtons = ({ skill, studentId }) => (
  <div className="flex flex-wrap gap-2">
    {skill.lesson_id && (
      <Link to={`/tutor/lessons/${skill.lesson_id}`} className="no-print">
        <Button variant="secondary" size="sm">
          <BookOpen className="h-4 w-4" />
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
          <Zap className="h-4 w-4" />
          Assign Practice
        </Button>
      </Link>
    )}
  </div>
);

const ScoreCard = ({ data }) => {
  const section = data.section_abilities?.[0];
  const overall = data.overall || { correct: 0, total: 0, accuracy: 0 };

  if (!section) {
    return <p className="text-sm text-ink-subtle">No score available.</p>;
  }

  const sectionLabel = getSectionLabel(section.section);

  return (
    <Surface elevation="sm" glow="brand" padded>
      <p className="mb-2 text-xs uppercase tracking-wider text-ink-subtle">
        Predicted {sectionLabel} Score
      </p>
      <StatBlock value={section.predicted_score_mid} label={`range ${section.predicted_score_low}–${section.predicted_score_high}`} size="lg" />
      <p className="mt-3 text-sm text-ink-muted">
        {overall.correct}/{overall.total} correct ({overall.accuracy}%)
      </p>
      {data.student_id && data.test_session_id && (
        <Link
          to={`/tutor/students/${data.student_id}/results/${data.test_session_id}`}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400 no-print"
        >
          Review every question <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </Surface>
  );
};

const TeachThisNext = ({ data }) => {
  const breakdown = (data.skill_breakdown || []).filter((s) => s.total >= 1);
  const allStrong =
    breakdown.length > 0 &&
    breakdown.every((s) => s.total >= 2 && s.accuracy >= ALL_STRONG_THRESHOLD);

  if (allStrong) {
    return (
      <Section title="Teach this next">
        <p className="text-ink-body">
          No weak areas, consider advancing to harder material.
        </p>
      </Section>
    );
  }

  const weakest = pickWeakestSkills(data.skill_breakdown);

  if (weakest.length === 0) {
    return (
      <Section title="Teach this next">
        <p className="text-ink-subtle">No skill data available.</p>
      </Section>
    );
  }

  const heading = weakest.length === 3 ? 'Top 3 weakest skills' : 'Teach this next';

  return (
    <Section title={heading}>
      <ol className="space-y-4">
        {weakest.map((skill, idx) => (
          <li key={skill.skill_id} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="font-medium text-ink-body">
                {idx + 1}. {skill.skill_name}
              </span>
              <StatusPill value={skill.accuracy} size="sm">
                {skill.correct}/{skill.total} ({skill.accuracy}%)
              </StatusPill>
            </div>
            <SkillCtaButtons skill={skill} studentId={data.student_id} />
          </li>
        ))}
      </ol>
    </Section>
  );
};

const SkillRow = ({ skill, studentId }) => (
  <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 hover:bg-surface-muted">
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-ink-body">{skill.skill_name}</p>
      <StatusPill value={skill.accuracy} size="sm">
        {skill.correct}/{skill.total} ({skill.accuracy}%)
      </StatusPill>
    </div>
    <SkillCtaButtons skill={skill} studentId={studentId} />
  </div>
);

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

const ACCURACY_MEDIUM_THRESHOLD = 50;

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
    <Section title="Per-domain performance">
      <div className="divide-y divide-edge-subtle">
        {grouped.map((g) => {
          const isOpen = openDomains.has(g.domain_id);
          const Icon = isOpen ? ChevronDown : ChevronRight;
          return (
            <div key={g.domain_id} className="py-2">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(g.domain_id)}
                className="flex w-full items-center justify-between gap-3 rounded px-1 py-2 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 flex-shrink-0 text-ink-subtle" />
                  <span className="truncate font-medium text-ink-body">{g.domain_name}</span>
                </span>
                <StatusPill value={g.accuracy} size="sm">
                  {g.correct}/{g.total} ({g.accuracy}%)
                </StatusPill>
              </button>
              {isOpen && (
                <div className="space-y-1 pb-2 pl-6 pt-1">
                  {g.skills.map((skill) => (
                    <SkillRow key={skill.skill_id} skill={skill} studentId={data.student_id} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
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
    <div className="flex flex-wrap gap-3 border-t border-edge pt-6 no-print">
      {data.student_id && weakest.length > 0 && (
        <Link to={`/tutor/assignments/new?student=${data.student_id}&skills=${top3SkillIds}`}>
          <Button variant="primary">
            <Zap className="h-4 w-4" />
            Create assignment for top {weakest.length} weak skill{weakest.length === 1 ? '' : 's'}
          </Button>
        </Link>
      )}
      <Button variant="secondary" onClick={handleCopy}>
        <ClipboardCopy className="h-4 w-4" />
        {copied ? 'Copied!' : 'Copy summary'}
      </Button>
      {data.student_id && (
        <Link to={`/tutor/students/${data.student_id}`}>
          <Button variant="secondary">
            <User className="h-4 w-4" />
            View full profile
          </Button>
        </Link>
      )}
    </div>
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
          setError({ kind: 'in_progress', message: "The student is still working on this intake; results will appear when it's submitted." });
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

  const backLink = (
    <Link
      to="/tutor/invites"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 no-print"
    >
      <ArrowLeft className="h-4 w-4" /> Back to Intake Assessments
    </Link>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl pb-8">
        {backLink}
        <Skeleton className="mb-6 h-9 w-64" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-44 w-full" rounded="rounded-xl" />
          <Skeleton className="h-44 w-full" rounded="rounded-xl" />
        </div>
        <Skeleton className="mt-6 h-56 w-full" rounded="rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl pb-8">
        {backLink}
        <div role="alert" className="space-y-4 rounded-xl bg-surface-muted py-12 text-center">
          <p className="text-ink-body">{error.message}</p>
          {error.kind === 'unknown' && (
            <Button variant="primary" onClick={() => setRetryNonce((n) => n + 1)}>
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-8">
      {backLink}
      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      <PageHeader
        eyebrow="Intake"
        title={data.student_name || 'Guest Student'}
        subtitle={`${data.student_email ? `${data.student_email} · ` : ''}Completed ${formatDateTime(data.completed_at)}${data.time_spent_seconds ? ` · ${formatDuration(data.time_spent_seconds)}` : ''}`}
        actions={
          <Button variant="secondary" size="sm" onClick={() => window.print()} className="no-print">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        }
      />

      {!data.student_id && (
        <div role="status" className="mb-6 rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This student hasn&apos;t accepted the invite as a registered user yet, so assignments and full-profile actions are unavailable until they sign up.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScoreCard data={data} />
        <TeachThisNext data={data} />
      </div>
      <div className="mt-10">
        <DomainBreakdown data={data} />
      </div>
      <FooterActions data={data} />
    </div>
  );
};

export default IntakeResultsPage;
