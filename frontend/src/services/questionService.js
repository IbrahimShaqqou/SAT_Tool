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
};

export default questionService;
