/**
 * Practice Test API Service
 *
 * Handles all API calls related to official College Board practice tests.
 */

import api from './api';

/**
 * Get list of available practice tests
 */
export const listPracticeTests = async () => {
  const response = await api.get('/practice-tests/');
  return response.data;
};

/**
 * Get detailed information about a specific practice test
 */
export const getPracticeTest = async (testNumber) => {
  const response = await api.get(`/practice-tests/${testNumber}`);
  return response.data;
};

/**
 * Start a new practice test session
 */
export const startPracticeTest = async (testNumber) => {
  const response = await api.post(`/practice-tests/${testNumber}/start`);
  return response.data;
};

/**
 * Get the current module for a test session
 */
export const getCurrentModule = async (sessionId) => {
  const response = await api.get(`/practice-tests/sessions/${sessionId}/module`);
  return response.data;
};

/**
 * Submit a completed module
 */
export const submitModule = async (sessionId, responses, timeSpentSeconds) => {
  const response = await api.post(`/practice-tests/sessions/${sessionId}/submit-module`, {
    responses,
    time_spent_seconds: timeSpentSeconds
  });
  return response.data;
};

/**
 * Get complete test results with SAT scoring
 */
export const getTestResults = async (sessionId) => {
  const response = await api.get(`/practice-tests/sessions/${sessionId}/results`);
  return response.data;
};

export default {
  listPracticeTests,
  getPracticeTest,
  startPracticeTest,
  getCurrentModule,
  submitModule,
  getTestResults
};
