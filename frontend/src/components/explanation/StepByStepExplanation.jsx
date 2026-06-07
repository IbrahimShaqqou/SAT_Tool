/**
 * StepByStepExplanation
 *
 * Renders a rich, step-by-step explanation for a SAT question.
 * Fetches from GET /questions/{questionId}/explanation.
 *
 * Props:
 *   questionId    — UUID string
 *   passageHtml   — optional passage HTML (for reading/grammar highlights)
 *   promptHtml    — question text HTML
 *   choices       — array of {index, content} objects
 *   onClose       — optional callback when user dismisses (null = not dismissible)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X } from 'lucide-react';
import { LoadingSpinner } from '../ui';
import DesmosGraph from './DesmosGraph';
import parseMarkdown from '../../utils/parseMarkdown';
import api from '../../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Highlight injection — walks text nodes to wrap exact substrings in <mark>
// ─────────────────────────────────────────────────────────────────────────────

function injectHighlights(html, highlights) {
  if (!html || !highlights || highlights.length === 0) return html;

  let result = html;
  for (const h of highlights) {
    if (!h.text || !h.color) continue;
    const escaped = h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`(${escaped})`, 'g');
    result = result.replace(rx, `<mark class="highlight-${h.color}">$1</mark>`);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type badge colors
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_META = {
  math:    { label: 'Math',    bg: 'bg-brand-600',   gradient: 'from-brand-500 to-brand-700' },
  reading: { label: 'Reading', bg: 'bg-emerald-600', gradient: 'from-emerald-500 to-emerald-700' },
  grammar: { label: 'Grammar', bg: 'bg-accent-600',  gradient: 'from-accent-500 to-accent-700' },
};

const STEP_COLORS = [
  'bg-brand-500',
  'bg-brand-600',
  'bg-brand-700',
  'bg-accent-600',
  'bg-accent-700',
];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const StepByStepExplanation = ({
  questionId,
  passageHtml = null,
  promptHtml = '',
  choices = [],
  onClose = null,
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [whyWrongOpen, setWhyWrongOpen] = useState(false);
  const tabsRef = useRef(null);
  const activeTabRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActiveStep(0);
    setWhyWrongOpen(false);

    api.get(`/questions/${questionId}/explanation`)
      .then(res => {
        if (!cancelled) setData(res.data);
      })
      .catch(err => {
        if (!cancelled) setError(err?.response?.status === 404
          ? 'No step-by-step explanation available yet.'
          : 'Failed to load explanation.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [questionId]);

  const goTo = useCallback((i) => {
    setActiveStep(Math.max(0, Math.min(i, (data?.data?.steps?.length ?? 1) - 1)));
  }, [data]);

  // Scroll active tab into view whenever it changes
  useEffect(() => {
    if (activeTabRef.current && tabsRef.current) {
      activeTabRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeStep]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" />
        <span className="ml-2 text-sm text-ink-subtle">Loading explanation…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 p-4 bg-surface-muted border border-edge rounded-lg text-sm text-ink-subtle italic">
        {error}
      </div>
    );
  }

  const expl = data?.data;
  if (!expl) return null;

  const { type = 'math', steps = [], key_insight, why_wrong = [] } = expl;
  const meta = TYPE_META[type] || TYPE_META.math;
  const step = steps[activeStep];
  const total = steps.length;

  // Build location map for highlights
  const locationMap = {
    passage: passageHtml || '',
    question: promptHtml || '',
  };
  const choiceLabels = 'ABCDEFGH';
  choices.forEach((c, i) => {
    if (i < 8) locationMap[`choice_${choiceLabels[i].toLowerCase()}`] = c.content || '';
  });

  // Highlights for the active step, split by location
  const stepHighlights = step?.highlights || [];
  const passageHighlights = stepHighlights.filter(h => h.location === 'passage');
  const questionHighlights = stepHighlights.filter(h => h.location === 'question');
  const choiceHighlights = stepHighlights.filter(h => h.location?.startsWith('choice_'));

  const renderedPassage = passageHighlights.length > 0
    ? injectHighlights(passageHtml, passageHighlights)
    : null;

  const renderedQuestion = questionHighlights.length > 0
    ? injectHighlights(promptHtml, questionHighlights)
    : null;

  return (
    <div className="mt-4 rounded-xl border border-edge overflow-hidden shadow-sm">

      {/* ── Header ── */}
      <div className={`bg-gradient-to-r ${meta.gradient} px-5 py-4 flex items-start justify-between`}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-semibold text-sm tracking-wide uppercase">
              Step-by-Step Explanation
            </span>
            <span className={`text-xs font-medium text-white bg-white/20 rounded-full px-2 py-0.5`}>
              {meta.label}
            </span>
          </div>
          {key_insight && (
            <p className="text-white/90 text-sm italic leading-snug mt-1">
              {key_insight}
            </p>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/70 hover:text-white ml-3 mt-0.5">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Step tabs (mobile: horizontal scroll; lg: subtle numbered list) ── */}
      {total > 1 && (
        <div ref={tabsRef} className="flex gap-1 px-4 pt-3 overflow-x-auto bg-surface-card border-b border-edge-subtle scrollbar-hide">
          {steps.map((s, i) => (
            <button
              key={i}
              ref={i === activeStep ? activeTabRef : null}
              onClick={() => goTo(i)}
              title={s.title}
              className={`
                flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-medium
                transition-colors border-b-2
                ${i === activeStep
                  ? `${STEP_COLORS[i % STEP_COLORS.length]} text-white border-transparent`
                  : 'text-ink-subtle bg-transparent border-transparent hover:text-ink-muted'}
              `}
            >
              <span className={`
                w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0
                ${i === activeStep ? 'bg-white/30' : 'bg-surface-muted text-ink-muted'}
              `}>
                {i + 1}
              </span>
              <span className="whitespace-nowrap">{s.title.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Active step body ── */}
      <div className="bg-surface-card px-5 py-4">

        {/* Step title (shown on mobile where tab label is hidden) */}
        <h3 className={`font-semibold text-base mb-3 ${
          type === 'math' ? 'text-brand-700 dark:text-brand-400'
          : type === 'grammar' ? 'text-accent-700 dark:text-accent-400'
          : 'text-emerald-700 dark:text-emerald-400'
        }`}>
          Step {activeStep + 1}: {step?.title}
        </h3>

        {/* Step content (markdown rendered) */}
        {step?.content && (
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-ink-body leading-relaxed mb-3"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(step.content) }}
          />
        )}

        {/* Desmos graph (math only) */}
        {step?.desmos && (
          <DesmosGraph
            equations={step.desmos.equations || []}
            x_min={step.desmos.x_min}
            x_max={step.desmos.x_max}
            y_min={step.desmos.y_min}
            y_max={step.desmos.y_max}
            hint={step.desmos.hint}
          />
        )}

        {/* Passage highlight snippet */}
        {renderedPassage && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg text-sm">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 uppercase tracking-wide">Passage</p>
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-ink-body"
              dangerouslySetInnerHTML={{ __html: renderedPassage }}
            />
          </div>
        )}

        {/* Question highlight snippet */}
        {renderedQuestion && (
          <div className="mt-3 p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800/30 rounded-lg text-sm">
            <p className="text-xs font-semibold text-brand-700 dark:text-brand-400 mb-1 uppercase tracking-wide">Question</p>
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-ink-body"
              dangerouslySetInnerHTML={{ __html: renderedQuestion }}
            />
          </div>
        )}

        {/* Choice highlights */}
        {choiceHighlights.length > 0 && choices.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {choiceHighlights.map((h, idx) => {
              const locLabel = h.location?.replace('choice_', '').toUpperCase();
              const choiceIdx = 'ABCDEFGH'.indexOf(locLabel);
              const choiceContent = choices[choiceIdx]?.content || '';
              const rendered = injectHighlights(choiceContent, [h]);
              return (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-muted flex items-center justify-center text-xs font-bold text-ink-muted">
                    {locLabel}
                  </span>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-ink-body"
                    dangerouslySetInnerHTML={{ __html: rendered }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Prev / Next navigation ── */}
      {total > 1 && (
        <div className="flex items-center justify-between px-5 py-3 bg-surface-muted border-t border-edge-subtle">
          <button
            onClick={() => goTo(activeStep - 1)}
            disabled={activeStep === 0}
            className="flex items-center gap-1 text-sm text-ink-subtle hover:text-ink-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <span className="text-xs text-ink-faint">
            {activeStep + 1} / {total}
          </span>
          <button
            onClick={() => goTo(activeStep + 1)}
            disabled={activeStep === total - 1}
            className="flex items-center gap-1 text-sm text-ink-subtle hover:text-ink-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Why were the other choices wrong? accordion ── */}
      {why_wrong && why_wrong.length > 0 && (
        <div className="border-t border-edge-subtle">
          <button
            onClick={() => setWhyWrongOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-ink-muted hover:bg-surface-muted transition-colors"
          >
            <span className="uppercase tracking-wide text-xs">Why were the other choices wrong?</span>
            {whyWrongOpen
              ? <ChevronUp className="h-4 w-4" />
              : <ChevronDown className="h-4 w-4" />
            }
          </button>

          {whyWrongOpen && (
            <div className="px-5 pb-4 bg-surface-card space-y-2">
              {why_wrong.map((w, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-xs font-bold text-rose-600 dark:text-rose-400">
                    {w.label}
                  </span>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-ink-muted leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(w.reason) }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StepByStepExplanation;
