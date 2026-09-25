/**
 * Bright Futures landing page (/fl): a standalone marketing page for landing
 * Florida tutoring clients. Not linked anywhere in ZooPrep and noindex'd, so it's
 * only reachable via a direct link you share.
 *
 * Sections: nav, hero (money + guarantee badge), stat strip (dark), results +
 * proof, award math (dark), how it works + Step Up angle, FAQ (dark), book, footer.
 *
 * Official Bright Futures figures (FL OSFA, 2025-26 and 2026-27 grads):
 *   FAS: SAT 1330, 3.5 core GPA, about 100% tuition
 *   FMS: SAT 1190, 3.0 core GPA, 75% tuition
 */
import { useEffect, useState } from 'react';
import * as rrweb from 'rrweb';
import useScrollReveal from '../hooks/useScrollReveal';

// Cal.com booking.
const CAL_LINK = 'ibraheem-shaqqou-4nfkww/booking';
const CALCOM_URL = `https://cal.com/${CAL_LINK}`;
const CONTACT_EMAIL = 'hello@zooprep.com';
const CAL_BRAND = '#bf7724';

// --- Conversion: text-me deep link + Meta Pixel ---------------------------

export const SMS_NUMBER = '14075887558';
export const SMS_BODY =
  "Hi Ibrahim, I saw your Bright Futures page [FL] and I'd like to know about SAT tutoring for my child.";

export function buildSmsHref(number, body) {
  return `sms:${number}?&body=${encodeURIComponent(body)}`;
}

const META_PIXEL_ID = '1647782246959242';
const FORMSPREE_URL = 'https://formspree.io/f/mnpnqwjn';

export function track(event, params) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', event, params);
  }
}

// Upcoming official SAT dates — update when College Board publishes new dates.
const SAT_DATES = [
  { label: 'Nov 7 SAT', date: new Date('2026-11-07') },
  { label: 'Dec 6 SAT', date: new Date('2026-12-06') },
];

function daysUntil(target) {
  const now = new Date();
  const diff = target - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const CountdownDays = ({ label, date }) => {
  const [days, setDays] = useState(() => daysUntil(date));
  useEffect(() => {
    const t = setInterval(() => setDays(daysUntil(date)), 60000);
    return () => clearInterval(t);
  }, [date]);
  if (days <= 0) return null;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-display text-2xl sm:text-3xl font-bold text-white tabular-nums leading-none">{days}</span>
      <span className="text-xs text-[#a8a097] font-medium uppercase tracking-wide">days · {label}</span>
    </div>
  );
};

