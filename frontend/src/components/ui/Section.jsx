/**
 * Section — Study Hall's borderless content group. A hairline-ruled header
 * (uppercase Inter label + optional icon/hint) over content separated by
 * whitespace and row dividers, NOT a card box. Use everywhere instead of
 * wrapping lists/tables in elevated cards.
 */
const Section = ({ title, hint, icon: Icon, action, children, className = '', ...props }) => (
  <section className={className} {...props}>
    {title && (
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-edge pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />}
          <h2 className="truncate text-sm font-semibold uppercase tracking-wide text-ink-body">{title}</h2>
          {hint && <span className="hidden whitespace-nowrap text-xs normal-case tracking-normal text-ink-faint sm:inline">· {hint}</span>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    )}
    {children}
  </section>
);

export default Section;
