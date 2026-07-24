/**
 * Bright Futures landing page (/fl): a standalone marketing page for landing
 * Florida tutoring clients. Not linked anywhere in ZooPrep and noindex'd, so it's
 * only reachable via a direct link you share.
 *
 * Sections: hero (money first), the award math, why the SAT is the lever, the
 * method, the guarantee, who you'll work with, book a call, footer.
 *
 * PLACEHOLDERS to fill before sharing (search "TODO"):
 *   - Cal.com embed URL
 *   - your name / photo / credentials in the "who you'll work with" section
 *   - exact guarantee terms (have them reviewed before taking money)
 *   - your contact email
 *
 * Official Bright Futures figures (FL OSFA, 2025-26 and 2026-27 grads):
 *   FAS: SAT 1330, 3.5 core GPA, about 100% tuition
 *   FMS: SAT 1190, 3.0 core GPA, 75% tuition
 */
import { useEffect, useState } from 'react';
import { Button } from '../components/ui';
import useScrollReveal from '../hooks/useScrollReveal';

// Cal.com booking. CAL_LINK is the slug (used by the inline embed); CALCOM_URL is
// the full page (used by the header/hero buttons that open a new tab).
const CAL_LINK = 'ibraheem-shaqqou-4nfkww/booking';
const CALCOM_URL = `https://cal.com/${CAL_LINK}`;
const CONTACT_EMAIL = 'hello@zooprep.com'; // TODO: your real contact email

// Brand bronze-amber, matched to the page so the calendar reads as part of it.
const CAL_BRAND = '#bf7724';

// --- Conversion: text-me deep link + Meta Pixel ---------------------------

// Confirmed SMS-capable number (digits only) and the pre-filled, [FL]-tagged
// message. The tag gives free attribution: any text arriving with "[FL]" came
// from this page.
export const SMS_NUMBER = '14075887558';
export const SMS_BODY =
  'Hi Ibrahim — I saw your Bright Futures page [FL] and I\'d like to know about SAT tutoring for my child.';

// Build an sms: deep link. On mobile this opens Messages with To + body
// pre-filled — the lowest-friction contact path for cold traffic.
export function buildSmsHref(number, body) {
  return `sms:${number}?&body=${encodeURIComponent(body)}`;
}

// Meta Pixel id. Empty string = pixel disabled (no-op) so the page is safe to
// ship before the real id is set.
const META_PIXEL_ID = ''; // TODO: paste your Meta Pixel ID to enable tracking.

// Fire a Meta Pixel event if the pixel is loaded; otherwise do nothing.
// Never throws, so it's safe to call from any click handler.
export function track(event, params) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', event, params);
  }
}

/**
 * Cal.com inline embed, themed to the light page instead of Cal's default dark
 * iframe. Loads Cal's embed script once on mount and renders the booker inside
 * #cal-inline. Auto-sizes (no scrollbars) and respects light theme + brand color.
 */
const CalEmbed = () => {
  useEffect(() => {
    // Cal's official embed loader (vendored inline so we add no npm dependency).
    (function (C, A, L) {
      const p = (a, ar) => { a.q.push(ar); };
      const d = C.document;
      C.Cal = C.Cal || function () {
        const cal = C.Cal;
        const ar = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement('script')).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          const api = function () { p(api, arguments); };
          const namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === 'string') {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ['initNamespace', namespace]);
          } else { p(cal, ar); }
          return;
        }
        p(cal, ar);
      };
    })(window, 'https://app.cal.com/embed/embed.js', 'init');

    const Cal = window.Cal;
    Cal('init', 'booking', { origin: 'https://cal.com' });
    Cal.ns.booking('inline', {
      elementOrSelector: '#cal-inline',
      config: { layout: 'month_view' },
      calLink: CAL_LINK,
    });
    Cal.ns.booking('ui', {
      theme: 'light',
      cssVarsPerTheme: { light: { 'cal-brand': CAL_BRAND } },
      hideEventTypeDetails: false,
      layout: 'month_view',
    });
  }, []);

  return <div id="cal-inline" style={{ width: '100%', minHeight: 560 }} />;
};

const Reveal = ({ children, className = '', stagger = false }) => {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`${stagger ? 'reveal-stagger' : 'reveal'} ${className}`}>
      {children}
    </div>
  );
};

