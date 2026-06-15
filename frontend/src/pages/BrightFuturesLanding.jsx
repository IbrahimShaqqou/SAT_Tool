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
import { useEffect } from 'react';
import { Button } from '../components/ui';
import useScrollReveal from '../hooks/useScrollReveal';

// TODO: paste your free Cal.com booking link here (e.g. https://cal.com/your-name/strategy-call)
const CALCOM_URL = '';
const CONTACT_EMAIL = 'hello@zooprep.com'; // TODO: your real contact email

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
    if (CALCOM_URL) window.open(CALCOM_URL, '_blank', 'noopener');
    else document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
  };
  return (
    <Button variant="primary" size={size} className={className} onClick={onClick}>
      {children}
    </Button>
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
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <BookButton />
            <Button
              variant="secondary"
              size="lg"
              onClick={() => document.getElementById('method')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See how it works
            </Button>
          </div>
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
                tuition back. No fine-print runaround.
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
            <div className="rounded-2xl border border-dashed border-edge p-6 sm:p-7 text-ink-muted">
              {/* TODO: replace this placeholder with your real name, photo, score, and background.
                   A parent who doesn't know you yet trusts a real person far more than a logo. */}
              <p className="leading-relaxed text-pretty">
                [Your name], [your SAT score and background]. A few honest sentences on who you are,
                why you tutor toward Bright Futures, and the results you stand behind. Add a photo of
                yourself here.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Book a call */}
      <section id="book" className="py-20 bg-surface-page">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 text-center">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink-body tracking-tight mb-4 text-balance">
              Book a free strategy call
            </h2>
            <p className="text-ink-muted mb-9 max-w-xl mx-auto text-pretty">
              Fifteen minutes. We'll look at where your student stands, the distance to their Bright
              Futures target, and whether we're a good fit. No pressure either way.
            </p>
            {CALCOM_URL ? (
              <div className="rounded-2xl border border-edge bg-surface-card overflow-hidden">
                <iframe
                  title="Book a strategy call"
                  src={CALCOM_URL}
                  className="w-full"
                  style={{ height: 680, border: 0 }}
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-edge p-8">
                {/* TODO: set CALCOM_URL above to your free Cal.com link to enable inline booking. */}
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
