/**
 * Practice Tests — Study Hall.
 * Import-first: dropping your official Bluebook results is the default action.
 * Taken tests are listed newest → oldest. Taking a test inside ZooPrep is a
 * secondary option. Warm tokens, dark mode, borderless tiles.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud, FileJson, CheckCircle2, AlertTriangle, Chrome, ArrowRight,
  Link as LinkIcon, BadgeCheck, ChevronRight, Trash2, Loader2,
} from 'lucide-react';
import {
  Button, Skeleton, PageHeader, Section, Surface, useToast,
} from '../../components/ui';
import {
  listPracticeTests, listMyResults, importBundle, deleteResult,
} from '../../services/practiceTestApi';
import api from '../../services/api';

// Where "Get the importer extension" sends students. Production builds read
// REACT_APP_EXTENSION_URL (set in .env.production to the Chrome Web Store
// listing URL); dev/local falls back to the locally-served zip.
const EXTENSION_URL =
  process.env.REACT_APP_EXTENSION_URL || '/extension/zooprep-importer.zip';

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

const PracticeTestsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const inputRef = useRef(null);

  const [practiceTests, setPracticeTests] = useState([]);
  const [myResults, setMyResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Import state
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [importError, setImportError] = useState(null);
  const [showTakeHere, setShowTakeHere] = useState(false);
  // Session id currently being deleted (disables its row), or null.
  const [deletingId, setDeletingId] = useState(null);
  // Extension connect handshake: 'unknown' | 'installed' | 'missing' | 'connected'
  const [connectState, setConnectState] = useState('unknown');

  // Use the SAME base the app's axios client uses (api.defaults.baseURL ends in
  // /api/v1), not window.location.origin — in dev the API is on :8000, not :3000.
  const apiBase = String(api.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '');

  // Detect the importer extension and react to its connect responses.
  useEffect(() => {
    const onMsg = (event) => {
      if (event.source !== window) return;
      const m = event.data;
      if (!m || m.ns !== 'ZOOPREP_CONNECT') return;
      if (m.type === 'PONG' || m.type === 'READY') {
        setConnectState((s) => (s === 'connected' ? s : 'installed'));
      } else if (m.type === 'CONNECTED') {
        if (m.ok) {
          setConnectState('connected');
          toast?.success?.('Extension connected. Your imports will upload automatically.');
        } else {
          toast?.error?.(`Couldn’t connect: ${m.error || 'unknown error'}`);
        }
      }
    };
    window.addEventListener('message', onMsg);
    // Ask whether the extension is present.
    window.postMessage({ ns: 'ZOOPREP_CONNECT', type: 'PING' }, window.location.origin);
    const t = setTimeout(() => setConnectState((s) => (s === 'unknown' ? 'missing' : s)), 800);
    return () => { window.removeEventListener('message', onMsg); clearTimeout(t); };
  }, [toast]);

  const connectExtension = () => {
    let refreshToken = '';
    try { refreshToken = localStorage.getItem('refreshToken') || ''; } catch { /* ignore */ }
    if (!refreshToken) {
      toast?.error?.('Please sign in again to connect the extension.');
      return;
    }
    window.postMessage(
      { ns: 'ZOOPREP_CONNECT', type: 'CONNECT', baseUrl: apiBase, refreshToken },
      window.location.origin,
    );
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tests, results] = await Promise.all([
        listPracticeTests().catch(() => []),
        listMyResults().catch(() => []),
      ]);
      setPracticeTests(tests);
      setMyResults(results);
      setError(null);
    } catch (err) {
      console.error('Error loading practice tests:', err);
      setError('Failed to load practice tests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const ingest = useCallback(async (bundle) => {
    setBusy(true);
    setImportError(null);
    setResult(null);
    try {
      const res = await importBundle(bundle);
      setResult(res);
      toast?.success?.(res.summary || 'Imported');
      await loadData(); // refresh the results list
    } catch (err) {
      const detail = err?.response?.data?.detail || err.message || 'Import failed';
      setImportError(detail);
      toast?.error?.(detail);
    } finally {
      setBusy(false);
    }
  }, [toast, loadData]);

  const handleDelete = useCallback(async (r, e) => {
    e?.stopPropagation?.();
    const label = r.test_name || 'this test';
    if (!window.confirm(
      `Remove ${label}? This deletes the attempt and its study plan, and it will ` +
      `no longer count toward your recommended next test. You can re-import it from Bluebook.`
    )) return;
    setDeletingId(r.session_id);
    try {
      await deleteResult(r.session_id);
      setMyResults((prev) => prev.filter((x) => x.session_id !== r.session_id));
      toast?.success?.(`Removed ${label}.`);
    } catch (err) {
      const detail = err?.response?.data?.detail || err.message || 'Could not remove that test';
      toast?.error?.(detail);
    } finally {
      setDeletingId(null);
    }
  }, [toast]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setImportError('Please drop the zooprep-bluebook.json file.');
      return;
    }
    try {
      const bundle = JSON.parse(await file.text());
      if (!bundle || !Array.isArray(bundle.attempts)) {
        setImportError('That file doesn’t look like a ZooPrep Bluebook bundle.');
        return;
      }
      await ingest(bundle);
    } catch {
      setImportError('Could not read that file. Is it valid JSON?');
    }
  }, [ingest]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer?.files?.[0]);
  }, [handleFile]);

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="mb-4 text-rose-600 dark:text-rose-400">{error}</p>
        <Button variant="secondary" onClick={loadData}>Try again</Button>
      </div>
    );
  }

  const hasResults = myResults.length > 0;

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <PageHeader
        eyebrow="Official results"
        title="Practice tests"
        subtitle="Take full-length tests in the College Board Bluebook app, then bring your official results here: real scores, every question, and what to work on next."
      />

      {/* ── Import (default action) ───────────────────────────────── */}
      <Section title="Import your Bluebook results">
        <Surface
          as="label"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={[
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
            dragging ? 'border-brand-500 bg-brand-500/5' : 'border-edge',
            busy ? 'pointer-events-none opacity-60' : '',
          ].join(' ')}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <UploadCloud className="h-8 w-8 text-brand-500" />
          <div className="text-sm">
            <span className="font-semibold text-ink-body">Drop your results file here</span>
            <span className="text-ink-muted"> or click to browse</span>
          </div>
          <span className="text-xs text-ink-faint">
            {busy ? 'Importing…' : 'zooprep-bluebook.json from the importer extension'}
          </span>
        </Surface>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(EXTENSION_URL, '_blank')}
          >
            <Chrome className="mr-1.5 h-4 w-4" /> Get the importer extension
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open('https://mypractice.collegeboard.org', '_blank')}
          >
            <ArrowRight className="mr-1.5 h-4 w-4" /> View my scores on College Board
          </Button>

          {connectState === 'connected' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/15 px-3 py-1.5 text-xs font-semibold text-accent-700 dark:text-accent-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Extension connected, auto-upload on
            </span>
          ) : connectState === 'installed' ? (
            <Button variant="primary" size="sm" onClick={connectExtension}>
              <LinkIcon className="mr-1.5 h-4 w-4" /> Connect extension for auto-upload
            </Button>
          ) : (
            <span className="text-xs text-ink-faint">
              {connectState === 'missing'
                ? 'Install the extension, then reload to enable one-click auto-upload.'
                : 'Checking for the importer extension…'}
            </span>
          )}
        </div>

        {importError && (
          <Surface className="mt-3 flex items-start gap-3 rounded-xl border border-rose-300/50 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{importError}</span>
          </Surface>
        )}

        {result && (
          <Surface className="mt-3 rounded-xl border border-emerald-300/50 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{result.summary}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-ink-muted">
                  {(result.detail?.tests || []).map((t) => (
                    <li key={t.test_number} className="flex items-center gap-2">
                      <FileJson className="h-4 w-4 text-brand-500" />
                      <span className="font-medium text-ink-body">Practice Test {t.test_number}</span>
                      <span>
                        {t.attempts} attempt{t.attempts === 1 ? '' : 's'},{' '}
                        {t.official_anchors} official score{t.official_anchors === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Surface>
        )}
      </Section>

      {/* ── Your tests (newest → oldest) ──────────────────────────── */}
      <Section className="mt-10" title="Your tests">
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-16 w-full" rounded="rounded-xl" />)}
          </div>
        ) : !hasResults ? (
          <p className="rounded-xl border border-dashed border-edge px-4 py-10 text-center text-sm text-ink-subtle">
            No results yet. Import your first Bluebook test above to see your scores here.
          </p>
        ) : (
          <div className="space-y-2">
            {myResults.map((r) => (
              <Surface
                key={r.session_id}
                className={[
                  'flex w-full items-center gap-2 rounded-xl pl-4 pr-2 py-3 transition-colors',
                  deletingId === r.session_id ? 'opacity-50 pointer-events-none' : '',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/student/practice-tests/results/${r.session_id}`)}
                  className="flex min-w-0 flex-1 items-center justify-between text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-body">{r.test_name}</span>
                      {r.is_official && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-500/15 px-2 py-0.5 text-[11px] font-semibold text-accent-700 dark:text-accent-300">
                          <BadgeCheck className="h-3 w-3" /> Official
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-subtle">{fmtDate(r.completed_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 pl-3">
                    {r.total_score != null && (
                      <span className="font-display text-xl font-semibold tabular-nums text-ink-body">{r.total_score}</span>
                    )}
                    <ArrowRight className="h-4 w-4 text-ink-faint" />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(r, e)}
                  disabled={deletingId === r.session_id}
                  aria-label={`Remove ${r.test_name}`}
                  title="Remove this test"
                  className="shrink-0 rounded-lg p-2 text-ink-faint transition-colors hover:bg-rose-500/10 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:hover:text-rose-400"
                >
                  {deletingId === r.session_id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </Surface>
            ))}
          </div>
        )}
      </Section>

      {/* ── Take a test inside ZooPrep (secondary) ────────────────── */}
      {practiceTests.length > 0 && (
        <Section className="mt-10" title="Or take a test in ZooPrep">
          <button
            type="button"
            onClick={() => setShowTakeHere((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-edge px-4 py-3 text-left text-sm text-ink-muted transition-colors hover:bg-surface-muted"
          >
            <span>
              Prefer to practice in-app? Take a full-length, adaptive simulation here
              (~2 hr 14 min). Scores are estimates calibrated to official data.
            </span>
            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${showTakeHere ? 'rotate-90' : ''}`} />
          </button>

          {showTakeHere && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {practiceTests.map((test) => (
                <Surface key={test.id} elevation="sm" padded={false} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <h3 className="font-medium text-ink-body">{test.test_name}</h3>
                    <p className="text-xs text-ink-subtle">{test.total_questions} questions · {test.estimated_time_minutes} min</p>
                  </div>
                  <Button
                    variant={test.is_active ? 'secondary' : 'ghost'}
                    size="sm"
                    disabled={!test.is_active}
                    onClick={() => navigate(`/student/practice-tests/${test.test_number}/start`)}
                  >
                    {test.is_active ? 'Start' : 'Soon'}
                  </Button>
                </Surface>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
};

export default PracticeTestsPage;
