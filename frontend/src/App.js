/**
 * SAT Tutoring Platform - Main App Component
 * Root component with routing configuration
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { PageLoader } from './components/ui/LoadingSpinner';

// Layouts
import { AppLayout, PublicLayout, AuthGuard } from './components/layout';

// Auth Pages
import { LoginPage, RegisterPage } from './pages/auth';

// Tutor Pages (to be implemented)
import TutorDashboard from './pages/tutor/DashboardPage';
import TutorStudents from './pages/tutor/StudentsPage';
import StudentDetail from './pages/tutor/StudentDetailPage';
import TutorAssignments from './pages/tutor/AssignmentsPage';
import CreateAssignment from './pages/tutor/CreateAssignmentPage';
import TutorAnalytics from './pages/tutor/AnalyticsPage';
import TutorInvites from './pages/tutor/InvitesPage';

// Student Pages (to be implemented)
import StudentDashboard from './pages/student/DashboardPage';
import StudentAssignments from './pages/student/AssignmentsPage';
import TestPage from './pages/student/TestPage';
import ResultsPage from './pages/student/ResultsPage';
import AdaptivePracticePage from './pages/student/AdaptivePracticePage';

// Public Assessment
import { AssessmentPage } from './pages/assess';

// Root redirect based on role
const RoleBasedRedirect = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role?.toLowerCase() === 'tutor') {
    return <Navigate to="/tutor" replace />;
  }

  return <Navigate to="/student" replace />;
};

function App() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<RoleBasedRedirect />} />

      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Public assessment (no auth required) */}
      <Route path="/assess/:token" element={<AssessmentPage />} />

      {/* Tutor routes */}
      <Route
        element={
          <AuthGuard requiredRole="tutor">
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route path="/tutor" element={<TutorDashboard />} />
        <Route path="/tutor/students" element={<TutorStudents />} />
        <Route path="/tutor/students/:id" element={<StudentDetail />} />
        <Route path="/tutor/assignments" element={<TutorAssignments />} />
        <Route path="/tutor/assignments/new" element={<CreateAssignment />} />
        <Route path="/tutor/analytics" element={<TutorAnalytics />} />
        <Route path="/tutor/invites" element={<TutorInvites />} />
      </Route>

      {/* Student routes */}
      <Route
        element={
          <AuthGuard requiredRole="student">
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/assignments" element={<StudentAssignments />} />
        <Route path="/student/test/:id" element={<TestPage />} />
        <Route path="/student/results/:id" element={<ResultsPage />} />
        <Route path="/student/adaptive" element={<AdaptivePracticePage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
