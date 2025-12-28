/**
 * Student Results Page
 * View completed assignment results with detailed question breakdown
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, Button, ProgressBar, LoadingSpinner } from '../../components/ui';
import { assignmentService } from '../../services';

// Helper to format answer for display
const formatAnswer = (answer, choices, answerType) => {
  if (!answer) return 'Not answered';

  if (answerType === 'MCQ') {
    // MCQ answer format: { index: N }
    const selectedIndex = answer.index;
    if (selectedIndex !== undefined && selectedIndex !== null && choices && choices[selectedIndex]) {
      const choice = choices[selectedIndex];
      const letter = String.fromCharCode(65 + selectedIndex); // A, B, C, D
      return (
        <span className="flex items-start gap-2">
          <span className="font-medium">{letter}.</span>
          <span
            className="question-content"
            dangerouslySetInnerHTML={{ __html: choice.content }}
          />
        </span>
      );
    }
    return selectedIndex !== undefined ? `Choice ${String.fromCharCode(65 + selectedIndex)}` : 'Not answered';
  } else {
    // SPR answer format: { answer: "text" }
    return answer.answer || 'No answer';
  }
};

// Question result component with collapsible explanation
const QuestionResult = ({ question, index }) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const contentRef = useRef(null);

  // Trigger MathJax typesetting when content changes
  useEffect(() => {
    if (contentRef.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([contentRef.current]).catch(console.error);
    }
  }, [question, showExplanation]);

  const isCorrect = (() => {
    if (!question.selected_answer) return false;
    const correctAnswer = question.correct_answer;
    const selectedAnswer = question.selected_answer;

    if (question.answer_type === 'MCQ') {
      // MCQ: compare { index: N }
      return selectedAnswer.index === correctAnswer.index;
    } else {
      // SPR - check if response matches any correct value
      // selected_answer: { answer: "text" }
      // correct_answer: { answers: ["val1", "val2", ...] }
      const userValue = selectedAnswer.answer;
      const correctValues = correctAnswer.answers || [];

      // Handle "*" which means any answer is correct (manually graded)
      if (correctValues.includes("*")) {
        return true; // We can't auto-grade this
      }

      return correctValues.some(cv =>
        String(cv).trim().toLowerCase() === String(userValue).trim().toLowerCase()
      );
    }
  })();

  return (
    <Card className={`border-l-4 ${isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
      <div ref={contentRef}>
        {/* Question header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-600">Question {index + 1}</span>
            {isCorrect ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </div>
          <span className={`text-sm font-medium px-2 py-1 rounded ${
            isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {isCorrect ? 'Correct' : 'Incorrect'}
          </span>
        </div>

        {/* Question content */}
        {question.passage_html && (
          <div
            className="prose prose-sm max-w-none text-gray-600 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 question-content"
            dangerouslySetInnerHTML={{ __html: question.passage_html }}
          />
        )}
        <div
          className="prose prose-gray max-w-none mb-4 question-content"
          dangerouslySetInnerHTML={{ __html: question.prompt_html }}
        />

        {/* Your answer */}
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-500 mb-1">Your Answer:</p>
          <div className={`p-3 rounded-lg ${
            isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {formatAnswer(question.selected_answer, question.choices, question.answer_type)}
          </div>
        </div>

        {/* Correct answer (if wrong) */}
        {!isCorrect && (
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-500 mb-1">Correct Answer:</p>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              {question.answer_type === 'MCQ' ? (
                (() => {
                  const correctIndex = question.correct_answer?.index;
                  if (correctIndex === undefined || correctIndex === null) {
                    return <span>See explanation</span>;
                  }
                  const choice = question.choices?.[correctIndex];
                  const letter = String.fromCharCode(65 + correctIndex);
                  return (
                    <span className="flex items-start gap-2">
                      <span className="font-medium">{letter}.</span>
                      {choice && (
                        <span
                          className="question-content"
                          dangerouslySetInnerHTML={{ __html: choice.content }}
                        />
                      )}
                    </span>
                  );
                })()
              ) : (
                (() => {
                  const answers = question.correct_answer?.answers || [];
                  if (answers.length === 0 || answers[0] === '*') {
                    return <span>See explanation</span>;
                  }
                  return <span>{answers.join(' or ')}</span>;
                })()
              )}
            </div>
          </div>
        )}

        {/* Explanation toggle */}
        {question.explanation_html && (
          <div className="mt-4 border-t pt-3">
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              {showExplanation ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide Explanation
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show Explanation
                </>
              )}
            </button>

            {showExplanation && (
              <div
                className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg prose prose-sm prose-blue max-w-none question-content"
                dangerouslySetInnerHTML={{ __html: question.explanation_html }}
              />
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

const ResultsPage = () => {
  const { id } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const [assignmentRes, questionsRes] = await Promise.all([
          assignmentService.getAssignment(id),
          assignmentService.getAssignmentQuestions(id),
        ]);
        setAssignment(assignmentRes.data);
        setQuestions(questionsRes.data.questions || []);
      } catch (error) {
        console.error('Failed to fetch results:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Results not found</p>
        <Link to="/student/assignments">
          <Button variant="secondary" className="mt-4">Back to Assignments</Button>
        </Link>
      </div>
    );
  }

  const score = assignment.score_percentage || 0;
  const correct = assignment.questions_correct || 0;
  const total = assignment.total_questions || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/student/assignments">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Results</h1>
          <p className="text-gray-500">{assignment.title}</p>
        </div>
      </div>

      {/* Score Card */}
      <Card className="text-center">
        <div className="py-6">
          <p className="text-6xl font-bold text-gray-900">{score.toFixed(0)}%</p>
          <p className="text-gray-500 mt-2">
            {correct} out of {total} correct
          </p>
          <div className="mt-4 max-w-xs mx-auto">
            <ProgressBar value={score} variant="auto" size="lg" />
          </div>
        </div>
      </Card>

      {/* Summary */}
      <Card>
        <Card.Header>
          <Card.Title>Summary</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium text-gray-900">{correct}</p>
                <p className="text-sm text-gray-500">Correct</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-gray-900">{total - correct}</p>
                <p className="text-sm text-gray-500">Incorrect</p>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Detailed Question Results */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Question Details</h2>
        {questions.map((question, index) => (
          <QuestionResult key={question.question_id} question={question} index={index} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link to="/student/assignments" className="flex-1">
          <Button variant="secondary" className="w-full">
            Back to Assignments
          </Button>
        </Link>
        <Link to="/student" className="flex-1">
          <Button variant="primary" className="w-full">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default ResultsPage;
