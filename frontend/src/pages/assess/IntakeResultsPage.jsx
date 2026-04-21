/**
 * Intake Assessment Results Page
 * Thin wrapper around the shared AssessmentResultsPage.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import assessService from '../../services/assessService';
import AssessmentResultsPage from '../shared/AssessmentResultsPage';

export default function IntakeResultsPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setIsLoading(true);
        const res = await assessService.getFullResults(token);
        setResults(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load results');
      } finally {
        setIsLoading(false);
      }
    };
    fetchResults();
  }, [token]);

  return (
    <AssessmentResultsPage
      results={results}
      title="Intake Assessment Results"
      subtitle="Review your performance and identify areas for improvement"
      isLoading={isLoading}
      error={error}
      onGoHome={() => navigate('/student')}
    />
  );
}
