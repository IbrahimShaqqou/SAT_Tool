/**
 * Avatar component with initials fallback
 */

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const Avatar = ({
  src,
  alt = '',
  name = '',
  size = 'md',
  className = '',
}) => {
  // Generate initials from name
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Generate consistent color from name
  const getColor = (name) => {
    if (!name) return 'bg-gray-400';
    const colors = [
      'bg-gray-600',
      'bg-gray-700',
      'bg-gray-800',
      'bg-slate-600',
      'bg-zinc-600',
      'bg-neutral-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name}
        className={`rounded-full object-cover ${sizes[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`
        rounded-full flex items-center justify-center
        text-white font-medium
        ${getColor(name)}
        ${sizes[size]}
        ${className}
      `}
      aria-label={name || 'User avatar'}
    >
      {getInitials(name)}
    </div>
  );
};

export default Avatar;
