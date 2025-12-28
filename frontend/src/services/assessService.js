/**
 * Public Assessment API Service
 * For students taking assessments via invite links
 * No authentication required
 */
import api from './api';

export const assessService = {
  // Get assessment configuration (before starting)
  getConfig: (token) =>
    api.get(`/assess/${token}`),

  // Start the assessment
  start: (token, data = {}) =>
    api.post(`/assess/${token}/start`, data),

  // Get all questions for the assessment
  getQuestions: (token) =>
    api.get(`/assess/${token}/questions`),

  // Submit an answer
  submitAnswer: (token, data) =>
    api.post(`/assess/${token}/answer`, data),

  // Submit the entire assessment
  submit: (token) =>
    api.post(`/assess/${token}/submit`),
};

export default assessService;
