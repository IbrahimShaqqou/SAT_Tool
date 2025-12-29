/**
 * Invite Link API Service
 * Tutor-facing invite management
 */
import api from './api';

export const inviteService = {
  // Create a new invite link
  create: (data) =>
    api.post('/tutor/invites', data),

  // List all invites
  list: (params = {}) =>
    api.get('/tutor/invites', { params }),

  // Get invite details
  get: (inviteId) =>
    api.get(`/tutor/invites/${inviteId}`),

  // Get detailed assessment results for an invite
  getResults: (inviteId) =>
    api.get(`/tutor/invites/${inviteId}/results`),

  // Revoke an invite
  revoke: (inviteId) =>
    api.delete(`/tutor/invites/${inviteId}`),
};

export default inviteService;
