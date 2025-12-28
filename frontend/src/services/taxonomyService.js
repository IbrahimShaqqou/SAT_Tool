/**
 * Taxonomy API Service (Domains & Skills)
 */
import api from './api';

export const taxonomyService = {
  // Get all domains
  getDomains: (params = {}) =>
    api.get('/domains', { params }),

  // Get domain by ID
  getDomain: (id) =>
    api.get(`/domains/${id}`),

  // Get skills (optionally filtered by domain)
  getSkills: (params = {}) =>
    api.get('/skills', { params }),

  // Get skill by ID
  getSkill: (id) =>
    api.get(`/skills/${id}`),
};

export default taxonomyService;
