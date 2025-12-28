/**
 * Sidebar navigation component
 * Different navigation items for tutor vs student
 */
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart3,
  Link as LinkIcon,
  Brain,
  FileText,
} from 'lucide-react';

const tutorNavItems = [
  { to: '/tutor', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/tutor/students', icon: Users, label: 'Students' },
  { to: '/tutor/assignments', icon: ClipboardList, label: 'Assignments' },
  { to: '/tutor/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/tutor/invites', icon: LinkIcon, label: 'Invite Links' },
];

const studentNavItems = [
  { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/student/assignments', icon: ClipboardList, label: 'My Assignments' },
  { to: '/student/adaptive', icon: Brain, label: 'Adaptive Practice' },
  { to: '/student/progress', icon: FileText, label: 'My Progress' },
];

const Sidebar = ({ role = 'student' }) => {
  const normalizedRole = role?.toLowerCase() || 'student';
  const navItems = normalizedRole === 'tutor' ? tutorNavItems : studentNavItems;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <span className="text-xl font-semibold text-gray-900">SAT Prep</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${isActive
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center">
          SAT Tutoring Platform
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
