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
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const fullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '';
  const rolePrefix = user?.role?.toLowerCase() === 'tutor' ? '/tutor' : '/student';

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-5 sticky top-0 z-30">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
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
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Avatar name={fullName || user?.email} size="sm" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block max-w-[140px] truncate">
            {fullName || user?.email}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-card-lg border border-slate-100 dark:border-slate-700 py-1.5 z-50">
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{fullName || user?.email}</p>
              {fullName && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{user?.email}</p>}
            </div>

            {[
              { label: 'Settings', icon: Settings, path: `${rolePrefix}/settings` },
              { label: 'Profile', icon: User, path: `${rolePrefix}/profile` },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => { setIsMenuOpen(false); navigate(item.path); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
              >
                <item.icon className="h-4 w-4 text-slate-400" />
                {item.label}
              </button>
            ))}

            <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
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
