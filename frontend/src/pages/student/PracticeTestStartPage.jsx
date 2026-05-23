/**
 * Practice Test Start Page - Instructions and start button
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPracticeTest } from '../../services/practiceTestApi';

const PracticeTestStartPage = () => {
  const { testNumber } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    loadTest();
  }, [testNumber]);

  const loadTest = async () => {
    try {
      setLoading(true);
      const data = await getPracticeTest(testNumber);
      setTest(data);
      setError(null);
    } catch (err) {
      console.error('Error loading test:', err);
      setError('Failed to load practice test');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (!acknowledged) {
      alert('Please read and acknowledge the testing conditions before starting.');
      return;
    }
    navigate(`/student/practice-tests/take/${testNumber}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading practice test...</p>
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

  if (!test) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {test.test_name}
          </h1>
          {test.description && (
            <p className="text-gray-600 mb-4">{test.description}</p>
          )}
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <span>98 Questions</span>
            <span>•</span>
            <span>2 hours 14 minutes</span>
            <span>•</span>
            <span>Adaptive Testing</span>
          </div>
        </div>

        {/* Test Structure */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Test Structure</h2>
          <div className="space-y-4">
            {/* Reading & Writing */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-2">Reading and Writing Section</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>Module 1 (Standard)</span>
                  <span className="font-medium">27 questions • 32 minutes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>10-Minute Break</span>
                  <span className="text-gray-500">(Skippable)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Module 2 (Adaptive)</span>
                  <span className="font-medium">27 questions • 32 minutes</span>
                </div>
              </div>
            </div>

            {/* Math */}
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-2">Math Section</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>10-Minute Break</span>
                  <span className="text-gray-500">(Skippable)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Module 1 (Standard)</span>
                  <span className="font-medium">22 questions • 35 minutes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>10-Minute Break</span>
                  <span className="text-gray-500">(Skippable)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Module 2 (Adaptive)</span>
                  <span className="font-medium">22 questions • 35 minutes</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Important Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-blue-900 mb-3">Important Information</h2>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>Adaptive Testing:</strong> Your performance on Module 1 determines the difficulty of Module 2 in each section</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>Timed Modules:</strong> Each module has a strict time limit. When time expires, the module submits automatically</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>No Going Back:</strong> Once you submit a module, you cannot return to it</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span><strong>Breaks:</strong> 10-minute breaks between sections are skippable if you want to continue</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span><strong>Scoring:</strong> You'll receive scaled scores (200-800 per section) just like the real SAT</span>
            </li>
          </ul>
        </div>

        {/* Testing Conditions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Testing Conditions</h2>
          <ul className="space-y-2 text-sm text-gray-700 mb-4">
            <li className="flex items-start">
              <span className="font-semibold mr-2">✓</span>
              <span>Find a quiet, distraction-free environment</span>
            </li>
            <li className="flex items-start">
              <span className="font-semibold mr-2">✓</span>
              <span>Have scratch paper and a calculator ready (for Math section)</span>
            </li>
            <li className="flex items-start">
              <span className="font-semibold mr-2">✓</span>
              <span>Ensure you have 2+ hours of uninterrupted time</span>
            </li>
            <li className="flex items-start">
              <span className="font-semibold mr-2">✓</span>
              <span>Close all other applications and browser tabs</span>
            </li>
            <li className="flex items-start">
              <span className="font-semibold mr-2">✗</span>
              <span>No phones, notes, or outside help during the test</span>
            </li>
            <li className="flex items-start">
              <span className="font-semibold mr-2">✗</span>
              <span>No looking up answers or using AI tools</span>
            </li>
          </ul>

          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              I acknowledge that I will take this test under proper testing conditions and treat it like the real SAT.
            </span>
          </label>
        </div>

        {/* Start Button */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleStart}
            disabled={!acknowledged}
            className="flex-1 py-4 px-6 rounded-lg font-bold text-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Practice Test
          </button>
          <button
            onClick={() => navigate('/student/practice-tests')}
            className="py-4 px-6 rounded-lg font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PracticeTestStartPage;
