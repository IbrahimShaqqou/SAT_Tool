import React, { useState } from 'react';

/**
 * Collapsible coaching sidebar for the tutor's live view. Starts expanded;
 * collapses to a thin rail so the tutor can see exactly what the student sees.
 * Study Hall: big Fraunces answer numeral, hairline rules, warm amber accent.
 *
 * Phase 1 is observe-only, so the tool row is rendered disabled. Phase 2 wires
 * Draw / Highlight / Go-to-question / Reveal.
 */
export default function TutorLivePanel({
  correctAnswerLabel,
  explanationHtml,
  studentStatus = {},
}) {
  const [expanded, setExpanded] = useState(true);
  const { answered, correct, selectedLabel } = studentStatus;

  if (!expanded) {
    return (
      <div className="flex w-12 flex-col items-center border-l border-edge bg-surface-muted pt-4">
        <button
          type="button"
          aria-label="Expand coach panel"
          onClick={() => setExpanded(true)}
          className="text-brand-600 [writing-mode:vertical-rl] rotate-180 text-xs font-semibold"
        >
          ▶ COACH PANEL
        </button>
      </div>
    );
  }

  return (
    <aside className="flex w-72 flex-col gap-4 border-l border-edge bg-surface-muted p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
          Correct answer
        </span>
        <button
          type="button"
          aria-label="Collapse coach panel"
          onClick={() => setExpanded(false)}
          className="text-xs text-ink-subtle hover:text-ink-body"
        >
          Collapse ▶
        </button>
      </div>

      <div className="font-display text-3xl leading-none text-accent-700">
        {correctAnswerLabel}
      </div>

      {answered && (
        <div className="border-t border-edge pt-3 text-sm font-semibold">
          {correct ? (
            <span className="text-accent-700">✓ Student answered correctly</span>
          ) : (
            <span className="text-rose-600">
              ✕ Student answered {selectedLabel} (incorrect)
            </span>
          )}
        </div>
      )}

      <div className="border-t border-edge pt-3">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
          Explanation
        </div>
        <div
          className="prose prose-sm text-ink-body"
          dangerouslySetInnerHTML={{ __html: explanationHtml || '' }}
        />
      </div>

      <div className="mt-auto flex flex-wrap gap-2 opacity-50" title="Available in Phase 2">
        {['Draw', 'Highlight', 'Go to Q…', 'Reveal to student'].map((t) => (
          <span key={t} className="rounded-lg border border-edge bg-surface-card px-2.5 py-1.5 text-[11px] font-semibold text-ink-body">
            {t}
          </span>
        ))}
      </div>
    </aside>
  );
}
