import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LiveSessionsPage from './LiveSessionsPage';
import tutorService from '../../services/tutorService';

jest.mock('../../services/tutorService', () => ({
  __esModule: true,
  default: { getActiveSessions: jest.fn() },
}));

jest.mock('../../services/liveService', () => ({ getQuestionDetail: jest.fn() }));
jest.mock('../../hooks', () => ({ useLiveSession: () => ({ status: 'idle', snapshot: null, lastByType: {}, send: jest.fn() }) }));

test('lists active sessions returned by the API', async () => {
  tutorService.getActiveSessions.mockResolvedValue({
    data: { sessions: [
      { session_id: 's-1', student_id: 'u-1', student_name: 'Maya R.', test_type: 'PRACTICE' },
    ] },
  });
  render(<MemoryRouter><LiveSessionsPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Maya R.')).toBeInTheDocument());
});

test('shows empty state when no one is active', async () => {
  tutorService.getActiveSessions.mockResolvedValue({ data: { sessions: [] } });
  render(<MemoryRouter><LiveSessionsPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/no active sessions/i)).toBeInTheDocument());
});
