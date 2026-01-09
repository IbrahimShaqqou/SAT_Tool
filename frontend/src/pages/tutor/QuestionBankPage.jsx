/**
 * Tutor Question Bank Page
 * Wrapper around shared QuestionBankPage component
 */
import QuestionBankPage from '../shared/QuestionBankPage';

const TutorQuestionBankPage = () => {
  return <QuestionBankPage userRole="tutor" />;
};

export default TutorQuestionBankPage;
