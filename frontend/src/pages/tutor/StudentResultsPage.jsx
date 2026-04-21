/**
 * Tutor Student Results Page
 * Lets tutors view any student's completed session results.
 * Thin wrapper around the shared AssessmentResultsPage.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AssessmentResultsPage from '../shared/AssessmentResultsPage';

export default function StudentResultsPage() {
  const { studentId, sessionId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setIsLoading(true);
        // Use the diagnostic results endpoint (accepts any session for tutors)
        const res = await api.get(`/diagnostic/${sessionId}/results`);
        setResults(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load student results');
      } finally {
        setIsLoading(false);
      }
    };
    fetchResults();
  }, [sessionId]);

  return (
    <AssessmentResultsPage
      results={results}
      title="Student Assessment Results"
      subtitle="Review this student's performance and identify areas to focus on"
      isLoading={isLoading}
      error={error}
      onGoHome={() => navigate(`/tutor/students/${studentId}`)}
    />
  );
}
