/**
 * Intake Assessment Results Page
 *
 * Shows detailed results after completing an intake assessment:
 * - Overall score and predicted SAT range
 * - Domain breakdown
 * - Question-by-question review
 * - Weak skills with practice recommendations
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Target,
  TrendingUp,
  Clock,
  BookOpen,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import assessService from '../../services/assessService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import QuestionDisplay from '../../components/test/QuestionDisplay';

// Letter labels for MCQ choices
const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

export default function IntakeResultsPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [review, setReview] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'questions'

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        // Fetch both results and review data
        const [resultsRes, reviewRes] = await Promise.all([
          assessService.getResults(token),
          assessService.getReview(token),
        ]);
        setResults(resultsRes.data);
        setReview(reviewRes.data);
      } catch (err) {
        console.error('Failed to fetch results:', err);
        setError(err.response?.data?.detail || 'Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [token]);

  const toggleQuestion = useCallback((index) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleStartPractice = (skillName) => {
    // Navigate to adaptive practice with skill pre-selected
    if (user) {
      navigate('/student/adaptive', { state: { focusSkill: skillName } });
    } else {
      navigate('/login', { state: { returnTo: '/student/adaptive' } });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading your results..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Results</h1>
          <p className="text-gray-600">{error}</p>
        </Card>
      </div>
    );
  }

  if (!results || !review) {
    return null;
  }

  const { overall, section_abilities, domain_abilities, priority_areas, predicted_composite } = results;
  const { questions, score_percentage, questions_correct, total_questions, time_spent_seconds } = review;

  // Group questions by correctness for summary
  const correctQuestions = questions.filter(q => q.is_correct);
  const incorrectQuestions = questions.filter(q => !q.is_correct);

  // Calculate time in minutes
  const timeMinutes = Math.floor(time_spent_seconds / 60);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Intake Assessment Results</h1>
          <p className="text-gray-600 mt-1">Review your performance and identify areas for improvement</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Overall Score Card */}
        <Card>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Score */}
              <div className="text-center">
                <div className="text-5xl font-bold text-gray-900 mb-2">
                  {Math.round(score_percentage)}%
                </div>
                <div className="text-gray-600">
                  {questions_correct} of {total_questions} correct
                </div>
              </div>

              {/* Predicted SAT Score */}
              {predicted_composite && (
                <div className="text-center border-l border-r border-gray-200 px-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">Predicted SAT</span>
                  </div>
                  <div className="text-3xl font-bold text-blue-600">
                    {predicted_composite.mid}
                  </div>
                  <div className="text-sm text-gray-500">
                    Range: {predicted_composite.low} - {predicted_composite.high}
                  </div>
                </div>
              )}

              {/* Time */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Time Spent</span>
                </div>
                <div className="text-3xl font-bold text-gray-700">
                  {timeMinutes}
                </div>
                <div className="text-sm text-gray-500">minutes</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Section Scores */}
        {section_abilities && section_abilities.length > 0 && (
          <Card>
            <Card.Header>
              <Card.Title>Section Performance</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section_abilities.map((section) => (
                  <div
                    key={section.section}
                    className="bg-gray-50 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900 capitalize">
                          {section.section === 'reading_writing' ? 'Reading & Writing' : section.section}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {section.correct} / {section.total} correct ({Math.round(section.accuracy)}%)
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-600">
                          {section.predicted_score_mid}
                        </div>
                        <div className="text-xs text-gray-500">
                          {section.predicted_score_low}-{section.predicted_score_high}
                        </div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${section.accuracy}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>
        )}

        {/* Priority Areas / Weak Skills */}
        {priority_areas && priority_areas.length > 0 && (
          <Card>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-500" />
                Areas to Focus On
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="space-y-3">
                {priority_areas.map((area, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{area.domain_name}</h4>
                      <p className="text-sm text-gray-600">{area.recommendation}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full">
                        {area.current_level}
                      </span>
                    </div>
                    {user && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleStartPractice(area.domain_name)}
                        className="ml-4"
                      >
                        Practice
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>
        )}

        {/* Domain Breakdown */}
        {domain_abilities && domain_abilities.length > 0 && (
          <Card>
            <Card.Header>
              <Card.Title>Domain Breakdown</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="space-y-3">
                {domain_abilities.map((domain) => (
                  <div key={domain.domain_id} className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-mono text-sm font-medium text-gray-600">
                      {domain.domain_code}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-gray-900">{domain.domain_name}</span>
                        <span className="text-sm text-gray-600">
                          {domain.correct}/{domain.total} ({Math.round(domain.accuracy)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            domain.accuracy >= 70 ? 'bg-green-500' :
                            domain.accuracy >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${domain.accuracy}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>
        )}

        {/* Tabs for Questions */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'questions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Question Review ({questions.length})
            </button>
          </nav>
        </div>

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Correct Questions Summary */}
            <Card>
              <Card.Header>
                <Card.Title className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  Correct ({correctQuestions.length})
                </Card.Title>
              </Card.Header>
              <Card.Content>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {correctQuestions.map((q) => (
                    <div
                      key={q.question_id}
                      className="flex items-center justify-between py-2 px-3 bg-green-50 rounded-lg text-sm"
                    >
                      <span className="font-medium">Q{q.order + 1}</span>
                      <span className="text-gray-600 truncate ml-2 flex-1">{q.skill_name || q.domain_name}</span>
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>

            {/* Incorrect Questions Summary */}
            <Card>
              <Card.Header>
                <Card.Title className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  Incorrect ({incorrectQuestions.length})
                </Card.Title>
              </Card.Header>
              <Card.Content>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {incorrectQuestions.map((q) => (
                    <div
                      key={q.question_id}
                      className="flex items-center justify-between py-2 px-3 bg-red-50 rounded-lg text-sm cursor-pointer hover:bg-red-100"
                      onClick={() => {
                        setActiveTab('questions');
                        setExpandedQuestions(new Set([q.order]));
                        // Scroll to question (delayed to allow tab switch)
                        setTimeout(() => {
                          document.getElementById(`question-${q.order}`)?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                    >
                      <span className="font-medium">Q{q.order + 1}</span>
                      <span className="text-gray-600 truncate ml-2 flex-1">{q.skill_name || q.domain_name}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>
          </div>
        )}

        {/* Questions Tab Content */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            {questions.map((q, index) => (
              <Card key={q.question_id} id={`question-${index}`}>
                <div
                  className={`p-4 cursor-pointer flex items-center justify-between ${
                    q.is_correct ? 'bg-green-50' : 'bg-red-50'
                  }`}
                  onClick={() => toggleQuestion(index)}
                >
                  <div className="flex items-center gap-3">
                    {q.is_correct ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium text-gray-900">Question {index + 1}</span>
                    {q.domain_code && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                        {q.domain_code}
                      </span>
                    )}
                    {q.skill_name && (
                      <span className="text-sm text-gray-600 hidden md:inline">
                        {q.skill_name}
                      </span>
                    )}
                  </div>
                  {expandedQuestions.has(index) ? (
                    <ChevronUp className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  )}
                </div>

                {expandedQuestions.has(index) && (
                  <div className="p-4 border-t border-gray-200">
                    {/* Question prompt */}
                    <div className="mb-4">
                      {q.passage_html && (
                        <div
                          className="mb-4 p-4 bg-gray-50 rounded-lg prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: q.passage_html }}
                        />
                      )}
                      <div
                        className="prose prose-sm max-w-none question-content"
                        dangerouslySetInnerHTML={{ __html: q.prompt_html }}
                      />
                    </div>

                    {/* Answer choices */}
                    {q.answer_type === 'MCQ' && q.choices && (
                      <div className="space-y-2 mb-4">
                        {q.choices.map((choice, choiceIndex) => {
                          const isStudentAnswer = q.student_answer?.index === choiceIndex;
                          const isCorrectAnswer = q.correct_answer?.index === choiceIndex;

                          let bgClass = 'bg-white border-gray-200';
                          if (isCorrectAnswer) {
                            bgClass = 'bg-green-50 border-green-500';
                          } else if (isStudentAnswer && !q.is_correct) {
                            bgClass = 'bg-red-50 border-red-500';
                          }

                          return (
                            <div
                              key={choiceIndex}
                              className={`p-3 border rounded-lg flex items-start gap-3 ${bgClass}`}
                            >
                              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-medium ${
                                isCorrectAnswer ? 'bg-green-500 text-white' :
                                isStudentAnswer ? 'bg-red-500 text-white' :
                                'bg-gray-200 text-gray-700'
                              }`}>
                                {CHOICE_LABELS[choiceIndex]}
                              </span>
                              <div
                                className="flex-1 prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: choice.content }}
                              />
                              {isStudentAnswer && (
                                <span className="text-xs font-medium text-gray-600">Your answer</span>
                              )}
                              {isCorrectAnswer && (
                                <span className="text-xs font-medium text-green-600">Correct</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* SPR Answer */}
                    {q.answer_type === 'SPR' && (
                      <div className="mb-4 space-y-2">
                        <div className={`p-3 rounded-lg ${q.is_correct ? 'bg-green-50' : 'bg-red-50'}`}>
                          <span className="text-sm font-medium text-gray-600">Your answer: </span>
                          <span className={q.is_correct ? 'text-green-700' : 'text-red-700'}>
                            {q.student_answer?.answer || '(no answer)'}
                          </span>
                        </div>
                        {!q.is_correct && (
                          <div className="p-3 rounded-lg bg-green-50">
                            <span className="text-sm font-medium text-gray-600">Correct answer: </span>
                            <span className="text-green-700">
                              {q.correct_answer?.answers?.join(' or ') || q.correct_answer?.answer}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation_html && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-900">Explanation</span>
                        </div>
                        <div
                          className="prose prose-sm max-w-none text-gray-700"
                          dangerouslySetInnerHTML={{ __html: q.explanation_html }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Call to Action */}
        <Card>
          <div className="p-6 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to improve?</h3>
            <p className="text-gray-600 mb-4">
              Start practicing your weak areas with adaptive questions tailored to your level.
            </p>
            {user ? (
              <div className="flex justify-center gap-4">
                <Button variant="secondary" onClick={() => navigate('/student/dashboard')}>
                  Go to Dashboard
                </Button>
                <Button variant="primary" onClick={() => navigate('/student/adaptive')}>
                  Start Adaptive Practice
                </Button>
              </div>
            ) : (
              <div className="flex justify-center gap-4">
                <Button variant="primary" onClick={() => navigate('/register')}>
                  Create Account to Practice
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
