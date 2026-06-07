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

/**
 * Import a captured MyPractice bundle (from the Bluebook Importer extension or
 * a downloaded zooprep-bluebook.json file). Pass dryRun=true to validate only.
 */
export const importBundle = async (bundle, { dryRun = false } = {}) => {
  const response = await api.post(
    `/practice-tests/import${dryRun ? '?dry_run=true' : ''}`,
    bundle,
    // A full bundle can be a few hundred questions of HTML written to a remote
    // DB; allow well past the default 30s client timeout.
    { timeout: 120000 },
  );
  return response.data;
};

/**
 * List the current student's completed practice-test results (incl. official
 * Bluebook imports), newest first.
 */
export const listMyResults = async () => {
  const response = await api.get('/practice-tests/my-results');
  return response.data;
};

/**
 * Question-by-question review + per-skill breakdown for a completed session.
 */
export const getTestReview = async (sessionId) => {
  const response = await api.get(`/practice-tests/sessions/${sessionId}/review`);
  return response.data;
};

/**
 * The import-driven study plan for a completed session (focus skills, next test,
 * deltas). Viewable by the student or their tutor.
 */
export const getStudyPlan = async (sessionId) => {
  const response = await api.get(`/practice-tests/sessions/${sessionId}/plan`);
  return response.data;
};

const practiceTestApi = {
  listPracticeTests,
  getPracticeTest,
  startPracticeTest,
  getCurrentModule,
  submitModule,
  getTestResults,
  importBundle,
  listMyResults,
  getTestReview,
  getStudyPlan
};

export default practiceTestApi;
