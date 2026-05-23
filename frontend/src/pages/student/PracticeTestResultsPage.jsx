/**
 * Practice Test Results Page - Detailed SAT score report
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTestResults } from '../../services/practiceTestApi';

const PracticeTestResultsPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const loadResults = async () => {
    try {
      setLoading(true);
      const data = await getTestResults(sessionId);
      setResults(data);
      setError(null);
    } catch (err) {
      console.error('Error loading results:', err);
      setError('Failed to load test results');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 700) return 'text-green-600';
    if (score >= 600) return 'text-blue-600';
    if (score >= 500) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getPerformanceLevel = (percentage) => {
    if (percentage >= 90) return { level: 'Excellent', color: 'text-green-600' };
    if (percentage >= 80) return { level: 'Very Good', color: 'text-blue-600' };
    if (percentage >= 70) return { level: 'Good', color: 'text-yellow-600' };
    if (percentage >= 60) return { level: 'Fair', color: 'text-orange-600' };
    return { level: 'Needs Improvement', color: 'text-red-600' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => navigate('/student/practice-tests')}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Back to Practice Tests
          </button>
        </div>
      </div>
    );
  }

  if (!results) return null;

  const mathPerf = getPerformanceLevel(results.math.percentage);
  const rwPerf = getPerformanceLevel(results.reading_writing.percentage);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {results.test_name} Results
          </h1>
          <p className="text-gray-600">
            Completed on {new Date(results.completed_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>

        {/* Total Score Card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg shadow-lg p-8 mb-6 text-white">
          <div className="text-center">
            <p className="text-blue-200 text-sm font-semibold uppercase tracking-wide mb-2">
              Total SAT Score
            </p>
            <div className="text-7xl font-bold mb-2">
              {results.total_score}
            </div>
            <p className="text-xl text-blue-100">
              out of 1600
            </p>
            <div className="mt-4 pt-4 border-t border-blue-400">
              <p className="text-blue-100">
                <span className="font-semibold">{results.percentile}th percentile</span> —
                You scored higher than {results.percentile}% of test takers
              </p>
            </div>
          </div>
        </div>

        {/* Section Scores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Math Score */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Math</h2>
              <span className={`text-3xl font-bold ${getScoreColor(results.math.score)}`}>
                {results.math.score}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Accuracy</span>
                  <span className="font-semibold text-gray-900">
                    {results.math.correct}/{results.math.total} ({results.math.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${results.math.percentage}%` }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Performance by Module</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Module 1:</span>
                    <span className="font-medium">
                      {results.math.module_1_correct}/{results.math.module_1_total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      Module 2 ({results.math.module_2_path}):
                    </span>
                    <span className="font-medium">
                      {results.math.module_2_correct}/{results.math.module_2_total}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <span className={`text-sm font-semibold ${mathPerf.color}`}>
                  {mathPerf.level}
                </span>
              </div>
            </div>
          </div>

          {/* Reading & Writing Score */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Reading & Writing</h2>
              <span className={`text-3xl font-bold ${getScoreColor(results.reading_writing.score)}`}>
                {results.reading_writing.score}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Accuracy</span>
                  <span className="font-semibold text-gray-900">
                    {results.reading_writing.correct}/{results.reading_writing.total} ({results.reading_writing.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${results.reading_writing.percentage}%` }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Performance by Module</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Module 1:</span>
                    <span className="font-medium">
                      {results.reading_writing.module_1_correct}/{results.reading_writing.module_1_total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      Module 2 ({results.reading_writing.module_2_path}):
                    </span>
                    <span className="font-medium">
                      {results.reading_writing.module_2_correct}/{results.reading_writing.module_2_total}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <span className={`text-sm font-semibold ${rwPerf.color}`}>
                  {rwPerf.level}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Score Distribution Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-4">Understanding Your Score</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">SAT Score Range</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• <span className="font-medium">1400-1600:</span> Excellent (Top 10%)</li>
                <li>• <span className="font-medium">1200-1390:</span> Good (Top 25%)</li>
                <li>• <span className="font-medium">1000-1190:</span> Average (50th percentile)</li>
                <li>• <span className="font-medium">800-990:</span> Below Average</li>
                <li>• <span className="font-medium">400-790:</span> Needs Significant Improvement</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Adaptive Testing</h4>
              <p className="text-sm text-gray-600 mb-2">
                This test used 2-stage adaptive testing, just like the real digital SAT:
              </p>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Module 1 determines your Module 2 difficulty</li>
                <li>• <span className="font-medium">Harder Module 2:</span> Higher score potential (up to 800)</li>
                <li>• <span className="font-medium">Easier Module 2:</span> Lower ceiling (~680)</li>
                <li>• You took the <span className="font-medium">{results.math.module_2_path}</span> Math Module 2</li>
                <li>• You took the <span className="font-medium">{results.reading_writing.module_2_path}</span> R&W Module 2</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-bold text-blue-900 mb-3">Recommended Next Steps</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              <span>Review your incorrect answers to identify patterns and weak areas</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              <span>Practice targeted skills where you scored below 70%</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              <span>Take another practice test in 1-2 weeks to track improvement</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              <span>Work with your tutor on test-taking strategies and time management</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => navigate('/student/practice-tests')}
            className="flex-1 py-3 px-6 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Take Another Practice Test
          </button>
          <button
            onClick={() => navigate('/student/dashboard')}
            className="flex-1 py-3 px-6 rounded-lg font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default PracticeTestResultsPage;