const BookButton = ({ size = 'lg', children = 'Book a free strategy call', className = '' }) => {
  const onClick = () => {
    track('Lead', { source: 'book' });
    if (CALCOM_URL) window.open(CALCOM_URL, '_blank', 'noopener');
    else document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
  };
  return (
    <Button variant="primary" size={size} className={className} onClick={onClick}>
      {children}
    </Button>
  );
};

/**
 * Text-first contact block. Primary path is a one-tap sms: deep link (lowest
 * friction on mobile). Fallback is a name+phone form for desktop visitors and
 * hesitaters, so we still capture a lead when nobody taps send.
 */
const TextMe = () => {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });

  const onSubmit = (e) => {
    e.preventDefault();
    track('Lead', { source: 'text_form' });
    // TODO: POST { form.name, form.phone } to your lead endpoint. Stubbed for
    // now — swap this block for a fetch() to your endpoint before going live.
    setSent(true);
  };

  return (
    <div className="rounded-2xl border border-edge bg-surface-card p-6 sm:p-8 text-center">
      <p className="font-display text-xl font-semibold text-ink-body mb-2">Text me a question</p>
      <p className="text-ink-muted mb-5 text-pretty">
        Not ready to pick a time? Send a text and I'll answer — no scheduled call needed.
      </p>
      <a
        href={buildSmsHref(SMS_NUMBER, SMS_BODY)}
        onClick={() => track('Lead', { source: 'text_tap' })}
        className="inline-flex items-center justify-center min-h-[52px] px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold shadow-card hover:bg-brand-700 transition-colors"
      >
        Text me
      </a>

      {sent ? (
        <p className="mt-6 text-ink-body font-medium">Thanks — I'll text you shortly.</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 text-left space-y-3">
          <p className="text-sm text-ink-subtle text-center">On a computer? Drop your number and I'll text you.</p>
          <div>
            <label htmlFor="tm-name" className="block text-sm font-medium text-ink-subtle mb-1">Your name</label>
            <input
              id="tm-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-xl border border-edge bg-surface-page px-4 py-2.5 text-ink-body focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label htmlFor="tm-phone" className="block text-sm font-medium text-ink-subtle mb-1">Mobile number</label>
            <input
              id="tm-phone"
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-xl border border-edge bg-surface-page px-4 py-2.5 text-ink-body focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <Button type="submit" variant="secondary" size="md" className="w-full">Text me back</Button>
        </form>
      )}
    </div>
  );
};

