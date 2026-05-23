/**
 * Student Response API Service
 */
import api from './api';

export const responseService = {
  // Submit a response for a test session
  submitResponse: (data) =>
    api.post('/responses', data),

  // Get responses for a test session
  getSessionResponses: (testSessionId) =>
    api.get('/responses', { params: { test_session_id: testSessionId } }),

  // Get response for a specific question
  getQuestionResponse: (testSessionId, questionId) =>
    api.get(`/responses/${testSessionId}/${questionId}`),
};

export default responseService;
