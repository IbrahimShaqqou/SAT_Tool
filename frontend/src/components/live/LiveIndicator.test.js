import { render, screen } from '@testing-library/react';
import { LiveIndicator } from './index';

test('renders nothing when tutor absent', () => {
  const { container } = render(<LiveIndicator present={false} tutorName="Sam" />);
  expect(container).toBeEmptyDOMElement();
});

test('announces the tutor when present', () => {
  render(<LiveIndicator present={true} tutorName="Sam" />);
  expect(screen.getByText(/Sam/)).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeInTheDocument();
});
