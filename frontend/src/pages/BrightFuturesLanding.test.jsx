import { render, screen, fireEvent } from '@testing-library/react';
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

describe('parent video', () => {
  test('renders the testimonial video with poster and caption', () => {
    const { container } = render(<BrightFuturesLanding />);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video.getAttribute('src')).toBe('/media/parent-testimonial.mp4');
    expect(video.getAttribute('poster')).toBe('/media/parent-testimonial-poster.jpg');
    expect(screen.getByText(/imani, parent of a junior in orlando/i)).toBeInTheDocument();
  });
});

describe('score results', () => {
  test('shows real score jumps tied to the award they unlock', () => {
    render(<BrightFuturesLanding />);
    expect(screen.getByText(/1020\s*→\s*1360/)).toBeInTheDocument();
    expect(screen.getByText(/910\s*→\s*1200/)).toBeInTheDocument();
    expect(screen.getByText(/qualified for 100% tuition/i)).toBeInTheDocument();
    expect(screen.getByText(/qualified for 75% tuition/i)).toBeInTheDocument();
    expect(screen.getByText(/used with permission/i)).toBeInTheDocument();
  });
});

describe('bio', () => {
  test('leads with the tutor but drops the 1600 self-brag', () => {
    const { container } = render(<BrightFuturesLanding />);
    expect(screen.getByText(/Ibrahim Shaqqou/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/1600/);
  });
});

describe('faq', () => {
  test('answers the silent objections, cost reframed with no published price', () => {
    render(<BrightFuturesLanding />);
    expect(screen.getByText(/what does it cost\?/i)).toBeInTheDocument();
    expect(screen.getByText(/how do online sessions work\?/i)).toBeInTheDocument();
    expect(screen.getByText(/how many sessions/i)).toBeInTheDocument();
    expect(screen.getByText(/which sat date/i)).toBeInTheDocument();
    expect(screen.getByText(/real company|are you legit/i)).toBeInTheDocument();
    // The cost answer must not commit to a dollar figure.
    const costAnswer = screen.getByText(/we scope the plan — and the price — together/i);
    expect(costAnswer.textContent).not.toMatch(/\$\s*\d/);
  });
});

describe('book / text section', () => {
  test('tap-to-text link uses the prefilled sms deep link', () => {
    render(<BrightFuturesLanding />);
    const smsLink = screen.getByRole('link', { name: /text me/i });
    expect(smsLink.getAttribute('href')).toBe(buildSmsHref(SMS_NUMBER, SMS_BODY));
  });

  test('fallback form captures name + phone and does not navigate away', () => {
    render(<BrightFuturesLanding />);
    const name = screen.getByLabelText(/your name/i);
    const phone = screen.getByLabelText(/mobile number/i);
    fireEvent.change(name, { target: { value: 'Maria' } });
    fireEvent.change(phone, { target: { value: '4075551212' } });
    // Submitting the stub shows a confirmation instead of throwing/navigating.
    fireEvent.click(screen.getByRole('button', { name: /text me back/i }));
    expect(screen.getByText(/thanks — i'll text you shortly/i)).toBeInTheDocument();
  });
});

describe('full page', () => {
  test('renders all key conversion sections without crashing', () => {
    render(<BrightFuturesLanding />);
    expect(screen.getByText(/\$17,000 to \$26,000/)).toBeInTheDocument(); // hero money hook
    expect(screen.getByText(/A parent on what the work/i)).toBeInTheDocument(); // video
    expect(screen.getByText(/students who hit their cutoff/i)).toBeInTheDocument(); // results
    expect(screen.getByText(/questions parents ask/i)).toBeInTheDocument(); // faq
    expect(screen.getByText(/two easy ways to start/i)).toBeInTheDocument(); // book/text
  });
});
