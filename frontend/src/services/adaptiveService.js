/**
 * Adaptive Testing API Service
 */
import api from './api';

export const adaptiveService = {
  // Ability Profile
  getAbilityProfile: () => api.get('/adaptive/ability-profile'),

  getSkillAbility: (skillId) => api.get(`/adaptive/skill-ability/${skillId}`),

  // Adaptive Question Selection
  getNextQuestion: (data) => api.post('/adaptive/next-question', data),

  // Adaptive Sessions
  createSession: (data) => api.post('/adaptive/sessions', data),

  startSession: (sessionId) => api.post(`/adaptive/sessions/${sessionId}/start`),

  getSession: (sessionId) => api.get(`/adaptive/sessions/${sessionId}`),

  submitAnswer: (sessionId, data) =>
    api.post(`/adaptive/sessions/${sessionId}/answer`, data),

  completeSession: (sessionId) =>
    api.post(`/adaptive/sessions/${sessionId}/complete`),

  // Calibration (admin/tutor)
  getCalibrationStats: () => api.get('/adaptive/calibration/stats'),

  runCalibration: () => api.post('/adaptive/calibration/initialize'),
};

export default adaptiveService;
