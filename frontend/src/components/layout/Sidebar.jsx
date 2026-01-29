/**
 * Sidebar navigation component
 * Different navigation items for tutor vs student
 * Responsive: drawer on mobile, fixed on desktop
 * Supports dark mode
 */
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
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
} from 'lucide-react';

const tutorNavItems = [
  { to: '/tutor', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/tutor/students', icon: Users, label: 'Students' },
  { to: '/tutor/assignments', icon: ClipboardList, label: 'Assignments' },
  { to: '/tutor/questions', icon: BookOpen, label: 'Question Bank' },
  { to: '/tutor/lessons', icon: GraduationCap, label: 'Skill Lessons' },
  { to: '/tutor/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/tutor/invites', icon: LinkIcon, label: 'Invite Links' },
];

const studentNavItems = [
  { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/student/assignments', icon: ClipboardList, label: 'My Assignments' },
  { to: '/student/questions', icon: BookOpen, label: 'Question Bank' },
  { to: '/student/lessons', icon: GraduationCap, label: 'Skill Lessons' },
  { to: '/student/adaptive', icon: Brain, label: 'Adaptive Practice' },
  { to: '/student/progress', icon: FileText, label: 'My Progress' },
];

const Sidebar = ({ role = 'student', isOpen, onClose }) => {
  const normalizedRole = role?.toLowerCase() || 'student';
  const navItems = normalizedRole === 'tutor' ? tutorNavItems : studentNavItems;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-50
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">ZooPrep</span>
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
                }
              `}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            ZooPrep
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
