/**
 * Tutor view of a student's practice-test result. Reuses the student results
 * page in read-only "tutor" mode — same score report, skill map, and
 * question-by-question review, with a back link to the student.
 *
 * The /practice-tests/sessions/:id/{results,review} endpoints authorize the
 * student OR their tutor, so the shared practiceTestApi service works as-is.
 */
import { useParams } from 'react-router-dom';
import PracticeTestResultsPage from '../student/PracticeTestResultsPage';

const StudentPracticeTestResultPage = () => {
  const { id, sessionId } = useParams();
  return (
    <PracticeTestResultsPage
      sessionId={sessionId}
      isTutorView
      backTo={`/tutor/students/${id}`}
      backLabel="Back to student"
    />
  );
};

export default StudentPracticeTestResultPage;
