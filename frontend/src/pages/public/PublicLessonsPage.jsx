/**
 * Public Lessons Page
 * Accessible without login, shows login prompt banner
 */
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import LessonsPage from '../student/LessonsPage';
import { useAuth } from '../../hooks/useAuth';

const PublicLessonsPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with login prompt */}
      {!user && (
        <div className="bg-purple-600 dark:bg-purple-700 text-white px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/" className="text-xl font-bold hover:opacity-90">
                ZooPrep
              </Link>
              <span className="text-purple-200">|</span>
              <span className="text-sm text-purple-100">
                Log in to track your progress and mark lessons complete
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Log In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-400 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Navigation for logged-in users */}
      {user && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link to="/" className="text-xl font-bold text-gray-900 dark:text-gray-100">
              ZooPrep
            </Link>
            <Link
              to={user.role?.toLowerCase() === 'tutor' ? '/tutor' : '/student'}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* Lessons Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <LessonsPage isPublic={true} />
      </div>
    </div>
  );
};

export default PublicLessonsPage;
