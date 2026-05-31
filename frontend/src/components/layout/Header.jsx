/**
 * App header — slim utility bar (user menu + mobile hamburger)
 * Supports dark mode
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Settings, ChevronDown, Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../ui/Avatar';

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setIsMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const fullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '';
  const rolePrefix = user?.role?.toLowerCase() === 'tutor' ? '/tutor' : '/student';

  return (
    <header className="h-14 bg-surface-card border-b border-edge flex items-center justify-between px-5 sticky top-0 z-sticky">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-1 text-ink-subtle hover:text-ink-body hover:bg-surface-muted rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop spacer */}
      <div className="hidden lg:block" />

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen(v => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
        >
          <Avatar name={fullName || user?.email} size="sm" />
          <span className="text-sm font-medium text-ink-muted hidden sm:block max-w-[140px] truncate">
            {fullName || user?.email}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-ink-faint" />
        </button>

        {isMenuOpen && (
          <div role="menu" className="absolute right-0 mt-1.5 w-52 bg-surface-card rounded-2xl shadow-card-lg border border-edge py-1.5 z-dropdown">
            <div className="px-4 py-2.5 border-b border-edge-subtle">
              <p className="text-sm font-semibold text-ink-body truncate">{fullName || user?.email}</p>
              {fullName && <p className="text-xs text-ink-subtle mt-0.5 truncate">{user?.email}</p>}
            </div>

            {[
              { label: 'Settings', icon: Settings, path: `${rolePrefix}/settings` },
              { label: 'Profile', icon: User, path: `${rolePrefix}/profile` },
            ].map((item) => (
              <button
                key={item.label}
                role="menuitem"
                onClick={() => { setIsMenuOpen(false); navigate(item.path); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-ink-muted hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:bg-surface-muted"
              >
                <item.icon className="h-4 w-4 text-ink-faint" />
                {item.label}
              </button>
            ))}

            <div className="border-t border-edge-subtle mt-1 pt-1">
              <button
                role="menuitem"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors focus-visible:outline-none focus-visible:bg-rose-50 dark:focus-visible:bg-rose-900/20"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
