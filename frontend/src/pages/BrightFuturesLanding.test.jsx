import { render, screen } from '@testing-library/react';
import BrightFuturesLanding, { buildSmsHref, track, SMS_NUMBER, SMS_BODY } from './BrightFuturesLanding';

describe('buildSmsHref', () => {
  test('builds an sms: link with url-encoded body', () => {
    const href = buildSmsHref('14075887558', 'Hi — test [FL] & more');
    expect(href).toBe('sms:14075887558?&body=Hi%20%E2%80%94%20test%20%5BFL%5D%20%26%20more');
  });

  test('uses the confirmed number and body constants', () => {
    expect(SMS_NUMBER).toBe('14075887558');
    expect(SMS_BODY).toContain('[FL]');
    const href = buildSmsHref(SMS_NUMBER, SMS_BODY);
    expect(href.startsWith('sms:14075887558?&body=')).toBe(true);
  });
});

describe('track', () => {
  afterEach(() => { delete window.fbq; });

  test('is a no-op when fbq is absent', () => {
    delete window.fbq;
    expect(() => track('Lead', { source: 'x' })).not.toThrow();
  });

  test('calls fbq with track + event + params when present', () => {
    const calls = [];
    window.fbq = (...args) => calls.push(args);
    track('Lead', { source: 'text' });
    expect(calls).toEqual([['track', 'Lead', { source: 'text' }]]);
  });
});

describe('hero', () => {
  test('has a single primary book CTA and no "See how it works" button', () => {
    render(<BrightFuturesLanding />);
    expect(screen.queryByRole('button', { name: /see how it works/i })).toBeNull();
    const bookButtons = screen.getAllByRole('button', { name: /book a (free )?(strategy )?call/i });
    expect(bookButtons.length).toBeGreaterThanOrEqual(1);
  });

  test('offers a text link that points to the book section', () => {
    render(<BrightFuturesLanding />);
    const textLink = screen.getByRole('link', { name: /prefer to text/i });
    expect(textLink.getAttribute('href')).toBe('#book');
  });
});
