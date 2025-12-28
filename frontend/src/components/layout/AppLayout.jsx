/**
 * Main application layout with sidebar and header
 * Used for authenticated pages
 */
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from './Sidebar';
import Header from './Header';

const AppLayout = () => {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase() || 'student';

  // Tutor gets light gray background, student gets white
  const bgClass = role === 'tutor' ? 'bg-gray-100' : 'bg-white';

  return (
    <div className={`min-h-screen ${bgClass}`}>
      {/* Sidebar */}
      <Sidebar role={role} />

      {/* Main content area */}
      <div className="pl-64">
        {/* Header */}
        <Header />

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
