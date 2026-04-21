/**
 * Diagnostic Assessment API Service
 */
import api from './api';

const diagnosticService = {
  // Start a new self-serve diagnostic (or resume existing)
  // sections: ['math'], ['reading_writing'], or ['math', 'reading_writing']
  start: (sections = ['math', 'reading_writing']) =>
    api.post('/diagnostic/start', { sections }),

  // Get results for a completed diagnostic session
  getResults: (sessionId) =>
    api.get(`/diagnostic/${sessionId}/results`),
};

export default diagnosticService;
