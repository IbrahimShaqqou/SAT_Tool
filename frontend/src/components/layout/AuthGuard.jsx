/**
 * Auth guard component to protect routes
 * Redirects to login if not authenticated
 * Can require specific roles
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PageLoader } from '../ui/LoadingSpinner';

const AuthGuard = ({
  children,
  requiredRole = null, // 'tutor', 'student', or null for any authenticated user
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading while checking auth
  if (isLoading) {
    return <PageLoader />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role if required (case-insensitive comparison)
  const userRole = user?.role?.toLowerCase();
  if (requiredRole && userRole !== requiredRole.toLowerCase()) {
    // Redirect to appropriate dashboard based on role
    const redirectPath = userRole === 'tutor' ? '/tutor' : '/student';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

export default AuthGuard;
