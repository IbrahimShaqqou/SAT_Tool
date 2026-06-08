/**
 * JoinPage — a tutor's reusable roster link target (/join/:code).
 *
 * - Logged-in student: attaches to the tutor and goes to the dashboard.
 * - Logged-out visitor: shows whose roster this is, with Sign up / Log in
 *   buttons that return here after auth (via location.state.from) to finish
 *   attaching.
 * - Logged-in tutor/other: gentle message (can't join as a tutor).
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { joinService } from '../services/joinService';
import { Button } from '../components/ui';

const JoinPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [tutorName, setTutorName] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | invalid | prompt | joining | done | not_student
  const [error, setError] = useState(null);

  const from = { pathname: `/join/${code}` };

  // Resolve who this link belongs to.
  useEffect(() => {
    let active = true;
    joinService.getJoinInfo(code)
      .then((res) => { if (active) setTutorName(res.data.tutor_name); })
      .catch(() => { if (active) { setStatus('invalid'); } });
    return () => { active = false; };
  }, [code]);

  const attach = useCallback(async () => {
    setStatus('joining');
    try {
      const res = await joinService.join(code);
      setStatus('done');
      // Brief beat so the success message is visible, then go to the dashboard.
      setTimeout(() => navigate('/student', { replace: true }), 1200);
      return res;
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Could not join. Please try again.';
      setError(detail);
      setStatus('prompt');
    }
  }, [code, navigate]);

  // Once auth state is known and the link is valid, decide what to do.
  useEffect(() => {
    if (authLoading || status === 'invalid' || tutorName === null) return;
    if (status !== 'loading') return; // don't re-trigger after a transition
    if (!user) {
      setStatus('prompt');
    } else if (user.role?.toLowerCase() === 'student') {
      attach();
    } else {
      setStatus('not_student');
    }
  }, [authLoading, user, tutorName, status, attach]);

  const Shell = ({ children }) => (
    <div className="min-h-screen flex items-center justify-center bg-surface-page px-5">
      <div className="w-full max-w-md rounded-2xl border border-edge bg-surface-card p-8 text-center shadow-card-md">
        <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600">
          <span className="font-display text-lg font-bold text-white">Z</span>
        </div>
        {children}
      </div>
    </div>
  );

  if (status === 'invalid') {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-semibold text-ink-body">Link not found</h1>
        <p className="mt-2 text-sm text-ink-muted">
          This join link is invalid or no longer active. Ask your tutor for a fresh link.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline">
          Go to ZooPrep
        </Link>
      </Shell>
    );
  }

  if (status === 'loading' || tutorName === null) {
    return <Shell><p className="text-sm text-ink-muted">Loading…</p></Shell>;
  }

  if (status === 'not_student') {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-semibold text-ink-body">You're signed in as a tutor</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Join links are for students. Log out and sign in with a student account to join {tutorName}'s roster.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline">
          Go to your dashboard
        </Link>
      </Shell>
    );
  }

  if (status === 'joining') {
    return <Shell><p className="text-sm text-ink-muted">Joining {tutorName}'s roster…</p></Shell>;
  }

  if (status === 'done') {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-semibold text-ink-body">You're all set</h1>
        <p className="mt-2 text-sm text-ink-muted">
          You've joined {tutorName}'s roster. Taking you to your dashboard…
        </p>
      </Shell>
    );
  }

  // status === 'prompt' (logged out)
  return (
    <Shell>
      <h1 className="font-display text-2xl font-semibold text-ink-body">
        Join {tutorName} on ZooPrep
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Create your student account (or log in) to connect with {tutorName} and start practicing.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-col gap-3">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => navigate('/register', { state: { from, role: 'student' } })}
        >
          Create my account
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={() => navigate('/login', { state: { from } })}
        >
          I already have an account
        </Button>
      </div>
    </Shell>
  );
};

export default JoinPage;
