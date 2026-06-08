/**
 * LegalPage — shared layout for static legal documents (privacy, terms, cookies).
 * Readable long-form column, works signed-in or out, back-to-home link.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const LegalPage = ({ title, updated, children }) => (
  <div className="min-h-screen bg-surface-page">
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-ink-subtle transition-colors hover:text-ink-body"
      >
        <ArrowLeft className="h-4 w-4" /> Back to ZooPrep
      </Link>

      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-body">{title}</h1>
      {updated && <p className="mt-2 text-sm text-ink-faint">Last updated {updated}</p>}

      <div className="legal-prose mt-8 space-y-6 text-[15px] leading-relaxed text-ink-muted">
        {children}
      </div>
    </div>
  </div>
);

/** Small section helper: a heading + body. */
export const LegalSection = ({ heading, children }) => (
  <section>
    <h2 className="mb-2 font-display text-lg font-semibold text-ink-body">{heading}</h2>
    <div className="space-y-3">{children}</div>
  </section>
);

export default LegalPage;
