/**
 * Landing Page — premium, scroll-animated, distinctive
 */
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useScrollReveal from '../hooks/useScrollReveal';
import {
  Brain, GraduationCap, ArrowRight,
  CheckCircle2, BarChart3, Sparkles, TrendingUp,
  Target, Zap,
} from 'lucide-react';
import { Button } from '../components/ui';

// Organic blob SVG — ZooPrep's personality element
const Blob = ({ className }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path fill="currentColor" d="M38.5,-65.2C50.2,-56.7,60.3,-47.1,68.1,-35C75.9,-22.9,81.3,-8.3,79.8,5.5C78.3,19.3,69.9,32.4,60.1,43.1C50.3,53.9,39.2,62.4,26.5,68.2C13.8,74.1,-0.5,77.3,-14.3,74.2C-28.1,71.1,-41.3,61.7,-52.1,50C-62.9,38.3,-71.2,24.3,-73.5,9C-75.8,-6.3,-72,-22.9,-63.7,-36.3C-55.4,-49.7,-42.6,-59.9,-29,-66.6C-15.5,-73.3,-1.1,-76.5,12.3,-75.5C25.7,-74.5,26.9,-73.8,38.5,-65.2Z" transform="translate(100 100)" />
  </svg>
);

const Blob2 = ({ className }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path fill="currentColor" d="M47.5,-73.7C60.6,-66.3,70,-52.4,76.3,-37.5C82.5,-22.7,85.5,-7,83.2,7.9C80.9,22.9,73.2,37.1,62.5,47.5C51.8,57.9,38.1,64.5,23.6,69.8C9.1,75.1,-6.2,79.1,-20.8,76.5C-35.3,73.9,-49.1,64.7,-59.2,52.4C-69.4,40.1,-75.8,24.7,-77.5,8.5C-79.1,-7.7,-76.1,-24.7,-68.1,-38.6C-60.2,-52.4,-47.4,-63.2,-33.4,-70C-19.4,-76.8,-4.2,-79.7,10,-78.9C24.2,-78,34.4,-81.1,47.5,-73.7Z" transform="translate(100 100)" />
  </svg>
);

// Reusable scroll-reveal wrapper
const Reveal = ({ children, className = '', stagger = false }) => {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`${stagger ? 'reveal-stagger' : 'reveal'} ${className}`}>
      {children}
    </div>
  );
};

