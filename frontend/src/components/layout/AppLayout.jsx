/**
 * Main application layout with collapsible sidebar
 * Sidebar auto-collapses on test/question pages for maximum workspace
 */
import { useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from './Sidebar';
import Header from './Header';

// Routes where the sidebar should auto-collapse for maximum content area
const TEST_ROUTES = [
  '/student/test/',
  '/student/adaptive',
  '/student/questions',
  '/tutor/questions',
  '/assess/',
];

const isTestRoute = (pathname) =>
  TEST_ROUTES.some((r) => pathname.startsWith(r));

const AppLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role?.toLowerCase() || 'student';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    try { return localStorage.getItem('sidebar_expanded') !== 'false'; }
    catch { return true; }
  });

  const onTestPage = isTestRoute(location.pathname);

  const handleExpandChange = useCallback((expanded) => {
    setIsSidebarExpanded(expanded);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(v => !v);
  const closeSidebar = () => setIsSidebarOpen(false);

  // When on a test/question page the sidebar is always collapsed (60px)
  const effectivelyExpanded = onTestPage ? false : isSidebarExpanded;
  const contentPadding = effectivelyExpanded ? 'lg:pl-[220px]' : 'lg:pl-[60px]';

  return (
    <div className="min-h-screen dark:bg-slate-950">
      <Sidebar
        role={role}
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        onExpandChange={handleExpandChange}
        forceCollapsed={onTestPage}
      />

      {/* Content area — no max-w so test pages can use full available width */}
      <div className={`${contentPadding} transition-[padding] duration-200 ease-in-out`}>
        <Header onMenuClick={toggleSidebar} />
        <main className="p-5 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
