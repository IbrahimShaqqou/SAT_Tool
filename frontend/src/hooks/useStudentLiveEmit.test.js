import { renderHook, act } from '@testing-library/react';
import { useStudentLiveEmit } from './useStudentLiveEmit';
import useLiveSession from './useLiveSession';

jest.mock('./useLiveSession');

function setup(lastByType = {}) {
  const send = jest.fn();
  useLiveSession.mockReturnValue({ status: 'connected', snapshot: null, lastByType, send });
  return { send };
}

test('emitAnswer sends an answer_selected message when enabled', () => {
  const { send } = setup();
  const { result } = renderHook(() =>
    useStudentLiveEmit({ enabled: true, sessionId: 's-1', currentQuestionId: 'q-1', currentQuestionIndex: 0 })
  );
  act(() => result.current.emitAnswer('q-1', 2));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({
    type: 'answer_selected',
    session_id: 's-1',
    payload: expect.objectContaining({ question_id: 'q-1', selected_answer: 2 }),
  }));
});

test('does not emit when disabled', () => {
  const { send } = setup();
  const { result } = renderHook(() =>
    useStudentLiveEmit({ enabled: false, sessionId: 's-1', currentQuestionId: 'q-1', currentQuestionIndex: 0 })
  );
  act(() => result.current.emitAnswer('q-1', 2));
  expect(send).not.toHaveBeenCalled();
});

test('exposes tutor presence from tutor_joined message', () => {
  setup({ tutor_joined: { type: 'tutor_joined', payload: { tutor_name: 'Sam' }, _rx: 1 } });
  const { result } = renderHook(() =>
    useStudentLiveEmit({ enabled: true, sessionId: 's-1', currentQuestionId: 'q-1', currentQuestionIndex: 0 })
  );
  expect(result.current.indicator.present).toBe(true);
  expect(result.current.indicator.tutorName).toBe('Sam');
});

test('provides a shared drawing bundle that emits student-authored strokes', () => {
  const { send } = setup();
  const { result } = renderHook(() =>
    useStudentLiveEmit({ enabled: true, sessionId: 's-1', currentQuestionId: 'q-1', currentQuestionIndex: 0 })
  );
  act(() => { result.current.shared.startStroke({ color: '#111827', size: 3, eraser: false, point: { x: 82, y: 116 } }); });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'stroke_start', sender_role: 'student' }));
});
