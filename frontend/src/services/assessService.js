/**
 * Public Assessment API Service
 * For students taking assessments via invite links
 */
import api from './api';

export const assessService = {
  // Get assessment configuration (before starting)
  // Also returns resume info if there's an in-progress session
  getConfig: (token) =>
    api.get(`/assess/${token}`),

  // Start or resume the assessment
  start: (token, data = {}) =>
    api.post(`/assess/${token}/start`, data),

  // Get all questions for the assessment
  getQuestions: (token) =>
    api.get(`/assess/${token}/questions`),

  // Get answered questions (for resume)
  getAnswers: (token) =>
    api.get(`/assess/${token}/answers`),

  // Submit an answer
  submitAnswer: (token, data) =>
    api.post(`/assess/${token}/answer`, data),

  // Update session state (current position)
  updateState: (token, currentIndex) =>
    api.post(`/assess/${token}/state?current_index=${currentIndex}`),

  // Toggle flag on a question
  toggleFlag: (token, questionId) =>
    api.post(`/assess/${token}/flag/${questionId}`),

  // Submit the entire assessment
  submit: (token) =>
    api.post(`/assess/${token}/submit`),

  // Get detailed results (for intake assessments)
  getResults: (token) =>
    api.get(`/assess/${token}/results`),

  // Get question-by-question review for completed assessment
  getReview: (token) =>
    api.get(`/assess/${token}/review`),
};

export default assessService;
