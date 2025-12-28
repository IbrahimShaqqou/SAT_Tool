/**
 * Questions API Service
 */
import api from './api';

export const questionService = {
  // Get questions with filters
  getQuestions: (params = {}) =>
    api.get('/questions', { params }),

  // Get single question
  getQuestion: (id) =>
    api.get(`/questions/${id}`),

  // Get random questions
  getRandomQuestions: (params = {}) =>
    api.get('/questions/random', { params }),
};

export default questionService;
