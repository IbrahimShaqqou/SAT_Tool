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

  // Get in-progress assessments (from invite links)
  getInProgressAssessments: () =>
    api.get('/progress/in-progress'),

  // Get student's skill abilities
  getSkills: () =>
    api.get('/progress/skills'),
};

export default progressService;
