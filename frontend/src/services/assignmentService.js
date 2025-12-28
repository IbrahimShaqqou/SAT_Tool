/**
 * Assignments API Service
 */
import api from './api';

export const assignmentService = {
  // List assignments (role-based)
  getAssignments: (params = {}) =>
    api.get('/assignments', { params }),

  // Get single assignment
  getAssignment: (id) =>
    api.get(`/assignments/${id}`),

  // Create assignment (tutor only)
  createAssignment: (data) =>
    api.post('/assignments', data),

  // Update assignment (tutor only)
  updateAssignment: (id, data) =>
    api.patch(`/assignments/${id}`, data),

  // Delete assignment (tutor only)
  deleteAssignment: (id) =>
    api.delete(`/assignments/${id}`),

  // Student actions
  startAssignment: (id) =>
    api.post(`/assignments/${id}/start`),

  // Get all questions for an assignment (for test interface)
  getAssignmentQuestions: (id) =>
    api.get(`/assignments/${id}/questions`),

  submitAnswer: (id, data) =>
    api.post(`/assignments/${id}/answer`, data),

  completeAssignment: (id) =>
    api.post(`/assignments/${id}/submit`),
};

export default assignmentService;
