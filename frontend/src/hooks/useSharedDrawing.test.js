// frontend/src/hooks/useSharedDrawing.test.js
import { renderHook, act } from '@testing-library/react';
import { useSharedDrawing } from './useSharedDrawing';

function setup(author = 'tutor') {
  const send = jest.fn();
  const hook = renderHook(() => useSharedDrawing({ sessionId: 's1', author, send }));
  return { hook, send };
}

test('strokes are scoped to the current question and restored on return', () => {
  const { hook } = setup('student');
  act(() => hook.result.current.setQuestionId('q1'));
  act(() => { const id = hook.result.current.startStroke({ color: '#111827', size: 3, eraser: false, point: { x: 10, y: 10 } }); hook.result.current.endStroke(id); });
  expect(hook.result.current.strokes).toHaveLength(1);

  // navigate to q2 -> empty
  act(() => hook.result.current.setQuestionId('q2'));
  expect(hook.result.current.strokes).toHaveLength(0);

  // back to q1 -> restored
  act(() => hook.result.current.setQuestionId('q1'));
  expect(hook.result.current.strokes).toHaveLength(1);
});

test('emitted messages carry the current question_id', () => {
  const { hook, send } = setup('student');
  act(() => hook.result.current.setQuestionId('q7'));
  act(() => { const id = hook.result.current.startStroke({ color: '#111827', size: 3, eraser: false, point: { x: 1, y: 1 } }); hook.result.current.endStroke(id); });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'stroke_start', payload: expect.objectContaining({ question_id: 'q7' }) }));
});

test('applyMessage files a remote stroke into its question; shown only when current', () => {
  const { hook } = setup('tutor');
  act(() => hook.result.current.setQuestionId('q1'));
  act(() => hook.result.current.applyMessage({ type: 'stroke_start', payload: { stroke_id: 'st-1', author: 'student', color: '#111827', size: 3, eraser: false, point: { x: 5, y: 5 }, question_id: 'q2' } }));
  act(() => hook.result.current.applyMessage({ type: 'stroke_end', payload: { stroke_id: 'st-1', question_id: 'q2' } }));
  expect(hook.result.current.strokes).toHaveLength(0); // not shown on q1
  act(() => hook.result.current.setQuestionId('q2'));
  expect(hook.result.current.strokes).toHaveLength(1); // shown on q2
});

test('undo removes only this author’s last stroke in the current question', () => {
  const { hook, send } = setup('tutor');
  act(() => hook.result.current.setQuestionId('q1'));
  act(() => hook.result.current.applyMessage({ type: 'stroke_start', payload: { stroke_id: 'st-1', author: 'student', color: '#111827', size: 3, eraser: false, point: { x: 0, y: 0 }, question_id: 'q1' } }));
  act(() => hook.result.current.applyMessage({ type: 'stroke_end', payload: { stroke_id: 'st-1', question_id: 'q1' } }));
  act(() => { const id = hook.result.current.startStroke({ color: '#b45309', size: 3, eraser: false, point: { x: 1, y: 1 } }); hook.result.current.endStroke(id); });
  act(() => hook.result.current.undo());
  expect(hook.result.current.strokes.filter((s) => s.author === 'tutor')).toHaveLength(0);
  expect(hook.result.current.strokes.filter((s) => s.author === 'student')).toHaveLength(1);
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'stroke_undo' }));
});

test('strokes_sync replaces the syncing author’s set for that question only', () => {
  const { hook } = setup('tutor');
  act(() => hook.result.current.setQuestionId('q1'));
  act(() => hook.result.current.applyMessage({ type: 'stroke_start', payload: { stroke_id: 'old', author: 'student', color: '#111827', size: 3, eraser: false, point: { x: 0, y: 0 }, question_id: 'q1' } }));
  act(() => hook.result.current.applyMessage({ type: 'stroke_end', payload: { stroke_id: 'old', question_id: 'q1' } }));
  act(() => hook.result.current.applyMessage({ type: 'strokes_sync', payload: { question_id: 'q1', strokes: [{ id: 'new', author: 'student', color: '#111827', size: 3, eraser: false, points: [{ x: 9, y: 9 }] }] } }));
  expect(hook.result.current.strokes.filter((s) => s.author === 'student').map((s) => s.id)).toEqual(['new']);
});

test('syncPayload returns the current question’s own-author strokes', () => {
  const { hook } = setup('student');
  act(() => hook.result.current.setQuestionId('q5'));
  act(() => { const id = hook.result.current.startStroke({ color: '#111827', size: 3, eraser: false, point: { x: 2, y: 2 } }); hook.result.current.endStroke(id); });
  const payload = hook.result.current.syncPayload();
  expect(payload.question_id).toBe('q5');
  expect(payload.strokes).toHaveLength(1);
  expect(payload.strokes.every((s) => s.author === 'student')).toBe(true);
});
