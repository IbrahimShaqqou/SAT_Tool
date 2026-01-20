/**
 * Landing Page
 * Public landing page with feature preview and login prompt
 */
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  BookOpen,
  Brain,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  BarChart3
} from 'lucide-react';
import { Button } from '../components/ui';

const LandingPage = () => {
  const { user, isLoading } = useAuth();

  // If user is logged in, show quick links to their dashboard
  if (user && !isLoading) {
    const dashboardPath = user.role?.toLowerCase() === 'tutor' ? '/tutor' : '/student';
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Welcome back, {user.first_name || user.email}!
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Continue your SAT prep journey
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Link
              to={dashboardPath}
              className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-200 dark:border-gray-700"
            >
              <BarChart3 className="h-10 w-10 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Go to Dashboard
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                View your progress and continue where you left off
              </p>
            </Link>

            <Link
              to="/questions"
              className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-200 dark:border-gray-700"
            >
              <BookOpen className="h-10 w-10 text-green-600 dark:text-green-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Question Bank
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Browse and practice SAT questions by topic
              </p>
            </Link>

            <Link
              to="/lessons"
              className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-200 dark:border-gray-700"
            >
              <GraduationCap className="h-10 w-10 text-purple-600 dark:text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Skill Lessons
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Learn concepts with interactive lessons
              </p>
            </Link>

            {user.role?.toLowerCase() === 'student' && (
              <Link
                to="/student/adaptive"
                className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-200 dark:border-gray-700"
              >
                <Brain className="h-10 w-10 text-indigo-600 dark:text-indigo-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Adaptive Practice
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Practice questions tailored to your level
                </p>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Public landing page for non-logged in users
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ZooPrep</h1>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="secondary">Log In</Button>
            </Link>
            <Link to="/register">
              <Button variant="primary">Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Master the SAT with
            <span className="text-blue-600 dark:text-blue-400"> Adaptive Learning</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
            Personalized practice, expert lessons, and real-time progress tracking
            to help you achieve your best SAT score.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/register">
              <Button variant="primary" className="px-8 py-3 text-lg">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/questions">
              <Button variant="secondary" className="px-8 py-3 text-lg">
                Browse Questions
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-6">
              <BookOpen className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Comprehensive Question Bank
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Access thousands of SAT-style questions organized by topic and difficulty.
              Practice anytime, anywhere.
            </p>
            <Link
              to="/questions"
              className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1 hover:underline"
            >
              Explore Questions <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-6">
              <GraduationCap className="h-7 w-7 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Interactive Skill Lessons
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Learn key concepts with engaging lessons featuring worked examples,
              visual explanations, and practice problems.
            </p>
            <Link
              to="/lessons"
              className="text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1 hover:underline"
            >
              View Lessons <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-6">
              <Brain className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Adaptive Practice
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Our smart algorithm adjusts to your skill level, giving you the right
              questions to maximize your improvement.
            </p>
            <Link
              to="/login"
              className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 hover:underline"
            >
              Sign Up to Access <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Why ZooPrep */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 md:p-12 shadow-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">
            Why Students Love ZooPrep
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              'Real SAT-style questions with detailed explanations',
              'Built-in Desmos calculator for math practice',
              'Progress tracking to see your improvement',
              'Lessons designed by SAT experts',
              'Practice by skill or take full-length tests',
              'Works on any device - phone, tablet, or computer',
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 dark:text-gray-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Ready to boost your SAT score?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Join thousands of students preparing smarter with ZooPrep.
          </p>
          <Link to="/register">
            <Button variant="primary" className="px-8 py-3 text-lg">
              Start Practicing Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500 dark:text-gray-400">
          <p>&copy; {new Date().getFullYear()} ZooPrep. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
