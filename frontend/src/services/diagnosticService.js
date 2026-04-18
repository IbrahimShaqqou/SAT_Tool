/**
 * Diagnostic Assessment API Service
 */
import api from './api';

const diagnosticService = {
  // Start a new self-serve diagnostic (or resume existing)
  start: () =>
    api.post('/diagnostic/start'),

  // Get results for a completed diagnostic session
  getResults: (sessionId) =>
    api.get(`/diagnostic/${sessionId}/results`),
};

export default diagnosticService;
