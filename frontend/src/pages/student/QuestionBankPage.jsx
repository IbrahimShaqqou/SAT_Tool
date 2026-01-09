/**
 * Student Question Bank Page
 * Wrapper around shared QuestionBankPage component
 */
import QuestionBankPage from '../shared/QuestionBankPage';

const StudentQuestionBankPage = () => {
  return <QuestionBankPage userRole="student" />;
};

export default StudentQuestionBankPage;
