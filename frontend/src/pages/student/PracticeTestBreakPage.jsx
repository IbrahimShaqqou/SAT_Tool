/**
 * Practice Test Break — Study Hall.
 * 10-minute break between sections (skippable). Standalone (no AppLayout):
 * renders its own warm page shell. Tokens, dark mode.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Check, X, TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui';
import { getCurrentModule } from '../../services/practiceTestApi';

const sectionName = (moduleNum) => (moduleNum === 1 || moduleNum === 2 ? 'Reading & Writing' : 'Math');

const PracticeTestBreakPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [timeRemaining, setTimeRemaining] = useState(600);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const { currentModule, nextModule, modulePath, message } = location.state || {};

  const handleContinue = async () => {
    if (loading) return;
    try {
      setLoading(true);
      setLoadError(null);
      await getCurrentModule(sessionId);
      navigate(`/student/practice-tests/take/${sessionId}`);
    } catch (err) {
      console.error('Error loading next module:', err);
      setLoadError('Failed to load the next module. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (timeRemaining <= 0) { handleContinue(); return; }
    const timer = setInterval(() => setTimeRemaining((prev) => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining]);

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  const DO = ['Stretch and move around', 'Have a snack or drink water', 'Use the restroom', 'Take a few deep breaths'];
  const DONT = ["Don't review notes or study materials", "Don't use your phone or computer (except to continue)"];

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page p-6">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-edge-subtle bg-surface-card p-8 shadow-card-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent-50 dark:bg-accent-900/30">
              <Check className="h-8 w-8 text-accent-600 dark:text-accent-400" />
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-body">
              {sectionName(currentModule)} section complete
            </h2>
            <p className="mt-1 text-ink-muted">{message || 'Great work. Take a short break before continuing.'}</p>
          </div>

          {modulePath && (
            <div className={`mb-6 rounded-xl p-4 ${modulePath === 'harder' ? 'bg-brand-50 dark:bg-brand-900/25' : 'bg-surface-muted'}`}>
              <div className="flex items-start gap-2">
                <TrendingUp className={`mt-0.5 h-5 w-5 shrink-0 ${modulePath === 'harder' ? 'text-brand-700 dark:text-brand-400' : 'text-ink-subtle'}`} />
                <div>
                  <p className="font-semibold text-ink-body">{modulePath === 'harder' ? 'Advanced module selected' : 'Standard module selected'}</p>
                  <p className="text-sm text-ink-muted">
                    {modulePath === 'harder'
                      ? "Based on your strong Module 1 performance, you'll take the harder Module 2."
                      : "You'll continue with Module 2."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Timer */}
          <div className="mb-6 rounded-xl bg-surface-muted p-6 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Break time remaining</p>
            <div className="font-display text-5xl font-semibold tabular-nums text-ink-body">{formatTime(timeRemaining)}</div>
            <p className="mt-2 text-sm text-ink-subtle">10-minute break (skippable)</p>
          </div>

          {/* Up next */}
          <div className="mb-6 rounded-xl border border-edge-subtle bg-surface-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Up next</p>
            <p className="mt-0.5 font-medium text-ink-body">{sectionName(nextModule)} · Module {nextModule % 2 === 0 ? 2 : 1}</p>
          </div>

          <Button variant="primary" size="lg" className="w-full" onClick={handleContinue} loading={loading}>
            {loading ? 'Loading…' : <>Continue to next section <ArrowRight className="h-4 w-4" /></>}
          </Button>
          {loadError && <p role="alert" className="mt-2 text-center text-sm text-rose-600 dark:text-rose-400">{loadError}</p>}
          <p className="mt-2 text-center text-sm text-ink-subtle">Or wait for the timer to continue automatically.</p>
        </div>

        {/* Tips */}
        <div className="mt-6 rounded-2xl border border-edge-subtle bg-surface-card p-6 shadow-card">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-body">Break recommendations</h3>
          <ul className="space-y-2 text-sm text-ink-muted">
            {DO.map((t) => (
              <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400" /><span>{t}</span></li>
            ))}
            {DONT.map((t) => (
              <li key={t} className="flex items-start gap-2"><X className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" /><span>{t}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PracticeTestBreakPage;
