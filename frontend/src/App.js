/**
 * SAT Tutoring Platform - Main App Component
 * Root component with routing configuration
 */
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';

// Layouts
import { AppLayout, PublicLayout, AuthGuard } from './components/layout';

// Auth Pages
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from './pages/auth';

// Landing Page
import LandingPage from './pages/LandingPage';

// Public Pages (no auth required)
import { PublicQuestionBankPage, PublicLessonsPage, PublicLessonViewerPage } from './pages/public';

// Tutor Pages
import TutorDashboard from './pages/tutor/DashboardPage';
import TutorStudents from './pages/tutor/StudentsPage';
import StudentDetail from './pages/tutor/StudentDetailPage';
import TutorAssignments from './pages/tutor/AssignmentsPage';
import CreateAssignment from './pages/tutor/CreateAssignmentPage';
import TutorAnalytics from './pages/tutor/AnalyticsPage';
import TutorInvites from './pages/tutor/InvitesPage';
import QuestionBankPage from './pages/tutor/QuestionBankPage';
import StudentResultsPage from './pages/tutor/StudentResultsPage';
import TutorIntakeResultsPage from './pages/tutor/IntakeResultsPage';

// Student Pages
import StudentDashboard from './pages/student/DashboardPage';
import StudentAssignments from './pages/student/AssignmentsPage';
import TestPage from './pages/student/TestPage';
import ResultsPage from './pages/student/ResultsPage';
import AdaptivePracticePage from './pages/student/AdaptivePracticePage';
import StudentQuestionBankPage from './pages/student/QuestionBankPage';
import LessonsPage from './pages/student/LessonsPage';
import LessonViewerPage from './pages/student/LessonViewerPage';
import DiagnosticLandingPage from './pages/student/DiagnosticLandingPage';
import DiagnosticResultsPage from './pages/student/DiagnosticResultsPage';
import StudyPlanPage from './pages/student/StudyPlanPage';
import FullLengthTestPage from './pages/student/FullLengthTestPage';
import FullLengthResultsPage from './pages/student/FullLengthResultsPage';
import PracticeTestsPage from './pages/student/PracticeTestsPage';
import PracticeTestStartPage from './pages/student/PracticeTestStartPage';
import PracticeTestTakingPage from './pages/student/PracticeTestTakingPage';
import PracticeTestBreakPage from './pages/student/PracticeTestBreakPage';
import PracticeTestResultsPage from './pages/student/PracticeTestResultsPage';

// Public Assessment
import { AssessmentPage, IntakeResultsPage } from './pages/assess';

// Shared Pages
import ProfilePage from './pages/shared/ProfilePage';
import SettingsPage from './pages/shared/SettingsPage';
import ProgressPage from './pages/shared/ProgressPage';

function App() {
  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth routes */}
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Public routes (no auth required) */}
      <Route path="/questions" element={<PublicQuestionBankPage />} />
      <Route path="/lessons" element={<PublicLessonsPage />} />
      <Route path="/lessons/:lessonId" element={<PublicLessonViewerPage />} />

      {/* Public assessment (no auth required) */}
      <Route path="/assess/:token" element={<AssessmentPage />} />
      <Route path="/assess/:token/results" element={<IntakeResultsPage />} />

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
        <Route path="/tutor/students/:studentId/results/:sessionId" element={<StudentResultsPage />} />
        <Route path="/tutor/assignments" element={<TutorAssignments />} />
        <Route path="/tutor/assignments/new" element={<CreateAssignment />} />
        <Route path="/tutor/analytics" element={<TutorAnalytics />} />
        <Route path="/tutor/invites" element={<TutorInvites />} />
        <Route path="/tutor/invites/:inviteId/results" element={<TutorIntakeResultsPage />} />
        <Route path="/tutor/questions" element={<QuestionBankPage />} />
        <Route path="/tutor/lessons" element={<LessonsPage />} />
        <Route path="/tutor/lessons/:lessonId" element={<LessonViewerPage />} />
        <Route path="/tutor/profile" element={<ProfilePage />} />
        <Route path="/tutor/settings" element={<SettingsPage />} />
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
        <Route path="/student/questions" element={<StudentQuestionBankPage />} />
        <Route path="/student/test/:id" element={<TestPage />} />
        <Route path="/student/results/:id" element={<ResultsPage />} />
        <Route path="/student/adaptive" element={<AdaptivePracticePage />} />
        <Route path="/student/lessons" element={<LessonsPage />} />
        <Route path="/student/lessons/:lessonId" element={<LessonViewerPage />} />
        <Route path="/student/study-plan" element={<StudyPlanPage />} />
        <Route path="/student/diagnostic" element={<DiagnosticLandingPage />} />
        <Route path="/student/diagnostic/:sessionId/results" element={<DiagnosticResultsPage />} />
        <Route path="/student/full-length/:id" element={<FullLengthTestPage />} />
        <Route path="/student/full-length/:id/results" element={<FullLengthResultsPage />} />
        <Route path="/student/practice-tests" element={<PracticeTestsPage />} />
        <Route path="/student/practice-tests/:testNumber/start" element={<PracticeTestStartPage />} />
        <Route path="/student/practice-tests/results/:sessionId" element={<PracticeTestResultsPage />} />
        <Route path="/student/progress" element={<ProgressPage />} />
        <Route path="/student/profile" element={<ProfilePage />} />
        <Route path="/student/settings" element={<SettingsPage />} />
      </Route>

      {/* Distraction-free practice test routes (no sidebar / app layout) */}
      <Route
        element={
          <AuthGuard requiredRole="student">
            <Outlet />
          </AuthGuard>
        }
      >
        <Route path="/student/practice-tests/take/:testNumber" element={<PracticeTestTakingPage />} />
        <Route path="/student/practice-tests/break/:sessionId" element={<PracticeTestBreakPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
