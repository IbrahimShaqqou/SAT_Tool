/**
 * Sidebar navigation — collapsible (expanded/icon-only)
 * Expanded: 220px with labels | Collapsed: 60px icon-only
 * State persisted in localStorage
 * Mobile: full drawer with overlay
 */
import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart3,
  Link as LinkIcon,
  Brain,
  FileText,
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  ListChecks,
} from 'lucide-react';

const tutorGroups = [
  {
    label: null,
    items: [
      { to: '/tutor', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/tutor/students', icon: Users, label: 'Students' },
    ],
  },
  {
    label: 'Practice',
    items: [
      { to: '/tutor/assignments', icon: ClipboardList, label: 'Assignments' },
      { to: '/tutor/questions', icon: BookOpen, label: 'Question Bank' },
      { to: '/tutor/lessons', icon: GraduationCap, label: 'Skill Lessons' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/tutor/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/tutor/invites', icon: LinkIcon, label: 'Invite Links' },
    ],
  },
];

const studentGroups = [
  {
    label: null,
    items: [
      { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/student/study-plan', icon: ListChecks, label: 'Study Plan' },
      { to: '/student/diagnostic', icon: ClipboardCheck, label: 'Diagnostic' },
      { to: '/student/assignments', icon: ClipboardList, label: 'My Assignments' },
    ],
  },
  {
    label: 'Practice',
    items: [
      { to: '/student/practice-tests', icon: FileText, label: 'Practice Tests' },
      { to: '/student/questions', icon: BookOpen, label: 'Question Bank' },
      { to: '/student/lessons', icon: GraduationCap, label: 'Skill Lessons' },
      { to: '/student/adaptive', icon: Brain, label: 'Adaptive Practice' },
    ],
  },
  {
    label: 'Progress',
    items: [
      { to: '/student/progress', icon: FileText, label: 'My Progress' },
    ],
  },
];

const Sidebar = ({ role = 'student', isOpen, onClose, onExpandChange, forceCollapsed = false }) => {
  const normalizedRole = role?.toLowerCase() || 'student';
  const groups = normalizedRole === 'tutor' ? tutorGroups : studentGroups;

  const [isExpanded, setIsExpanded] = useState(() => {
    try { return localStorage.getItem('sidebar_expanded') !== 'false'; }
    catch { return true; }
  });

  // Effective expanded state: forceCollapsed overrides user preference
  const effectiveExpanded = forceCollapsed ? false : isExpanded;

  useEffect(() => {
    if (!forceCollapsed) {
      try { localStorage.setItem('sidebar_expanded', String(isExpanded)); }
      catch {}
      onExpandChange?.(isExpanded);
    } else {
      onExpandChange?.(false);
    }
  }, [isExpanded, onExpandChange, forceCollapsed]);

  const toggle = () => setIsExpanded(v => !v);

  const width = effectiveExpanded ? 'lg:w-[220px]' : 'lg:w-[60px]';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-surface-overlay backdrop-blur-sm z-overlay lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        aria-label="Primary navigation"
        className={`
          fixed left-0 top-0 h-screen
          w-[220px] ${width}
          bg-surface-card
          border-r border-edge
          flex flex-col z-modal
          transition-[width] duration-200 ease-in-out
          overflow-hidden
          lg:translate-x-0 lg:z-sticky
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo row */}
        <div className="h-14 flex items-center px-3.5 flex-shrink-0 border-b border-edge">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-display font-semibold text-sm">Z</span>
            </div>
            {effectiveExpanded && (
              <span className="text-[15px] font-display font-semibold text-ink-body tracking-tight whitespace-nowrap overflow-hidden">
                ZooPrep
              </span>
            )}
          </div>
          {/* Mobile close */}
          <button
            onClick={onClose}
            className="lg:hidden ml-auto p-1 text-ink-faint hover:text-ink-body rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          {groups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
              {/* Group label */}
              {group.label && effectiveExpanded && (
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-faint whitespace-nowrap">
                  {group.label}
                </p>
              )}
              {group.label && !effectiveExpanded && (
                <div className="mx-3 my-2 h-px bg-edge-subtle" />
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  title={!effectiveExpanded ? item.label : undefined}
                  className={({ isActive }) => `
                    relative flex items-center gap-3
                    ${effectiveExpanded ? 'px-3 mx-2' : 'px-[18px] mx-0 justify-center'}
                    py-2.5 rounded-xl my-0.5
                    text-sm font-medium transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                    ${isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'text-ink-subtle hover:bg-surface-muted hover:text-ink-body'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? 'text-brand-600 dark:text-brand-400' : ''}`} />
                      {effectiveExpanded && (
                        <span className="whitespace-nowrap overflow-hidden">{item.label}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Collapse toggle (desktop only) — hidden when force-collapsed by route */}
        {!forceCollapsed && (
          <div className="hidden lg:flex items-center border-t border-edge p-3 flex-shrink-0">
            <button
              onClick={toggle}
              className={`flex items-center gap-2 text-xs text-ink-faint hover:text-ink-muted transition-colors rounded-lg px-2 py-1.5 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${!effectiveExpanded ? 'mx-auto' : 'w-full'}`}
              aria-label={effectiveExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
              title={effectiveExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {effectiveExpanded ? (
                <>
                  <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap overflow-hidden">Collapse</span>
                </>
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