const LandingPage = () => {
  const { user, isLoading } = useAuth();

  // Logged-in users go straight to their dashboard
  if (user && !isLoading) {
    const dashboardPath = user.role?.toLowerCase() === 'tutor' ? '/tutor' : '/student';
    return <Navigate to={dashboardPath} replace />;
  }

  return (
    <div className="min-h-screen bg-surface-card overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="border-b border-edge-subtle sticky top-0 bg-surface-card/90 backdrop-blur z-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">Z</span>
            </div>
            <span className="text-[14px] font-semibold text-ink-body tracking-tight">ZooPrep</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/questions" className="hidden sm:block text-sm text-ink-subtle hover:text-ink-body transition-colors">Questions</Link>
            <Link to="/lessons" className="hidden sm:block text-sm text-ink-subtle hover:text-ink-body transition-colors mr-1">Lessons</Link>
            <Link to="/login"><Button variant="secondary" size="sm">Log In</Button></Link>
            <Link to="/register"><Button variant="primary" size="sm">Get Started</Button></Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-surface-page">
        {/* Blob decorations */}
        <Blob className="absolute -right-20 top-0 w-[420px] h-[420px] text-brand-200/50 dark:text-brand-700/30 pointer-events-none" />
        <Blob2 className="absolute -left-32 bottom-0 w-[300px] h-[300px] text-accent-100/60 dark:text-accent-800/30 pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-6 pt-20 pb-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 bg-surface-card border border-brand-200 dark:border-brand-700/50 rounded-full px-3.5 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300 mb-6 shadow-sm">
              <Sparkles className="h-3 w-3" />
              3,271 questions · AI step-by-step explanations
            </div>
            <h1 className="text-5xl sm:text-6xl font-extrabold text-ink-body leading-[1.08] tracking-tight mb-5">
              Score higher on the{' '}
              <span className="text-brand-600 dark:text-brand-400">Digital SAT.</span>
            </h1>
            <p className="text-lg text-ink-subtle leading-relaxed mb-8 max-w-xl">
              Adaptive practice that adjusts to your level, AI explanations for every question,
              and expert lessons for every skill — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/register">
                <Button variant="primary" size="lg" className="w-full sm:w-auto px-7">
                  Start for free <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/questions">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto px-7">
                  Browse questions
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-edge-subtle bg-surface-card">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-7">
          <Reveal stagger className="flex flex-wrap justify-around gap-6 text-center">
            {[
              { n: '3,271', label: 'Practice questions' },
              { n: '40+', label: 'Skill areas' },
              { n: '100%', label: 'Digital SAT format' },
              { n: 'Free', label: 'To get started' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">{s.n}</div>
                <div className="text-sm text-ink-subtle mt-0.5">{s.label}</div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 bg-surface-page">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <Reveal>
            <div className="mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-ink-body tracking-tight">
                Built for how students actually prepare
              </h2>
              <p className="mt-2 text-ink-subtle text-lg max-w-xl">
                Not a question dump. A structured path from diagnosis to score improvement.
              </p>
            </div>
          </Reveal>
          <Reveal stagger className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Brain, iconBg: 'bg-brand-100 dark:bg-brand-900/40', iconColor: 'text-brand-600 dark:text-brand-300',
                title: 'Adaptive Practice',
                desc: 'The algorithm tracks your exact ability level per skill and serves questions at the right difficulty — so no time is wasted on questions too easy or impossible.',
                link: '/register', linkText: 'Try it',
              },
              {
                icon: Sparkles, iconBg: 'bg-accent-100 dark:bg-accent-900/40', iconColor: 'text-accent-600 dark:text-accent-300',
                title: 'AI Explanations',
                desc: 'Every question has a structured step-by-step breakdown: worked math, highlighted reading evidence, grammar rule naming, and why each wrong choice fails.',
                link: '/questions', linkText: 'See an example',
              },
              {
                icon: GraduationCap, iconBg: 'bg-violet-100 dark:bg-violet-900/40', iconColor: 'text-violet-600 dark:text-violet-300',
                title: 'Expert Skill Lessons',
                desc: 'Interactive lessons with Desmos-powered graphs, worked examples, and embedded practice for every SAT skill — not just video walkthroughs.',
                link: '/lessons', linkText: 'Browse lessons',
              },
            ].map((f) => (
              <div key={f.title} className="bg-surface-card rounded-2xl p-6 shadow-card flex flex-col">
                <div className={`w-10 h-10 ${f.iconBg} rounded-xl flex items-center justify-center mb-4`}>
                  <f.icon className={`h-5 w-5 ${f.iconColor}`} />
                </div>
                <h3 className="font-semibold text-ink-body mb-2">{f.title}</h3>
                <p className="text-sm text-ink-subtle leading-relaxed flex-1">{f.desc}</p>
                <Link to={f.link} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
                  {f.linkText} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 bg-surface-card border-t border-edge-subtle">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <Reveal>
            <h2 className="text-3xl font-bold text-ink-body tracking-tight mb-12">How it works</h2>
          </Reveal>
          <Reveal stagger className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { n: '01', icon: Target, title: 'Intake assessment', desc: 'A short diagnostic pins your exact skill gaps across all SAT domains.' },
              { n: '02', icon: BarChart3, title: 'Skill breakdown', desc: 'See mastery % for every skill. Know exactly what to focus on.' },
              { n: '03', icon: Zap, title: 'Targeted drills', desc: 'Adaptive practice focuses your time on the highest-impact skills.' },
              { n: '04', icon: TrendingUp, title: 'Score progress', desc: 'Track accuracy improvements and watch your estimated score climb.' },
            ].map((step) => (
              <div key={step.n}>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400 dark:text-brand-500 mb-3 block">{step.n}</span>
                <div className="w-9 h-9 bg-brand-50 dark:bg-brand-900/40 rounded-xl flex items-center justify-center mb-3">
                  <step.icon className="h-4.5 w-4.5 text-brand-600 dark:text-brand-300" style={{ width: 18, height: 18 }} />
                </div>
                <h3 className="font-semibold text-ink-body text-sm mb-1">{step.title}</h3>
                <p className="text-sm text-ink-subtle leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── What's included ── */}
      <section className="py-20 relative overflow-hidden bg-surface-page">
        <Blob className="absolute right-0 top-1/2 -translate-y-1/2 w-72 h-72 text-brand-100/70 dark:text-brand-700/30 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-10">
          <Reveal>
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold text-ink-body tracking-tight mb-8">Everything you need</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  '3,271 real Digital SAT questions',
                  'AI step-by-step explanations for every question',
                  'Built-in Desmos graphing calculator',
                  'Expert lessons for every tested skill',
                  'Adaptive practice adjusting to your level',
                  'Full progress tracking and skill breakdown',
                  'Tutor dashboard and assigned practice',
                  'Works on any device',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-accent-500 dark:text-accent-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-ink-muted">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-brand-600 py-20">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 text-center">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
              Start preparing smarter today
            </h2>
            <p className="text-brand-100 mb-8">Free to get started. No credit card required.</p>
            <Link to="/register">
              <button className="inline-flex items-center gap-2 bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-brand-50 transition-colors">
                Create free account <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 dark:bg-slate-950 py-8">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-500 flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">Z</span>
            </div>
            <span className="text-sm font-semibold text-white">ZooPrep</span>
          </div>
          <div className="flex gap-5 text-sm text-slate-400">
            <Link to="/questions" className="hover:text-white transition-colors">Questions</Link>
            <Link to="/lessons" className="hover:text-white transition-colors">Lessons</Link>
            <Link to="/login" className="hover:text-white transition-colors">Log In</Link>
          </div>
          <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} ZooPrep</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
