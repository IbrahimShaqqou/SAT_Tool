// frontend/src/components/test/QuestionFrame.test.js
import { render, screen } from '@testing-library/react';
import QuestionFrame from './QuestionFrame';
import { FRAME_W } from '../../utils/frameCoords';

// jsdom has no layout; mock ResizeObserver to report a fixed width.
beforeAll(() => {
  global.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) { this.cb([{ target: el, contentRect: { width: 410 } }]); }
    unobserve() {}
    disconnect() {}
  };
});

test('renders children inside a fixed-width scaled frame', () => {
  render(
    <QuestionFrame>
      {() => <div data-testid="content">hello</div>}
    </QuestionFrame>
  );
  expect(screen.getByTestId('content')).toBeInTheDocument();
  const frame = document.querySelector('[data-frame="true"]');
  expect(frame).toBeTruthy();
  expect(frame.style.width).toBe(`${FRAME_W}px`);
  // width 410 -> scale 0.5
  expect(frame.style.transform).toContain('scale(0.5)');
});

test('passes the computed scale to the child render function', () => {
  let seenScale = null;
  render(
    <QuestionFrame>
      {({ scale }) => { seenScale = scale; return <div>x</div>; }}
    </QuestionFrame>
  );
  expect(seenScale).toBeCloseTo(0.5, 5);
});
