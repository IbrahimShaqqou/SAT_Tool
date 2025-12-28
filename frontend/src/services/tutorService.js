/**
 * Tutor Dashboard API Service
 */
import api from './api';

export const tutorService = {
  // Students
  getStudents: (params = {}) =>
    api.get('/tutor/students', { params }),

  addStudent: (studentEmail) =>
    api.post('/tutor/students', { student_email: studentEmail }),

  removeStudent: (studentId) =>
    api.delete(`/tutor/students/${studentId}`),

  getStudent: (studentId) =>
    api.get(`/tutor/students/${studentId}`),

  getStudentProgress: (studentId) =>
    api.get(`/tutor/students/${studentId}/progress`),

  getStudentSessions: (studentId, params = {}) =>
    api.get(`/tutor/students/${studentId}/sessions`, { params }),

  getStudentResponses: (studentId, params = {}) =>
    api.get(`/tutor/students/${studentId}/responses`, { params }),

  getStudentWeaknesses: (studentId) =>
    api.get(`/tutor/students/${studentId}/weaknesses`),

  // Analytics
  getAnalytics: () =>
    api.get('/tutor/analytics'),

  // Charts
  getChartData: (params = {}) =>
    api.get('/tutor/charts', { params }),

  getStudentChartData: (studentId, params = {}) =>
    api.get(`/tutor/students/${studentId}/charts`, { params }),
};

export default tutorService;
