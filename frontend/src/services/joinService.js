/**
 * Roster join-link API service.
 * - getJoinLink: tutor fetches their reusable share link.
 * - getJoinInfo: public lookup of the tutor name behind a code.
 * - join: attach the signed-in student to the tutor who owns the code.
 */
import api from './api';

export const joinService = {
  getJoinLink: () => api.get('/tutor/join-link'),
  getJoinInfo: (code) => api.get(`/join/${code}`),
  join: (code) => api.post(`/join/${code}`),
};

export default joinService;
