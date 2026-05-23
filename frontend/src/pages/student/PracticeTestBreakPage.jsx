/**
 * Practice Test Break Page - 10-minute break between sections (skippable)
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getCurrentModule } from '../../services/practiceTestApi';

const PracticeTestBreakPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds
  const [loading, setLoading] = useState(false);

  const { currentModule, nextModule, modulePath, message } = location.state || {};

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) {
      handleContinue();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleContinue = async () => {
    if (loading) return;

    try {
      setLoading(true);
      // Verify module is ready
      await getCurrentModule(sessionId);
      navigate(`/student/practice-tests/take/${sessionId}`);
    } catch (err) {
      console.error('Error loading next module:', err);
      alert('Failed to load next module. Please try again.');
      setLoading(false);
    }
  };

  const getSectionName = (moduleNum) => {
    if (moduleNum === 1 || moduleNum === 2) {
      return 'Reading and Writing';
    } else {
      return 'Math';
    }
  };

  const getNextSectionName = () => {
    return getSectionName(nextModule);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Completion Message */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {getSectionName(currentModule)} Section Complete!
            </h2>
            <p className="text-gray-600">
              {message || 'Great work! Take a short break before continuing.'}
            </p>
          </div>

          {/* Adaptive Path Notification */}
          {modulePath && (
            <div className={`p-4 rounded-lg mb-6 ${
              modulePath === 'harder'
                ? 'bg-blue-50 border border-blue-200'
                : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-start">
                <svg className={`w-5 h-5 mr-2 mt-0.5 ${
                  modulePath === 'harder' ? 'text-blue-600' : 'text-gray-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <div>
                  <p className={`font-semibold ${
                    modulePath === 'harder' ? 'text-blue-900' : 'text-gray-900'
                  }`}>
                    {modulePath === 'harder' ? 'Advanced Module Selected' : 'Standard Module Selected'}
                  </p>
                  <p className={`text-sm ${
                    modulePath === 'harder' ? 'text-blue-700' : 'text-gray-700'
                  }`}>
                    {modulePath === 'harder'
                      ? 'Based on your strong performance in Module 1, you\'ll take the harder Module 2.'
                      : 'You\'ll continue with Module 2.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Break Timer */}
          <div className="text-center p-6 bg-gray-50 rounded-lg mb-6">
            <p className="text-sm text-gray-600 mb-2">Break Time Remaining</p>
            <div className="text-5xl font-bold text-gray-900 font-mono mb-2">
              {formatTime(timeRemaining)}
            </div>
            <p className="text-sm text-gray-500">10-minute break (skippable)</p>
          </div>

          {/* Next Section Info */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-indigo-900 mb-2">Up Next:</h3>
            <p className="text-indigo-800">
              {getNextSectionName()} Section • Module {nextModule % 2 === 0 ? 2 : 1}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleContinue}
              disabled={loading}
              className="w-full py-3 px-6 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Continue to Next Section'}
            </button>
            <p className="text-center text-sm text-gray-500">
              Or wait for the timer to complete automatically
            </p>
          </div>
        </div>

        {/* Break Tips */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Break Recommendations</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <svg className="w-4 h-4 mr-2 mt-0.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Stretch and move around</span>
            </li>
            <li className="flex items-start">
              <svg className="w-4 h-4 mr-2 mt-0.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Have a snack or drink water</span>
            </li>
            <li className="flex items-start">
              <svg className="w-4 h-4 mr-2 mt-0.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Use the restroom</span>
            </li>
            <li className="flex items-start">
              <svg className="w-4 h-4 mr-2 mt-0.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Take a few deep breaths</span>
            </li>
            <li className="flex items-start">
              <svg className="w-4 h-4 mr-2 mt-0.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>Don't review notes or study materials</span>
            </li>
            <li className="flex items-start">
              <svg className="w-4 h-4 mr-2 mt-0.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>Don't use your phone or computer (except to continue)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PracticeTestBreakPage;
