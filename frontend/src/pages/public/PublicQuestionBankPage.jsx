/**
 * Public Question Bank Page
 * Accessible without login, shows login prompt banner
 */
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import QuestionBankPage from '../shared/QuestionBankPage';
import { useAuth } from '../../hooks/useAuth';

const PublicQuestionBankPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-surface-page">
      {/* Header with login prompt */}
      {!user && (
        <div className="bg-brand-600 text-white px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link to="/" className="font-display text-xl font-semibold hover:opacity-90">
                ZooPrep
              </Link>
              <span className="text-white/40">|</span>
              <span className="text-sm text-white/90">
                Log in to track your progress and access all features
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 bg-white text-brand-700 rounded-lg font-medium hover:bg-brand-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <LogIn className="h-4 w-4" />
                Log In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Navigation for logged-in users */}
      {user && (
        <div className="bg-surface-card border-b border-edge px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link to="/" className="font-display text-xl font-semibold text-ink-body">
              ZooPrep
            </Link>
            <Link
              to={user.role?.toLowerCase() === 'tutor' ? '/tutor' : '/student'}
              className="px-4 py-2 bg-surface-muted text-ink-body rounded-lg font-medium hover:bg-surface-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* Question Bank Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <QuestionBankPage userRole="student" isPublic={true} />
      </div>
    </div>
  );
};

export default PublicQuestionBankPage;
