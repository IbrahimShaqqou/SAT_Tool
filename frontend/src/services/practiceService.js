/**
 * Practice Sessions API Service
 */
import api from './api';

export const practiceService = {
  // Create a new practice session
  createSession: (data) =>
    api.post('/practice', data),

  // Get user's sessions
  getSessions: (params = {}) =>
    api.get('/practice', { params }),

  // Get session details
  getSession: (id) =>
    api.get(`/practice/${id}`),

  // Get current question in session
  getCurrentQuestion: (id) =>
    api.get(`/practice/${id}/question`),

  // Submit an answer
  submitAnswer: (id, data) =>
    api.post(`/practice/${id}/answer`, data),

  // Complete the session
  completeSession: (id) =>
    api.post(`/practice/${id}/complete`),

  // Get session results
  getResults: (id) =>
    api.get(`/practice/${id}/results`),
};

export default practiceService;
