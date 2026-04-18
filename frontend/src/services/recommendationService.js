/**
 * Recommendations API Service
 */
import api from './api';

const recommendationService = {
  // Get personalized daily study plan
  getStudyPlan: () =>
    api.get('/recommendations/study-plan'),
};

export default recommendationService;
