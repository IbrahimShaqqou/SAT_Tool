import { correctAnswerLabel, correctIndex } from './liveFormat';

describe('liveFormat', () => {
  test('MCQ index -> letter + choice text', () => {
    const detail = {
      answer_type: 'MCQ',
      correct_answer_json: { index: 2 },
      choices: ['6', '8', '10', '12'],
    };
    expect(correctAnswerLabel(detail)).toBe('C · 10');
    expect(correctIndex(detail)).toBe(2);
  });

  test('SPR answers -> joined string', () => {
    const detail = {
      answer_type: 'SPR',
      correct_answer_json: { answers: ['3/4', '0.75'] },
      choices: [],
    };
    expect(correctAnswerLabel(detail)).toBe('3/4 or 0.75');
    expect(correctIndex(detail)).toBe(null);
  });

  test('missing detail -> em dash', () => {
    expect(correctAnswerLabel(null)).toBe('—');
  });
});
