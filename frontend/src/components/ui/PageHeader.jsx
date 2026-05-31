/**
 * PageHeader — Study Hall page title block. Big Fraunces title with an amber
 * signature rule, optional eyebrow + subtitle + right-aligned actions. Used at
 * the top of every redesigned page so headers feel like one family.
 */
import Reveal from './Reveal';

export const SignatureRule = ({ className = '', width = '4.5rem' }) => (
  <span
    aria-hidden="true"
    className={`mt-3 block h-1 origin-left rounded-full bg-brand-500 [animation:sig-wipe_0.7s_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none ${className}`}
    style={{ width }}
  />
);

const PageHeader = ({ eyebrow, title, subtitle, actions, rule = true, className = '' }) => (
  <Reveal as="header" className={`pt-2 pb-7 sm:pt-4 sm:pb-8 ${className}`}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight text-ink-body sm:text-4xl">
          {title}
        </h1>
        {rule && <SignatureRule />}
        {subtitle && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  </Reveal>
);

export default PageHeader;