const CalEmbed = () => {
  useEffect(() => {
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
    Cal.ns.booking('on', {
      action: 'bookingSuccessful',
      callback: () => track('Lead', { source: 'booking' }),
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

// Primary CTA — always the SMS deep link.
const TextCTA = ({ size = 'lg', className = '' }) => {
  const sizeClasses = size === 'lg'
    ? 'min-h-[56px] px-8 py-4 text-lg'
    : size === 'md'
    ? 'min-h-[48px] px-6 py-3 text-base'
    : 'min-h-[40px] px-5 py-2.5 text-sm';
  return (
    <a
      href={buildSmsHref(SMS_NUMBER, SMS_BODY)}
      onClick={() => track('Lead', { source: 'text_tap' })}
      className={`inline-flex items-center justify-center gap-2 ${sizeClasses} rounded-xl bg-brand-600 text-white font-bold shadow-glow hover:bg-brand-700 active:bg-brand-800 transition-colors ${className}`}
    >
      Text me a question
      <span aria-hidden="true">→</span>
    </a>
  );
};

// Secondary CTA — opens Cal.com in a new tab.
const BookButton = ({ size = 'md', children = 'Book a free strategy call', className = '' }) => {
  const onClick = () => {
    track('Lead', { source: 'book' });
    if (CALCOM_URL) window.open(CALCOM_URL, '_blank', 'noopener');
    else document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
  };
  const sizeClasses = size === 'lg'
    ? 'min-h-[52px] px-7 py-3.5 text-base'
    : size === 'sm'
    ? 'min-h-[36px] px-4 py-2 text-sm'
    : 'min-h-[44px] px-6 py-3 text-sm';
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center ${sizeClasses} rounded-xl border border-edge bg-surface-card text-ink-muted font-semibold hover:bg-surface-muted hover:border-edge-strong transition-colors ${className}`}
    >
      {children}
    </button>
  );
};

const TextMe = () => {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });

  const onSubmit = async (e) => {
    e.preventDefault();
    track('Lead', { source: 'text_form' });
    if (FORMSPREE_URL) {
      try {
        await fetch(FORMSPREE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name: form.name, phone: form.phone, _subject: 'New FL lead' }),
        });
      } catch (_) {}
    }
    setSent(true);
  };

  return (
    <div className="rounded-2xl border border-edge bg-surface-card p-6 sm:p-8 text-center">
      <p className="font-display text-xl font-bold text-ink-body mb-2">Text me a question</p>
      <p className="text-ink-muted mb-5 text-pretty">
        Not ready to pick a time? Send a text and I'll reply. No call needed.
      </p>
      <TextCTA size="md" className="w-full justify-center" />

      {sent ? (
        <p className="mt-6 text-ink-body font-medium">Thanks. I'll text you shortly.</p>
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
          <button type="submit" className="w-full min-h-[44px] px-6 py-3 rounded-xl border border-edge bg-surface-card text-ink-muted text-sm font-semibold hover:bg-surface-muted transition-colors">
            Text me back
          </button>
        </form>
      )}
    </div>
  );
};

// Sticky bar: text-me primary on mobile, floating on desktop.
const StickyTextCTA = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <div
        className={`sm:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-card/95 backdrop-blur border-t border-edge px-4 py-3 transition-transform duration-300 ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <TextCTA size="lg" className="w-full justify-center" />
      </div>
      <div
        className={`hidden sm:block fixed bottom-6 right-6 z-30 shadow-card-md transition-all duration-300 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <TextCTA size="md" />
      </div>
    </>
  );
};

const BrightFuturesLanding = () => {
  useEffect(() => {
    const sessionId = `fl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const API = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
    const events = [];
    let startTime = Date.now();

    const stopRecording = rrweb.record({
      emit(event) { events.push(event); },
      inlineStylesheet: false,
      collectFonts: false,
    });

    const send = (batch, useBeacon = false) => {
      if (!batch.length) return;
      const payload = JSON.stringify({
        session_id: sessionId,
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        events: batch,
        duration_ms: Date.now() - startTime,
      });
      if (useBeacon) {
        navigator.sendBeacon(`${API}/replays/events`, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(`${API}/replays/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        }).catch(() => {});
      }
    };

    const flush = () => send(events.splice(0), false);
    const flushOnExit = () => send(events.splice(0), true);
    const interval = setInterval(flush, 5000);
    window.addEventListener('pagehide', flushOnExit);

    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = 'Florida SAT Tutoring for Bright Futures';

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

    return () => {
      stopRecording();
      clearInterval(interval);
      window.removeEventListener('pagehide', flushOnExit);
      flush();
      document.head.removeChild(meta);
      document.title = prevTitle;
    };
  }, []);

  return (
    <div className="bf min-h-screen bg-surface-page overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="border-b border-edge-subtle sticky top-0 bg-surface-card/90 backdrop-blur z-20">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          <span className="font-display text-lg font-semibold text-ink-body tracking-tight">
            ZooPrep <span className="text-ink-faint font-normal">/ Florida SAT</span>
          </span>
          <div className="flex items-center gap-4">
            <a
              href={`tel:${SMS_NUMBER}`}
              onClick={() => track('Lead', { source: 'nav_phone' })}
              className="hidden sm:block text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors"
            >
              (407) 588-7558
            </a>
            <BookButton size="sm">Book a call</BookButton>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="bg-surface-page">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 pt-20 pb-16 text-center">
          <Reveal>
            {/* Guarantee badge — strongest trust signal, visible before any scroll */}
            <div className="inline-flex items-center gap-2 bg-accent-50 border border-accent-200 rounded-full px-4 py-1.5 mb-6">
              <span className="text-accent-600 text-sm font-bold">✓</span>
              <span className="text-accent-700 text-sm font-semibold">Money-back guarantee</span>
            </div>

            <h1 className="font-display text-4xl sm:text-[3.4rem] font-bold text-ink-body leading-[1.05] tracking-tight mb-6 text-balance">
              A higher SAT score is worth{' '}
              <span className="text-brand-600">$17,000 to $26,000</span> in
              Florida tuition.
            </h1>
            <p className="text-lg text-ink-muted leading-relaxed mb-9 max-w-2xl mx-auto text-pretty">
              Bright Futures pays 75% of tuition at 1190, and 100% at 1330.
              Of the three things it asks for, the score is the one you can still change.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <TextCTA size="lg" />
              <a
                href="#book"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-sm font-semibold text-ink-subtle hover:text-ink-body transition-colors"
              >
                or pick a time ↓
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Stat strip (dark) ── */}
      <div className="bg-[#1a1410] border-y border-[#2e261f]">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-8">
          <div className="flex flex-wrap justify-center gap-8 sm:gap-12">
            {SAT_DATES.map(({ label, date }) => (
              <CountdownDays key={label} label={label} date={date} />
            ))}
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-display text-2xl sm:text-3xl font-bold text-white leading-none">100%</span>
              <span className="text-xs text-[#a8a097] font-medium uppercase tracking-wide">tuition · SAT 1330</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-display text-2xl sm:text-3xl font-bold text-[#c9956b] leading-none">✓</span>
              <span className="text-xs text-[#a8a097] font-medium uppercase tracking-wide">money-back guarantee</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Results + Social proof ── */}
      <section className="py-14 bg-surface-card border-b border-edge-subtle">
        <div className="max-w-4xl mx-auto px-5 sm:px-6">

          {/* Video testimonial */}
          <Reveal className="mb-12">
            <p className="text-sm font-medium text-ink-subtle mb-5 text-center">
              A parent on what the work actually looked like
            </p>
            <div className="mx-auto w-full max-w-[300px] sm:max-w-[340px] rounded-2xl border border-edge bg-black overflow-hidden shadow-card-md">
              <video
                className="w-full h-auto block aspect-[9/16]"
                src="/media/parent-testimonial.mp4#t=0.1"
                controls
                preload="metadata"
                playsInline
              />
            </div>
            <p className="mt-4 text-sm text-ink-subtle text-center">Imani, parent of a junior in Orlando</p>
          </Reveal>

          {/* Score stories — narrative beats bare stats */}
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-body tracking-tight mb-6 text-center">
              Students who hit their cutoff
            </h2>
          </Reveal>
          <Reveal stagger className="grid sm:grid-cols-2 gap-4 mb-12">
            {[
              {
                jump: '1020 → 1360',
                award: '100% tuition — Academic Scholars',
                story: 'After 10 sessions over 12 weeks, Marcus tested in October and cleared 1330. He qualified for a full ride.',
              },
              {
                jump: '910 → 1200',
                award: '75% tuition — Medallion Scholars',
                story: 'After 8 sessions over 10 weeks, Sofia tested in November and cleared 1190. That\'s $17,000 in tuition off the table.',
              },
            ].map((r) => (
              <div key={r.jump} className="rounded-2xl border border-edge bg-surface-page p-6 sm:p-7">
                <p className="font-display text-3xl font-bold text-ink-body tabular-nums mb-1">{r.jump}</p>
                <p className="text-sm font-semibold text-brand-700 mb-3">{r.award}</p>
                <p className="text-sm text-ink-muted leading-relaxed">{r.story}</p>
              </div>
            ))}
          </Reveal>
          <Reveal>
            <p className="text-center text-[13px] text-ink-faint mb-12">Recent students, used with permission.</p>
          </Reveal>

          {/* Parent + student quotes */}
          <Reveal>
            <p className="text-sm font-medium text-ink-subtle mb-6 text-center">What parents and students say</p>
          </Reveal>
          <Reveal stagger className="grid sm:grid-cols-3 gap-4">
            {[
              {
                quote: "We were 80 points short of Medallion and had one semester left. After ten sessions her score jumped 140 points. That was $17,000 in tuition we didn't have to spend.",
                name: 'Maria G.',
                detail: 'Parent of a 2026 grad, Tampa',
              },
              {
                quote: "What surprised me was how targeted the sessions were. No fluff, no re-teaching things she already knew. Just the skills she needed for 1330. She got there in two months.",
                name: 'David L.',
                detail: 'Parent, Jacksonville',
              },
              {
                quote: "I took the SAT twice on my own and couldn't break 1200. Three months with ZooPrep and I hit 1340. I didn't think I was a test person until I understood what the test was actually asking.",
                name: 'Aaliyah T.',
                detail: 'Student, class of 2027, Orlando',
              },
            ].map((q) => (
              <div key={q.name} className="rounded-2xl border border-edge bg-surface-card p-6 flex flex-col gap-4">
                <p className="text-ink-body leading-relaxed text-[15px] text-pretty flex-1">"{q.quote}"</p>
                <div>
                  <p className="text-sm font-semibold text-ink-body">{q.name}</p>
                  <p className="text-xs text-ink-subtle">{q.detail}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Award math (dark) ── */}
      <section className="py-14 bg-[#1a1410]">
        <div className="max-w-4xl mx-auto px-5 sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3 text-balance">
              What the score is actually worth
            </h2>
            <p className="text-[#d6cfc4] mb-8 max-w-2xl text-pretty">
              Bright Futures renews every year you stay eligible — a single test result decides
              whether four years of tuition come out of your pocket or the state's.
            </p>
          </Reveal>
          <Reveal stagger className="grid sm:grid-cols-3 gap-3">
            {[
              { tier: 'Below 1190', award: '$0', desc: 'No award. You pay full tuition, around $6,000–$6,400 a year at a Florida public university.', highlight: false },
              { tier: 'SAT 1190', award: '75% of tuition', desc: 'Medallion Scholars. Roughly $4,500 a year — about $17,000 across a degree.', highlight: false },
              { tier: 'SAT 1330', award: '100% of tuition', desc: 'Academic Scholars. A full ride worth up to $26,000 over a degree, plus the Top Scholars bonus.', highlight: true },
            ].map((c) => (
              <div key={c.tier} className={`rounded-2xl p-6 sm:p-7 ${c.highlight ? 'bg-brand-600' : 'bg-[#272018] border border-[#3d3428]'}`}>
                <p className={`text-sm font-medium ${c.highlight ? 'text-brand-100' : 'text-[#a8a097]'}`}>{c.tier}</p>
                <p className={`font-display text-3xl font-bold mt-1.5 ${c.highlight ? 'text-white' : 'text-white'}`}>{c.award}</p>
                <p className={`text-sm leading-relaxed mt-2.5 ${c.highlight ? 'text-brand-50' : 'text-[#d6cfc4]'}`}>{c.desc}</p>
              </div>
            ))}
          </Reveal>
          <Reveal>
            <p className="mt-6 text-[#a8a097] text-sm max-w-2xl text-pretty">
              Tutoring costs a fraction of a single year of what Bright Futures covers — and it's
              backed by a money-back guarantee if you don't hit your target.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-14 bg-surface-page">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink-body tracking-tight mb-8 text-balance">
              How we close the gap
            </h2>
          </Reveal>
          <Reveal stagger className="space-y-6 mb-10">
            {[
              { t: 'Start with a real diagnostic', d: 'A full practice test maps the exact distance to 1190 or 1330, broken down by skill — not just a single number.' },
              { t: 'Work the highest-impact skills first', d: 'Each skill is ranked by how much it moves the score and how fast it improves, so early sessions buy the most points.' },
              { t: 'Make the gains hold', d: 'Targeted practice, mastery checks, and spaced review keep skills sharp through test day.' },
              { t: 'Measure against the cutoff', d: 'Every practice test is compared to the last, so progress toward the Bright Futures target is something you can see.' },
            ].map((s, i) => (
              <div key={s.t} className="flex gap-5">
                <span aria-hidden="true" className="font-display text-2xl font-bold text-brand-400 leading-none pt-1 w-7 shrink-0 tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink-body mb-1">{s.t}</h3>
                  <p className="text-ink-muted leading-relaxed text-pretty text-sm">{s.d}</p>
                </div>
              </div>
            ))}
          </Reveal>

          {/* Step Up angle — unclaimed territory in the market */}
          <Reveal>
            <div className="rounded-2xl border border-brand-300 bg-brand-50 p-6 sm:p-7">
              <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">Most families don't know this</p>
              <p className="font-display text-lg font-bold text-ink-body mb-2">
                Step Up for Students funds may cover the cost of tutoring.
              </p>
              <p className="text-sm text-ink-muted leading-relaxed text-pretty">
                If your student receives a Step Up for Students or FES scholarship, those funds can
                often be used for SAT prep. Bring it up on the strategy call — many families who
                thought tutoring was out of reach find it's already paid for.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ (dark) ── */}
      <section className="py-14 bg-[#1a1410]">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-8 text-balance">
              Questions parents ask
            </h2>
          </Reveal>
          <Reveal stagger className="space-y-3">
            {[
              {
                q: 'What does it cost?',
                a: "Every student's gap is different, so we scope the plan and the price together on the free call. What's worth knowing now: tutoring runs a fraction of what a single year of Bright Futures covers, it's the only part of the equation that pays you back, and it's backed by the money-back guarantee. If you receive Step Up for Students funds, those may cover the cost entirely.",
              },
              {
                q: 'What is the money-back guarantee?',
                a: "Hit your Bright Futures target of 1190 or 1330 on an official SAT, or you get your money back. Requires attending sessions, completing assigned practice tests, and sitting an official College Board SAT within the program window. Full terms are shared before you enroll.",
              },
              {
                q: 'How do online sessions work?',
                a: "Sessions run over video with a shared whiteboard, so your student works problems live — the same as sitting side by side. Everything is scheduled around their week.",
              },
              {
                q: 'How many sessions will my child need?',
                a: "It depends on the distance from their diagnostic score to their Bright Futures target. The free strategy call maps that gap and builds a plan around it — not a one-size package.",
              },
              {
                q: 'Which SAT date should we aim for?',
                a: "We plan backward from an official College Board test date that leaves enough runway to close the gap and, if needed, take a second attempt. The Nov 7 and Dec 6 dates are both in range for students starting now.",
              },
              {
                q: 'Is ZooPrep a real company? Are you legit?',
                a: "Yes. ZooPrep is a Digital SAT tutoring practice. You can see real student results, a money-back guarantee in writing above, and a free strategy call with no obligation to enroll.",
              },
            ].map((f) => (
              <details key={f.q} className="group rounded-xl border border-[#3d3428] bg-[#221d18] px-5 py-4">
                <summary className="flex cursor-pointer items-center justify-between font-display text-base font-bold text-white list-none">
                  {f.q}
                  <span aria-hidden="true" className="ml-4 text-[#756d64] transition-transform group-open:rotate-45 shrink-0">+</span>
                </summary>
                <p className="mt-3 text-[#d6cfc4] leading-relaxed text-pretty text-sm">{f.a}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Book / Contact ── */}
      <section id="book" className="py-14 bg-surface-page">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 text-center">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink-body tracking-tight mb-4 text-balance">
              Two easy ways to start
            </h2>
            <p className="text-ink-muted mb-8 max-w-xl mx-auto text-pretty">
              Text me a quick question, or grab a free 15-minute strategy call. We'll map your
              student's distance to their Bright Futures target and build a plan to close it.
            </p>
          </Reveal>

          <Reveal className="mb-10">
            <TextMe />
          </Reveal>

          <Reveal>
            <p className="font-display text-xl font-bold text-ink-body mb-4">Ready to talk? Grab a time.</p>
            {CAL_LINK ? (
              <div className="rounded-2xl border border-edge bg-surface-card overflow-hidden p-2 sm:p-4 text-left">
                <CalEmbed />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-edge p-8">
                <p className="text-ink-muted leading-relaxed">
                  Booking opens once the calendar is connected. For now, email{' '}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-brand-700 underline">
                    {CONTACT_EMAIL}
                  </a>{' '}
                  to set up a time.
                </p>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      <StickyTextCTA />

      {/* Footer */}
      <footer className="bg-[#161311] py-10 pb-28 sm:pb-10">
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
