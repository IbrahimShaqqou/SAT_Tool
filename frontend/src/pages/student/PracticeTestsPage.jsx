/**
 * Practice Tests Page - List of available official SAT practice tests
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPracticeTests } from '../../services/practiceTestApi';

const PracticeTestsPage = () => {
  const navigate = useNavigate();
  const [practiceTests, setPracticeTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPracticeTests();
  }, []);

  const loadPracticeTests = async () => {
    try {
      setLoading(true);
      const tests = await listPracticeTests();
      setPracticeTests(tests);
      setError(null);
    } catch (err) {
      console.error('Error loading practice tests:', err);
      setError('Failed to load practice tests');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = (testNumber) => {
    navigate(`/student/practice-tests/${testNumber}/start`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading practice tests...</p>
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
            onClick={loadPracticeTests}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Official SAT Practice Tests
        </h1>
        <p className="text-gray-600">
          Take full-length official College Board practice tests with adaptive Module 2 sections.
          Each test takes approximately 2 hours and 14 minutes.
        </p>
      </div>

      {/* Test Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">About These Tests</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Complete SAT simulation with 98 questions (54 Reading/Writing, 44 Math)</li>
          <li>• Adaptive testing: Module 2 difficulty adjusts based on Module 1 performance</li>
          <li>• Timed modules matching the real digital SAT</li>
          <li>• Instant scoring with section scores (200-800) and total score (400-1600)</li>
        </ul>
      </div>

      {/* Practice Tests Grid */}
      {practiceTests.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No practice tests available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {practiceTests.map((test) => (
            <div
              key={test.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {test.test_name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {test.total_questions} questions · {test.estimated_time_minutes} minutes
                  </p>
                </div>
                {test.is_active && (
                  <span className="px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded">
                    Available
                  </span>
                )}
              </div>

              {test.description && (
                <p className="text-gray-700 text-sm mb-4">
                  {test.description}
                </p>
              )}

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Reading & Writing: 54 questions (2 modules)
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Math: 44 questions (2 modules)
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  2 hours 14 minutes (timed)
                </div>
              </div>

              <button
                onClick={() => handleStartTest(test.test_number)}
                disabled={!test.is_active}
                className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                  test.is_active
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {test.is_active ? 'Start Practice Test' : 'Coming Soon'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tips Section */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Before You Start</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start">
            <span className="font-semibold mr-2">1.</span>
            <span>Find a quiet place with no distractions</span>
          </li>
          <li className="flex items-start">
            <span className="font-semibold mr-2">2.</span>
            <span>Have scratch paper and a calculator ready for the Math section</span>
          </li>
          <li className="flex items-start">
            <span className="font-semibold mr-2">3.</span>
            <span>Plan for 2+ hours of uninterrupted time</span>
          </li>
          <li className="flex items-start">
            <span className="font-semibold mr-2">4.</span>
            <span>Take breaks between sections (10 minutes each, skippable)</span>
          </li>
          <li className="flex items-start">
            <span className="font-semibold mr-2">5.</span>
            <span>Treat this like the real SAT - no phones, no looking up answers</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default PracticeTestsPage;
