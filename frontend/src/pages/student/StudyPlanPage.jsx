/**
 * Study Plan — entry point.
 *
 * The plan is now import-driven: it lives on each practice-test result (the Plan
 * tab). This page routes the student to their most recent test's plan, or to the
 * Practice Tests page (to import their first test) when they have none. Replaces
 * the old mastery-derived study-plan checklist.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ArrowRight } from 'lucide-react';
import { Button, PageHeader, Skeleton } from '../../components/ui';
import { listMyResults } from '../../services/practiceTestApi';

const StudyPlanPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasNone, setHasNone] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const results = await listMyResults();
        if (!active) return;
        if (results && results.length > 0) {
          // Newest first (the API sorts this way) → that test's plan tab.
          navigate(`/student/practice-tests/results/${results[0].session_id}?tab=plan`, { replace: true });
        } else {
          setHasNone(true);
        }
      } catch {
        if (active) setHasNone(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [navigate]);

  if (loading && !hasNone) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-40 w-full" rounded="rounded-2xl" />
      </div>
    );
  }

  // Empty state — no imports yet.
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Your plan"
        title="Build your plan from a real test"
        subtitle="Your study plan comes straight from an official Bluebook practice test — your real score, the skills to fix, and what to take next."
      />
      <div className="mt-6 rounded-2xl border border-dashed border-edge px-6 py-12 text-center">
        <Upload className="mx-auto mb-3 h-8 w-8 text-brand-500" />
        <p className="mb-5 text-sm text-ink-muted">
          Take a practice test in College Board Bluebook, then import your results to get your plan.
        </p>
        <Button variant="primary" onClick={() => navigate('/student/practice-tests')}>
          Import a test <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StudyPlanPage;
