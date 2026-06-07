/**
 * Empty state component for when there's no data
 * Supports dark mode
 */

const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      {Icon && (
        <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-surface-muted">
          <Icon className="h-6 w-6 text-ink-faint" />
        </div>
      )}
      {title && (
        <h3 className="mt-4 text-sm font-medium text-ink-body">{title}</h3>
      )}
      {description && (
        <p className="mt-1 text-sm text-ink-subtle">{description}</p>
      )}
      {action && (
        <div className="mt-6">{action}</div>
      )}
    </div>
  );
};

export default EmptyState;
