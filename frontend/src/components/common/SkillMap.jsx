/**
 * SkillMap — a per-skill accuracy map for a completed practice test.
 *
 * Skills are grouped under their SAT domain, weakest domain first, weakest skill
 * first within each (the "what to fix next" spine). Each skill shows an accuracy
 * meter whose fill tone follows the canonical accuracy thresholds (pine = strong,
 * amber = developing, rose = needs work) — color always paired with the percent
 * and fraction, never the sole signal.
 *
 * Borderless / hairline per Study Hall: domains separated by whitespace and thin
 * rules, skills by row dividers. No nested cards. Meters draw in on view and
 * collapse to static fills under prefers-reduced-motion.
 *
 * Shared by the student results page and the tutor's view of a student.
 */
import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion, useInView } from '../../hooks/useMotion';
import { toneForAccuracy } from '../ui/StatusPill';

const SUBJECT_LABEL = { math: 'Math', reading_writing: 'Reading & Writing' };
const SUBJECT_ORDER = ['reading_writing', 'math'];

// Meter fill per tone. Performance IS the meaning here, so the low→high
// rose→amber→pine ramp is legitimate (and paired with text everywhere).
const FILL = {
  good: 'bg-accent-500 dark:bg-accent-500',
  warn: 'bg-brand-500 dark:bg-brand-400',
  bad: 'bg-rose-500 dark:bg-rose-400',
  neutral: 'bg-surface-muted',
};
const LABEL = {
  good: 'text-accent-700 dark:text-accent-300',
  warn: 'text-brand-700 dark:text-brand-300',
  bad: 'text-rose-700 dark:text-rose-400',
  neutral: 'text-ink-subtle',
};

const groupByDomain = (skills) => {
  const bySubject = {};
  for (const s of skills) {
    const subj = s.subject_area || 'other';
    const dom = s.domain || 'Other';
    (bySubject[subj] ||= {});
    (bySubject[subj][dom] ||= []).push(s);
  }
  // Build ordered structure: subjects (fixed order) → domains (weakest first) → skills (weakest first)
  const out = [];
  for (const subj of SUBJECT_ORDER) {
    if (!bySubject[subj]) continue;
    const domains = Object.entries(bySubject[subj]).map(([name, items]) => {
      const correct = items.reduce((a, s) => a + s.correct, 0);
      const total = items.reduce((a, s) => a + s.total, 0);
      const accuracy = total ? (100 * correct) / total : 0;
      const sorted = [...items].sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
      return { name, correct, total, accuracy, skills: sorted };
    });
    domains.sort((a, b) => a.accuracy - b.accuracy);
    const correct = domains.reduce((a, d) => a + d.correct, 0);
    const total = domains.reduce((a, d) => a + d.total, 0);
    out.push({
      subject: subj,
      label: SUBJECT_LABEL[subj] || subj,
      correct,
      total,
      accuracy: total ? (100 * correct) / total : 0,
      domains,
    });
  }
  return out;
};

const Meter = ({ accuracy, tone, animate }) => {
  const [w, setW] = useState(animate ? 0 : accuracy);
  useEffect(() => {
    if (!animate) { setW(accuracy); return; }
    const id = requestAnimationFrame(() => setW(accuracy));
    return () => cancelAnimationFrame(id);
  }, [accuracy, animate]);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
      <div
        className={`h-full rounded-full ${FILL[tone]}`}
        style={{
          width: `${w}%`,
          transition: animate ? 'width 0.9s var(--ease-out-expo)' : 'none',
        }}
      />
    </div>
  );
};

const SkillRow = ({ skill, animate, onPractice }) => {
  const tone = toneForAccuracy(skill.accuracy);
  const pct = Math.round(skill.accuracy);
  return (
    <li className="group/skill py-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium text-ink-body" title={skill.skill}>
          {skill.skill}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-xs tabular-nums text-ink-subtle">{skill.correct}/{skill.total}</span>
          <span className={`text-sm font-semibold tabular-nums ${LABEL[tone]}`}>{pct}%</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Meter accuracy={skill.accuracy} tone={tone} animate={animate} />
        {onPractice && skill.skill_id && tone !== 'good' && (
          <button
            type="button"
            onClick={() => onPractice(skill)}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 opacity-0 transition-opacity hover:bg-brand-50 focus-visible:opacity-100 group-hover/skill:opacity-100 dark:text-brand-300 dark:hover:bg-brand-900/30"
            aria-label={`Practice ${skill.skill}`}
          >
            Practice
          </button>
        )}
      </div>
    </li>
  );
};

const DomainBlock = ({ domain, animate, onPractice }) => {
  const tone = toneForAccuracy(domain.accuracy);
  return (
    <div className="break-inside-avoid">
      <div className="flex items-baseline justify-between gap-3 border-b border-edge-subtle pb-1.5">
        <h4 className="truncate text-[13px] font-semibold text-ink-body">{domain.name}</h4>
        <span className={`text-xs font-semibold tabular-nums ${LABEL[tone]}`}>
          {Math.round(domain.accuracy)}%
        </span>
      </div>
      <ul className="divide-y divide-edge-subtle/70">
        {domain.skills.map((s) => (
          <SkillRow key={`${s.skill_id ?? s.skill}`} skill={s} animate={animate} onPractice={onPractice} />
        ))}
      </ul>
    </div>
  );
};

const SubjectColumn = ({ group, animate, onPractice }) => {
  const tone = toneForAccuracy(group.accuracy);
  const dotTone = { good: 'bg-accent-500', warn: 'bg-brand-500', bad: 'bg-rose-500', neutral: 'bg-ink-faint' }[tone];
  return (
    <div className="min-w-0">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${dotTone}`} aria-hidden="true" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-body">{group.label}</h3>
        </div>
        <div className="text-right">
          <span className="font-display text-2xl font-semibold leading-none tabular-nums text-ink-body">
            {Math.round(group.accuracy)}<span className="text-base text-ink-subtle">%</span>
          </span>
          <span className="ml-2 text-xs tabular-nums text-ink-subtle">{group.correct}/{group.total}</span>
        </div>
      </div>
      <div className="space-y-6">
        {group.domains.map((d) => (
          <DomainBlock key={d.name} domain={d} animate={animate} onPractice={onPractice} />
        ))}
      </div>
    </div>
  );
};

const SkillMap = ({ skills = [], onPractice }) => {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView({ threshold: 0.1, once: true });
  const animate = !reduced && inView;

  const groups = useMemo(() => groupByDomain(skills), [skills]);

  if (!skills.length) {
    return (
      <p className="rounded-xl border border-dashed border-edge px-4 py-10 text-center text-sm text-ink-subtle">
        A per-skill map appears once this test has question-level data.
      </p>
    );
  }

  return (
    <div ref={ref} className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
      {groups.map((g) => (
        <SubjectColumn key={g.subject} group={g} animate={animate} onPractice={onPractice} />
      ))}
    </div>
  );
};

export default SkillMap;
