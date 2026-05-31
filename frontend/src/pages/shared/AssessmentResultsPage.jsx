/**
 * Shared Assessment Results — Study Hall.
 *
 * Used by: Intake Assessment (standalone) and Diagnostic (inside AppLayout).
 * Renders its own page shell so it works in both contexts. Borderless sections,
 * shared ProgressRing, StatusPill (status paired with text, never color-only),
 * act-on-able focus areas. Tokens, dark mode, a11y.
 *
 * Props: results, title, subtitle, onGoHome, isLoading, error
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, ChevronDown, ChevronUp,
  Clock, BookOpen, AlertTriangle, Target, Zap, ArrowRight,
} from 'lucide-react';
import {
  Button, ProgressRing, Section, StatusPill, toneForAccuracy,
} from '../../components/ui';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

const SectionBar = ({ label, correct, total }) => {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink-body">{label}</span>
        <span className="text-sm text-ink-subtle">{correct}/{total} · {pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-brand-500 transition-[width] duration-700 ease-out-expo" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const MathContent = ({ html, className = '' }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetClear?.([ref.current]);
      window.MathJax.typesetPromise([ref.current]).catch(() => {});
    }
  }, [html]);
  if (!html) return null;
  return <div ref={ref} className={`question-content ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
};

const SkillRow = ({ skill, rank, navigate }) => (
  <div className="flex items-center gap-3 py-3">
    {rank !== undefined && (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{rank}</span>
    )}
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-ink-body">{skill.skill_name || 'Unknown Skill'}</p>
      <p className="text-xs text-ink-subtle">{skill.correct}/{skill.total} correct{skill.domain_code && <> · {skill.domain_code}</>}</p>
    </div>
    <StatusPill value={skill.accuracy} size="sm" />
    <div className="flex shrink-0 gap-1.5">
      {skill.lesson_id && (
        <button onClick={() => navigate(`/student/lessons/${skill.lesson_id}`)} className="flex items-center gap-1 rounded-lg bg-surface-muted px-2 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-edge-subtle hover:text-ink-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <BookOpen className="h-3.5 w-3.5" /> Study
        </button>
      )}
      <button onClick={() => navigate(`/student/adaptive?skill=${skill.skill_id}&autostart=true`)} className="flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <Zap className="h-3.5 w-3.5" /> Practice
      </button>
    </div>
  </div>
);

export default function AssessmentResultsPage({
  results, title = 'Assessment Results', subtitle, onGoHome, isLoading = false, error = null,
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());

  const toggleQuestion = useCallback((index) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-edge border-t-brand-500" />
          <p className="mt-4 text-sm text-ink-subtle">Loading your results…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page p-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-brand-500" />
          <h1 className="mb-2 font-display text-xl font-semibold text-ink-body">Couldn't load results</h1>
          <p className="text-ink-subtle">{error}</p>
        </div>
      </div>
    );
  }

  if (!results) return null;

  const {
    questions_answered = 0, questions_correct = 0, time_seconds = 0,
    section_accuracy = [], domain_breakdown = [], all_skills = [], worst_skills = [], questions = [],
  } = results;

  const timeMinutes = Math.floor(time_seconds / 60);
  const overallAccuracy = questions_answered > 0 ? (questions_correct / questions_answered) * 100 : 0;
  const correctQuestions = questions.filter((q) => q.is_correct);
  const incorrectQuestions = questions.filter((q) => !q.is_correct);
  const mathSkills = all_skills.filter((s) => s.section === 'math');
  const rwSkills = all_skills.filter((s) => s.section === 'reading_writing');
  const mathSection = section_accuracy.find((s) => s.section === 'math');
  const rwSection = section_accuracy.find((s) => s.section === 'reading_writing');

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <header className="pb-7">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Score report</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-body sm:text-4xl">{title}</h1>
          <span aria-hidden="true" className="mt-3 block h-1 w-[4.5rem] rounded-full bg-brand-500" />
          {subtitle && <p className="mt-3 max-w-xl text-[15px] text-ink-muted">{subtitle}</p>}
        </header>

        {/* Accuracy summary */}
        <div className="flex flex-col items-center gap-8 border-y border-edge py-7 sm:flex-row sm:items-center">
          <ProgressRing value={overallAccuracy} size={120} stroke={10} label={`Overall accuracy ${Math.round(overallAccuracy)} percent`}>
            <span className="font-display text-2xl font-semibold text-ink-body">{Math.round(overallAccuracy)}%</span>
          </ProgressRing>
          <div className="w-full flex-1 space-y-5 sm:border-l sm:border-edge sm:pl-8">
            {mathSection && <SectionBar label="Math" correct={mathSection.correct} total={mathSection.total} />}
            {rwSection && <SectionBar label="Reading & Writing" correct={rwSection.correct} total={rwSection.total} />}
            <div className="flex flex-wrap gap-6 border-t border-edge-subtle pt-3 text-sm text-ink-subtle">
              <span className="flex items-center gap-1.5"><Target className="h-4 w-4" /> {questions_correct}/{questions_answered} correct</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {timeMinutes} min</span>
            </div>
          </div>
        </div>

        {/* Focus areas */}
        {worst_skills.length > 0 && (
          <Section className="mt-10" title="Focus areas" icon={Target} hint="Start here for the biggest gains">
            <div className="divide-y divide-edge-subtle">
              {worst_skills.map((skill, i) => <SkillRow key={skill.skill_id} skill={skill} rank={i + 1} navigate={navigate} />)}
            </div>
          </Section>
        )}

        {/* Skill breakdown */}
        {all_skills.length > 0 && (
          <div className="mt-10 grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
            {mathSkills.length > 0 && (
              <Section title="Math skills" hint={mathSection ? `${mathSection.accuracy}%` : undefined}>
                <div className="divide-y divide-edge-subtle">{mathSkills.map((s) => <SkillRow key={s.skill_id} skill={s} navigate={navigate} />)}</div>
              </Section>
            )}
            {rwSkills.length > 0 && (
              <Section title="Reading & Writing skills" hint={rwSection ? `${rwSection.accuracy}%` : undefined}>
                <div className="divide-y divide-edge-subtle">{rwSkills.map((s) => <SkillRow key={s.skill_id} skill={s} navigate={navigate} />)}</div>
              </Section>
            )}
          </div>
        )}

        {/* Domain breakdown — warm tinted tiles */}
        {domain_breakdown.length > 0 && (
          <Section className="mt-10" title="Domain breakdown" hint="Accuracy by content domain">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {domain_breakdown.map((domain) => {
                const tone = toneForAccuracy(domain.accuracy);
                const toneClass = {
                  good: 'bg-accent-50 dark:bg-accent-900/25', warn: 'bg-brand-50 dark:bg-brand-900/25',
                  bad: 'bg-rose-50 dark:bg-rose-900/20', neutral: 'bg-surface-muted',
                }[tone];
                return (
                  <div key={domain.domain_id || domain.domain_code} className={`rounded-xl p-3 ${toneClass}`}>
                    <div className="font-mono text-xs font-bold text-ink-body">{domain.domain_code}</div>
                    <div className="mb-1 text-sm font-medium leading-tight text-ink-body">{domain.domain_name}</div>
                    <div className="text-xs text-ink-subtle">{domain.correct}/{domain.total} · {Math.round(domain.accuracy)}%</div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Tabs */}
        <div className="mt-12 mb-5 flex gap-1.5 border-b border-edge pb-3">
          {['overview', 'questions'].map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab} role="tab" aria-selected={active} onClick={() => setActiveTab(tab)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted hover:text-ink-body hover:bg-edge-subtle'}`}
              >
                {tab === 'questions' ? `Question review (${questions.length})` : 'Overview'}
              </button>
            );
          })}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
            <Section title={`Correct (${correctQuestions.length})`}>
              <ul className="space-y-1.5">
                {correctQuestions.map((q) => (
                  <li key={q.question_id} className="flex items-center gap-2 rounded-lg bg-accent-50 px-3 py-1.5 text-sm dark:bg-accent-900/20">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400" />
                    <span className="w-8 shrink-0 font-medium text-ink-body">Q{q.order + 1}</span>
                    <span className="truncate text-ink-subtle">{q.skill_name || q.domain_name}</span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title={`Incorrect (${incorrectQuestions.length})`}>
              <ul className="space-y-1.5">
                {incorrectQuestions.map((q) => (
                  <li key={q.question_id}>
                    <button
                      onClick={() => { setActiveTab('questions'); setExpandedQuestions(new Set([q.order])); setTimeout(() => document.getElementById(`question-${q.order}`)?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                      className="flex w-full items-center gap-2 rounded-lg bg-rose-50 px-3 py-1.5 text-left text-sm transition-colors hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span className="w-8 shrink-0 font-medium text-ink-body">Q{q.order + 1}</span>
                      <span className="flex-1 truncate text-ink-subtle">{q.skill_name || q.domain_name}</span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        )}

        {/* Question review tab */}
        {activeTab === 'questions' && (
          <ul className="divide-y divide-edge">
            {questions.map((q, index) => (
              <li key={q.question_id} id={`question-${index}`}>
                <button
                  className="flex w-full items-center justify-between gap-3 py-4 text-left focus-visible:outline-none"
                  onClick={() => toggleQuestion(index)}
                  aria-expanded={expandedQuestions.has(index)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {q.is_correct
                      ? <CheckCircle className="h-5 w-5 shrink-0 text-accent-600 dark:text-accent-400" />
                      : <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />}
                    <span className="font-semibold text-ink-body">Question {index + 1}</span>
                    {q.domain_code && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-subtle">{q.domain_code}</span>}
                    {q.skill_name && <span className="hidden truncate text-sm text-ink-subtle md:inline">{q.skill_name}</span>}
                  </div>
                  {expandedQuestions.has(index) ? <ChevronUp className="h-5 w-5 shrink-0 text-ink-faint" /> : <ChevronDown className="h-5 w-5 shrink-0 text-ink-faint" />}
                </button>

                {expandedQuestions.has(index) && (
                  <div className="pb-5">
                    {q.passage_html && <MathContent html={q.passage_html} className="prose prose-sm mb-4 max-w-none rounded-lg bg-surface-muted p-4 text-ink-muted" />}
                    <MathContent html={q.prompt_html} className="prose prose-sm mb-4 max-w-none text-ink-body" />

                    {q.answer_type === 'MCQ' && q.choices && (
                      <div className="mb-4 space-y-2">
                        {q.choices.map((choice, ci) => {
                          const isStudent = q.student_answer?.index === ci;
                          const isCorrect = q.correct_answer?.index === ci;
                          return (
                            <div key={ci} className={`flex items-start gap-3 rounded-lg border p-3 ${isCorrect ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/20' : isStudent && !q.is_correct ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20' : 'border-edge bg-surface-card'}`}>
                              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-medium ${isCorrect ? 'bg-accent-500 text-white' : isStudent ? 'bg-rose-500 text-white' : 'bg-surface-muted text-ink-muted'}`}>{CHOICE_LABELS[ci]}</span>
                              <MathContent html={choice.content} className="prose prose-sm max-w-none flex-1 text-ink-body" />
                              {isStudent && <span className="ml-auto text-xs text-ink-subtle">Your answer</span>}
                              {isCorrect && <span className="ml-auto text-xs font-medium text-accent-700 dark:text-accent-400">Correct</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.answer_type === 'SPR' && (
                      <div className="mb-4 space-y-2">
                        <div className={`rounded-lg p-3 ${q.is_correct ? 'bg-accent-50 dark:bg-accent-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                          <span className="text-sm font-medium text-ink-subtle">Your answer: </span>
                          <span className={q.is_correct ? 'text-accent-700 dark:text-accent-300' : 'text-rose-700 dark:text-rose-300'}>{q.student_answer?.answer || '(no answer)'}</span>
                        </div>
                        {!q.is_correct && (
                          <div className="rounded-lg bg-accent-50 p-3 dark:bg-accent-900/20">
                            <span className="text-sm font-medium text-ink-subtle">Correct answer: </span>
                            <span className="text-accent-700 dark:text-accent-300">{q.correct_answer?.answers?.join(' or ') || q.correct_answer?.answer}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {q.explanation_html && (
                      <div className="mt-4 rounded-lg border border-edge-subtle bg-surface-muted p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                          <span className="font-medium text-ink-body">Explanation</span>
                        </div>
                        <MathContent html={q.explanation_html} className="prose prose-sm max-w-none text-ink-muted" />
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* CTA */}
        <Section className="mt-12" title="Ready to improve?">
          <p className="mb-5 text-sm text-ink-muted">Start practicing your weak areas with questions tailored to your level.</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => navigate('/student/adaptive')}><Zap className="h-4 w-4" /> Start adaptive practice</Button>
            <Button variant="secondary" onClick={onGoHome || (() => navigate('/student'))}>Go to dashboard <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
