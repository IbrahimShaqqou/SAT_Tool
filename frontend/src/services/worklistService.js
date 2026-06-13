/**
 * Worklist API service (score-raising loop).
 * Student: live worklist, start/submit mastery & baseline checks.
 * Tutor: view/edit a student's worklist + cross-student overview.
 */
import api from './api';

export const worklistService = {
  // Student
  getMyWorklist: () => api.get('/worklist'),
  startCheck: (itemId, kind = 'mastery') =>
    api.post(`/worklist/items/${itemId}/check`, null, { params: { kind } }),
  submitCheck: (checkId, answers) =>
    api.post(`/worklist/checks/${checkId}/submit`, { answers }),

  // Tutor
  getStudentWorklist: (studentId) =>
    api.get(`/tutor/students/${studentId}/worklist`),
  addStudentItem: (studentId, skillId) =>
    api.post(`/tutor/students/${studentId}/worklist/items`, { skill_id: skillId }),
  patchItem: (itemId, patch) =>
    api.patch(`/tutor/worklist/items/${itemId}`, patch),
  deleteItem: (itemId) =>
    api.delete(`/tutor/worklist/items/${itemId}`),
  overview: () => api.get('/tutor/worklist/overview'),
};

export default worklistService;
