/**
 * Full-Length SAT Results Page
 * Shows SAT-scaled scores (200-800 per section, 400-1600 total)
 * Detailed breakdown by module and skill
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LoadingSpinner, Button, Card } from '../../components/ui';
import { practiceService } from '../../services';

const FullLengthResultsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await practiceService.getFullLengthResults(id);
        setResults(response.data);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching results:', err);
        setError(err.response?.data?.error || 'Failed to load results');
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Results</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <Button onClick={() => navigate('/student')} variant="primary">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const {
    math_score,
    reading_writing_score,
    total_score,
    math_correct,
    math_total,
    rw_correct,
    rw_total,
    modules,
  } = results;

  const mathPercentage = math_total > 0 ? Math.round((math_correct / math_total) * 100) : 0;
  const rwPercentage = rw_total > 0 ? Math.round((rw_correct / rw_total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Practice Test Results
          </h1>
          <p className="text-gray-600">
            Your SAT Score Report
          </p>
        </div>

        {/* Total Score Card */}
        <Card className="mb-8 bg-gradient-to-br from-[#0077C8] to-[#005fa3] text-white">
          <div className="text-center py-8">
            <div className="text-sm uppercase tracking-wide mb-2 opacity-90">
              Total SAT Score
            </div>
            <div className="text-7xl font-bold mb-2">
              {total_score}
            </div>
            <div className="text-sm opacity-90">
              out of 1600
            </div>
          </div>
        </Card>

        {/* Section Scores */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Math Score */}
          <Card>
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Math
            </h3>
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="text-5xl font-bold text-[#0077C8]">
                  {math_score}
                </div>
                <div className="text-sm text-gray-600">
                  out of 800
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">
                  {mathPercentage}%
                </div>
                <div className="text-sm text-gray-600">
                  {math_correct}/{math_total} correct
                </div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-[#0077C8] h-3 rounded-full transition-all"
                style={{ width: `${mathPercentage}%` }}
              />
            </div>
          </Card>

          {/* Reading/Writing Score */}
          <Card>
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Reading and Writing
            </h3>
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="text-5xl font-bold text-[#0077C8]">
                  {reading_writing_score}
                </div>
                <div className="text-sm text-gray-600">
                  out of 800
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">
                  {rwPercentage}%
                </div>
                <div className="text-sm text-gray-600">
                  {rw_correct}/{rw_total} correct
                </div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-[#0077C8] h-3 rounded-full transition-all"
                style={{ width: `${rwPercentage}%` }}
              />
            </div>
          </Card>
        </div>

        {/* Module Breakdown */}
        <Card className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            Module Breakdown
          </h3>
          <div className="space-y-4">
            {modules?.map((module, idx) => {
              const percentage = module.total_questions > 0
                ? Math.round((module.questions_correct / module.total_questions) * 100)
                : 0;

              return (
                <div key={module.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {module.title}
                      </div>
                      <div className="text-sm text-gray-600">
                        {module.questions_correct}/{module.total_questions} correct
                        {module.time_spent_seconds && (
                          <span className="ml-2">
                            • {Math.round(module.time_spent_seconds / 60)} min
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-[#0077C8]">
                      {percentage}%
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#0077C8] h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Next Steps */}
        <Card>
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Next Steps
          </h3>
          <div className="space-y-3 text-gray-700">
            <p>
              <strong>Great work completing this practice test!</strong> Review your performance and focus on areas that need improvement.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Review questions you missed to understand your mistakes</li>
              <li>Practice skills where you scored below 70%</li>
              <li>Take another practice test in 1-2 weeks to track progress</li>
              <li>Maintain consistent study habits leading up to test day</li>
            </ul>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 mt-8">
          <Button
            onClick={() => navigate('/student')}
            variant="secondary"
          >
            Back to Dashboard
          </Button>
          <Button
            onClick={() => navigate('/student/study-plan')}
            variant="primary"
          >
            View Study Plan
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FullLengthResultsPage;
