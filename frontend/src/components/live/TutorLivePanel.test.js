import { render, screen, fireEvent } from '@testing-library/react';
import TutorLivePanel from './TutorLivePanel';

const baseProps = {
  correctAnswerLabel: 'C · x = 10',
  explanationHtml: '<p>Distribute the 3.</p>',
  studentStatus: { answered: true, correct: false, selectedLabel: 'B' },
};

test('starts expanded and shows correct answer + explanation', () => {
  render(<TutorLivePanel {...baseProps} />);
  expect(screen.getByText('C · x = 10')).toBeInTheDocument();
  expect(screen.getByText(/Distribute the 3/)).toBeInTheDocument();
});

test('collapses when the toggle is clicked', () => {
  render(<TutorLivePanel {...baseProps} />);
  fireEvent.click(screen.getByRole('button', { name: /collapse/i }));
  expect(screen.queryByText('C · x = 10')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
});

test('shows wrong-answer status when student answered incorrectly', () => {
  render(<TutorLivePanel {...baseProps} />);
  expect(screen.getByText(/answered B/i)).toBeInTheDocument();
});
