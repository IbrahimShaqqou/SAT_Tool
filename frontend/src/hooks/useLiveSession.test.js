import { renderHook, act, waitFor } from '@testing-library/react';
import { useLiveSession } from './useLiveSession';
import { liveService } from '../services';

jest.mock('../services', () => {
  return { liveService: { connect: jest.fn() } };
});

test('connects when enabled and exposes incoming messages', async () => {
  let captured;
  liveService.connect.mockImplementation(async ({ onMessage, onStatusChange }) => {
    captured = { onMessage, onStatusChange };
    onStatusChange('connected');
    return { send: jest.fn(), close: jest.fn() };
  });

  const { result } = renderHook(() =>
    useLiveSession({ sessionId: 's-1', role: 'tutor', enabled: true })
  );

  await waitFor(() => expect(result.current.status).toBe('connected'));

  act(() => {
    captured.onMessage({ type: 'question_changed', payload: { question_index: 4 } });
  });
  expect(result.current.lastByType.question_changed.payload.question_index).toBe(4);
});

test('does not connect when disabled', () => {
  renderHook(() => useLiveSession({ sessionId: 's-1', role: 'tutor', enabled: false }));
  expect(liveService.connect).not.toHaveBeenCalled();
});

test('calls onMessage for every inbound message when provided', async () => {
  const seen = [];
  let captured;
  liveService.connect.mockImplementation(async ({ onMessage, onStatusChange }) => {
    captured = { onMessage, onStatusChange };
    onStatusChange('connected');
    return { send: jest.fn(), close: jest.fn() };
  });
  renderHook(() => useLiveSession({ sessionId: 's-1', role: 'tutor', enabled: true, onMessage: (m) => seen.push(m) }));
  await waitFor(() => expect(captured).toBeTruthy());
  act(() => {
    captured.onMessage({ type: 'stroke_points', payload: { stroke_id: 'x', points: [] } });
    captured.onMessage({ type: 'stroke_points', payload: { stroke_id: 'x', points: [] } });
  });
  expect(seen.filter((m) => m.type === 'stroke_points')).toHaveLength(2);
});
