/**
 * Main application layout with sidebar and header
 * Used for authenticated pages
 * Responsive: collapsible sidebar on mobile
 * Supports dark mode
 */
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from './Sidebar';
import Header from './Header';

const AppLayout = () => {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase() || 'student';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Light mode: Tutor gets light gray background, student gets white
  // Dark mode: Both get dark background
  const bgClass = role === 'tutor'
    ? 'bg-gray-100 dark:bg-gray-900'
    : 'bg-white dark:bg-gray-900';

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className={`min-h-screen ${bgClass}`}>
      {/* Sidebar */}
      <Sidebar
        role={role}
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
      />

      {/* Main content area - push right on desktop, full width on mobile */}
      <div className="lg:pl-64">
        {/* Header */}
        <Header onMenuClick={toggleSidebar} />

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