const BrightFuturesLanding = () => {
  // Keep this page out of search engines: it's a private, share-by-link page.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = 'Florida SAT Tutoring for Bright Futures';

    // Meta Pixel: load once and fire PageView. Gated on META_PIXEL_ID so this
    // is a clean no-op until the real id is set.
    if (META_PIXEL_ID) {
      /* eslint-disable */
      !(function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
        n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', META_PIXEL_ID);
      window.fbq('track', 'PageView');
    }

    return () => { document.head.removeChild(meta); document.title = prevTitle; };
  }, []);

  return (
    <div className="bf min-h-screen bg-surface-card overflow-x-hidden">
      {/* Nav: brand + single CTA, no ZooPrep links */}
      <nav className="border-b border-edge-subtle sticky top-0 bg-surface-card/90 backdrop-blur z-20">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          <span className="font-display text-lg font-semibold text-ink-body tracking-tight">
            ZooPrep <span className="text-ink-faint font-normal">/ Florida SAT</span>
          </span>
          <BookButton size="sm">Book a call</BookButton>
        </div>
      </nav>

      {/* Hero: lead with the money */}
      <section className="bg-surface-page">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 pt-20 pb-16 text-center">
          <h1 className="font-display text-4xl sm:text-[3.4rem] font-semibold text-ink-body leading-[1.05] tracking-tight mb-6 text-balance">
            A higher SAT score is worth{' '}
            <span className="text-brand-600 dark:text-brand-400">$17,000 to $26,000</span> in
            Florida tuition.
          </h1>
          <p className="text-lg text-ink-muted leading-relaxed mb-9 max-w-2xl mx-auto text-pretty">
            Bright Futures pays 75% of tuition at an SAT of 1190, and 100% at 1330.
            Of the three things it asks for, the score is the one you can still change.
            That's the work we do.
          </p>
          <div className="flex flex-col items-center gap-4">
            <BookButton />
            <a
              href="#book"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
            >
              Prefer to text? Message me &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* Parent testimonial: the trust moment, right after the money hook. */}
      <section className="py-16 bg-surface-card border-b border-edge-subtle">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 text-center">
          <Reveal>
            <p className="text-sm font-medium text-ink-subtle mb-5">
              A parent on what the work actually looked like
            </p>
            <div className="rounded-2xl border border-edge bg-surface-page overflow-hidden shadow-card-md">
              <video
                className="w-full h-auto block bg-black"
                src="/media/parent-testimonial.mp4"
                poster="/media/parent-testimonial-poster.jpg"
                controls
                preload="metadata"
                playsInline
              />
            </div>
            <p className="mt-4 text-sm text-ink-subtle">Imani, parent of a junior in Orlando</p>
          </Reveal>
        </div>
      </section>

      {/* Real results: back the money promise with kids who actually got there. */}
      <section className="py-16 bg-surface-page">
        <div className="max-w-4xl mx-auto px-5 sm:px-6">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink-body tracking-tight mb-8 text-center text-balance">
              Students who hit their cutoff
            </h2>
          </Reveal>
          <Reveal stagger className="grid sm:grid-cols-2 gap-px bg-edge rounded-2xl overflow-hidden border border-edge">
            {[
              { jump: '1020 → 1360', award: 'qualified for 100% tuition' },
              { jump: '910 → 1200', award: 'qualified for 75% tuition' },
            ].map((r) => (
              <div key={r.jump} className="p-7 sm:p-8 bg-surface-card text-center">
                <p className="font-display text-3xl sm:text-4xl font-semibold text-ink-body tabular-nums">{r.jump}</p>
                <p className="mt-2 text-sm font-medium text-brand-700 dark:text-brand-300">{r.award}</p>
              </div>
            ))}
          </Reveal>
          <Reveal>
            <p className="mt-5 text-center text-[13px] text-ink-faint">Recent students, used with permission.</p>
          </Reveal>
        </div>
      </section>

      {/* The award math */}
      <section className="py-20 bg-surface-card border-y border-edge-subtle">
        <div className="max-w-4xl mx-auto px-5 sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink-body tracking-tight mb-3 text-balance">
              What the score is actually worth
            </h2>
            <p className="text-ink-muted mb-10 max-w-2xl text-pretty">
              Bright Futures renews every year you stay eligible, so a single test result can
              decide whether four years of tuition come out of your pocket or the state's.
            </p>
          </Reveal>
          <Reveal stagger className="grid sm:grid-cols-3 gap-px bg-edge rounded-2xl overflow-hidden border border-edge">
            {[
              { tier: 'Below 1190', award: '$0', desc: 'No award. You pay full tuition, around $6,000 to $6,400 a year at a Florida public university.', accent: false },
              { tier: 'SAT 1190', award: '75% of tuition', desc: 'Medallion Scholars. Roughly $4,500 a year, about $17,000 across a degree at a more affordable school.', accent: false },
              { tier: 'SAT 1330', award: '100% of tuition', desc: 'Academic Scholars. A full ride worth up to about $26,000 over a degree, plus the Top Scholars bonus.', accent: true },
            ].map((c) => (
              <div key={c.tier} className={`p-6 sm:p-7 ${c.accent ? 'bg-brand-600' : 'bg-surface-card'}`}>
                <p className={`text-sm font-medium ${c.accent ? 'text-brand-100' : 'text-ink-subtle'}`}>{c.tier}</p>
                <p className={`font-display text-3xl font-semibold mt-1.5 ${c.accent ? 'text-white' : 'text-ink-body'}`}>{c.award}</p>
                <p className={`text-sm leading-relaxed mt-2.5 ${c.accent ? 'text-brand-50' : 'text-ink-muted'}`}>{c.desc}</p>
              </div>
            ))}
          </Reveal>
          <Reveal>
            <p className="mt-7 text-[15px] text-ink-muted max-w-2xl text-pretty">
              Tutoring costs a small fraction of that, and it's the only part of the equation that
              pays you back.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Why the SAT is the lever */}
      <section className="py-20 bg-surface-page">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink-body tracking-tight mb-8 text-balance">
              Three requirements. One you can still move.
            </h2>
          </Reveal>
          <Reveal stagger className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-6 border-b border-edge-subtle pb-5">
              <h3 className="font-display text-xl font-semibold text-ink-body sm:w-44 shrink-0">GPA</h3>
              <p className="text-ink-muted leading-relaxed text-pretty">
                A 3.0 to 3.5 in core courses, built up over years of school. For most students aiming
                at Bright Futures, it's already on track.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-6 border-b border-edge-subtle pb-5">
              <h3 className="font-display text-xl font-semibold text-ink-body sm:w-44 shrink-0">Service hours</h3>
              <p className="text-ink-muted leading-relaxed text-pretty">
                75 to 100 hours. A matter of time and planning, with no skill gap to close.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-6">
              <h3 className="font-display text-xl font-semibold text-brand-700 dark:text-brand-300 sm:w-44 shrink-0">The SAT score</h3>
              <p className="text-ink-body leading-relaxed text-pretty">
                A hard cutoff with no appeals and no waivers. Fall ten points short and the award is
                gone. It's also the piece that responds fastest to focused preparation, which is
                exactly why it's where tutoring earns its keep.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* The method */}
      <section id="method" className="py-20 bg-surface-card border-y border-edge-subtle">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink-body tracking-tight mb-10 text-balance">
              How we close the gap
            </h2>
          </Reveal>
          <Reveal stagger className="space-y-8">
            {[
              { t: 'Start with a real diagnostic', d: 'A full practice test shows the exact distance to 1190 or 1330, broken down by skill rather than a single number.' },
              { t: 'Work the highest-impact skills first', d: 'The plan ranks each weak skill by how much it moves the score and how fast it improves, so early sessions buy the most points.' },
              { t: 'Make the gains hold', d: 'Targeted practice, short mastery checks, and spaced review keep skills sharp through test day instead of fading after a session.' },
              { t: 'Measure against the cutoff', d: 'Every practice test is compared to the last, so progress toward the Bright Futures target is something you can see, not hope for.' },
            ].map((s, i) => (
              <div key={s.t} className="flex gap-5">
                {/* Numbered because these steps genuinely run in sequence, not as decoration. */}
                <span aria-hidden="true" className="font-display text-2xl font-semibold text-brand-400 dark:text-brand-600 leading-none pt-1 w-7 shrink-0 tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold text-ink-body mb-1.5">{s.t}</h3>
                  <p className="text-ink-muted leading-relaxed text-pretty">{s.d}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* The guarantee */}
      <section className="py-20 bg-surface-page">
        <div className="max-w-2xl mx-auto px-5 sm:px-6">
          <Reveal>
            <div className="rounded-2xl border border-brand-300 dark:border-brand-700/60 bg-surface-card p-8 sm:p-10 text-center shadow-card-md">
              <p className="text-sm font-medium text-brand-700 dark:text-brand-300 mb-3">The guarantee</p>
              <h2 className="font-display text-3xl sm:text-[2.5rem] font-semibold text-ink-body tracking-tight mb-4 leading-[1.1] text-balance">
                Reach your target, or your money back.
              </h2>
              <p className="text-ink-muted leading-relaxed text-pretty">
                Hit your Bright Futures goal of 1190 or 1330 on an official SAT, or you get your
                money back. No fine-print runaround.
              </p>
              <p className="mt-5 text-xs text-ink-faint leading-relaxed max-w-md mx-auto">
                {/* TODO: replace with your attorney-reviewed terms before taking money. */}
                Requires attending your scheduled sessions, finishing assigned work and practice
                tests, and sitting an official College Board SAT within the program window. Full
                terms shared before you enroll.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Who you'll work with (PLACEHOLDER: your real bio builds the most trust) */}
      <section className="py-20 bg-surface-card border-y border-edge-subtle">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink-body tracking-tight mb-5 text-balance">
              Who you'll work with
            </h2>
            <div className="rounded-2xl border border-edge bg-surface-page p-6 sm:p-8">
              {/* TODO: add a photo of yourself here — a real face builds more trust than any logo. */}
              <p className="font-display text-xl font-semibold text-ink-body mb-2">Ibrahim Shaqqou</p>
              <p className="text-ink-muted leading-relaxed text-pretty">
                An experienced tutor who recently achieved a high score on the Digital SAT,
                so I know the current format inside out — not the old paper test. My students
                have crossed the Bright Futures cutoffs, like the 1020-to-1360 and 910-to-1200
                jumps above. I built ZooPrep to give every student the same focused, score-first
                method, aimed squarely at the 1190 and 1330 targets.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ: answer the questions in a cold parent's head before they bounce. */}
      <section className="py-20 bg-surface-page">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink-body tracking-tight mb-8 text-balance">
              Questions parents ask
            </h2>
          </Reveal>
          <Reveal stagger className="space-y-3">
            {[
              {
                q: 'What does it cost?',
                a: "Every student's gap is different, so we scope the plan — and the price — together on the free call. What's worth knowing now: tutoring runs a small fraction of a single year of the tuition Bright Futures covers, it's the only part of the equation that pays you back, and it's backed by the money-back guarantee.",
              },
              {
                q: 'How do online sessions work?',
                a: "Sessions run over video with a shared whiteboard, so your student works problems live with me — the same as sitting side by side. Everything is scheduled around their week.",
              },
              {
                q: 'How many sessions will my child need?',
                a: "It depends on the distance from their diagnostic score to their Bright Futures target. The free strategy call maps that gap, and the plan is built around it rather than a one-size package.",
              },
              {
                q: 'Which SAT date should we aim for?',
                a: "We plan backward from an official College Board test date that leaves enough runway to close the gap and, if needed, take a second attempt before eligibility locks.",
              },
              {
                q: 'Is ZooPrep a real company — are you legit?',
                a: "Yes. ZooPrep is my Digital SAT tutoring practice; you can see who you'll work with above, real student results, and a money-back guarantee in writing. The strategy call is free and there's no obligation.",
              },
            ].map((f) => (
              <details key={f.q} className="group rounded-xl border border-edge bg-surface-card px-5 py-4">
                <summary className="flex cursor-pointer items-center justify-between font-display text-lg font-semibold text-ink-body list-none">
                  {f.q}
                  <span aria-hidden="true" className="ml-4 text-ink-faint transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-ink-muted leading-relaxed text-pretty">{f.a}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Book a call */}
      <section id="book" className="py-20 bg-surface-page">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 text-center">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink-body tracking-tight mb-4 text-balance">
              Two easy ways to start
            </h2>
            <p className="text-ink-muted mb-9 max-w-xl mx-auto text-pretty">
              Text me a quick question, or grab a free 15-minute strategy call. We'll map your
              student's distance to their Bright Futures target and lay out a plan to close it.
            </p>
          </Reveal>

          <Reveal className="mb-8">
            <TextMe />
          </Reveal>

          <Reveal>
            <p className="font-display text-xl font-semibold text-ink-body mb-4">Ready to talk? Grab a time.</p>
            {/* To make availability read as demand rather than emptiness, limit
                visible slots in the Cal.com dashboard (Availability hours,
                "minimum notice", and a daily booking cap on this event type) —
                the embed itself just renders whatever the dashboard allows. */}
            {CAL_LINK ? (
              <div className="rounded-2xl border border-edge bg-surface-card overflow-hidden p-2 sm:p-4 text-left">
                <CalEmbed />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-edge p-8">
                <p className="text-ink-muted leading-relaxed">
                  Booking opens once the calendar is connected. For now, email{' '}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-brand-700 dark:text-brand-300 underline">
                    {CONTACT_EMAIL}
                  </a>{' '}
                  to set up a time.
                </p>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* Footer (required trademark disclaimer) */}
      <footer className="bg-[#161311] py-10">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 text-center space-y-3">
          <p className="font-display text-base font-semibold text-[#f5f1ea]">ZooPrep, Florida SAT Tutoring</p>
          <p className="text-xs text-[#a8a097] max-w-2xl mx-auto leading-relaxed text-pretty">
            SAT is a trademark registered and owned by the College Board, which is not affiliated
            with and does not endorse this program. Bright Futures award amounts and eligibility are
            set by the State of Florida and can change; figures shown reflect the 2025-26 and 2026-27
            award years. Tuition figures are approximate, based on published in-state undergraduate
            rates at Florida public universities, and vary by school, course load, and year. Not
            affiliated with the Florida Department of Education.
          </p>
          <p className="text-xs text-[#756d64]">&copy; {new Date().getFullYear()} ZooPrep</p>
        </div>
      </footer>
    </div>
  );
};

export default BrightFuturesLanding;
