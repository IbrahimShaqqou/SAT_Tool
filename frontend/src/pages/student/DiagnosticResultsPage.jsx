/**
 * Diagnostic Results Page
 * Thin wrapper around the shared AssessmentResultsPage.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import diagnosticService from '../../services/diagnosticService';
import AssessmentResultsPage from '../shared/AssessmentResultsPage';

export default function DiagnosticResultsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setIsLoading(true);
        const res = await diagnosticService.getResults(sessionId);
        setResults(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load diagnostic results');
      } finally {
        setIsLoading(false);
      }
    };
    fetchResults();
  }, [sessionId]);

  return (
    <AssessmentResultsPage
      results={results}
      title="Diagnostic Results"
      subtitle="Your estimated SAT score and personalized recommendations"
      isLoading={isLoading}
      error={error}
      onGoHome={() => navigate('/student/dashboard')}
    />
  );
}
