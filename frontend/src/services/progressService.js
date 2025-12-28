/**
 * Student Progress API Service
 */
import api from './api';

export const progressService = {
  // Get progress summary
  getSummary: () =>
    api.get('/progress/summary'),

  // Get response history
  getHistory: (params = {}) =>
    api.get('/progress/history', { params }),
};

export default progressService;
