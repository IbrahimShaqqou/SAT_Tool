/**
 * Questions API Service
 */
import api from './api';

export const questionService = {
  // Get questions with filters (brief by default)
  getQuestions: (params = {}) =>
    api.get('/questions', { params }),

  // Get questions with full details (choices, explanations, correct answers)
  getQuestionsWithDetails: (params = {}) =>
    api.get('/questions', { params: { ...params, full: true } }),

  // Get single question
  getQuestion: (id) =>
    api.get(`/questions/${id}`),

  // Get random questions
  getRandomQuestions: (params = {}) =>
    api.get('/questions/random', { params }),

  // Check an answer for a question (used by Question Bank practice)
  checkAnswer: (id, answer) =>
    api.post(`/questions/${id}/check`, { answer }),

  // Get step-by-step explanation for a question
  getExplanation: (id) =>
    api.get(`/questions/${id}/explanation`),

  // ----- Question Bank (authenticated, study-oriented) -----
  // Filterable browse with per-student status + bookmark flags.
  bankBrowse: (params = {}) =>
    api.get('/questions/bank/browse', { params }),

  // Record a logged-in attempt (persists) + return result + explanation.
  recordAttempt: (id, answer) =>
    api.post(`/questions/${id}/attempt`, { answer }),

  // Bookmarks
  listBookmarks: () => api.get('/questions/bank/bookmarks'),
  addBookmark: (id) => api.post(`/questions/${id}/bookmark`),
  removeBookmark: (id) => api.delete(`/questions/${id}/bookmark`),

  // Progress strip stats
  myBankStats: () => api.get('/questions/bank/my-stats'),
};

export default questionService;
