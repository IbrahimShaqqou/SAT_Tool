/**
 * Lesson Service
 * API calls for skill lessons
 */

import api from './api';

const lessonService = {
  // ==========================================================================
  // PUBLIC ENDPOINTS (no auth required)
  // ==========================================================================

  /**
   * Get all math lessons grouped by domain (public, no completion tracking)
   */
  getPublicMathLessons: () => api.get('/lessons/public/math'),

  /**
   * Get all reading/writing lessons grouped by domain (public, no completion tracking)
   */
  getPublicReadingLessons: () => api.get('/lessons/public/reading'),

  /**
   * Get lesson by lesson ID (public, no completion tracking)
   * @param {string} lessonId - The lesson UUID
   */
  getPublicLesson: (lessonId) => api.get(`/lessons/public/${lessonId}`),

  // ==========================================================================
  // AUTHENTICATED ENDPOINTS (require login, track completion)
  // ==========================================================================

  /**
   * Get all math lessons grouped by domain (with completion tracking)
   */
  getMathLessons: () => api.get('/lessons/math'),

  /**
   * Get all reading/writing lessons grouped by domain (with completion tracking)
   */
  getReadingLessons: () => api.get('/lessons/reading'),

  /**
   * Get lesson by skill ID
   * @param {number} skillId - The skill ID
   */
  getLessonBySkill: (skillId) => api.get(`/lessons/skill/${skillId}`),

  /**
   * Get lesson by lesson ID (with completion tracking)
   * @param {string} lessonId - The lesson UUID
   */
  getLesson: (lessonId) => api.get(`/lessons/${lessonId}`),

  /**
   * Mark lesson as completed
   * @param {string} lessonId - The lesson UUID
   * @param {object} data - Completion data (time_spent_seconds, progress_percent)
   */
  markComplete: (lessonId, data = {}) => api.post(`/lessons/${lessonId}/complete`, {
    time_spent_seconds: data.timeSpentSeconds || 0,
    progress_percent: data.progressPercent || 100,
  }),

  /**
   * Create a new lesson (tutor only)
   * @param {object} data - Lesson data
   */
  createLesson: (data) => api.post('/lessons/', data),

  /**
   * Update a lesson (tutor only)
   * @param {string} lessonId - The lesson UUID
   * @param {object} data - Updated lesson data
   */
  updateLesson: (lessonId, data) => api.patch(`/lessons/${lessonId}`, data),
};

export default lessonService;
