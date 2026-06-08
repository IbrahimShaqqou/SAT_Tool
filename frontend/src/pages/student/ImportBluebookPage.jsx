/**
 * Import Bluebook Results — drag-and-drop a zooprep-bluebook.json bundle
 * (produced by the ZooPrep Bluebook Importer extension) and ingest it.
 * Renders inside AppLayout. Warm semantic tokens, dark-mode aware.
 */
import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileJson, CheckCircle2, AlertTriangle, Chrome, ArrowRight, Link as LinkIcon, Copy } from 'lucide-react';
import { Button, PageHeader, Section, Surface, useToast } from '../../components/ui';
import { importBundle } from '../../services/practiceTestApi';

// Keep in sync with PracticeTestsPage: production reads the Web Store URL from
// REACT_APP_EXTENSION_URL, dev/local falls back to the served zip.
const EXTENSION_URL =
  process.env.REACT_APP_EXTENSION_URL || '/extension/zooprep-importer.zip';

const STEPS = [
  'Install the ZooPrep Bluebook Importer browser extension.',
  'Sign in at mypractice.collegeboard.org and open any Score Details page once.',
  'Click the extension → Export my results.',
  'It uploads automatically — or drop the downloaded file below.',
];

const ImportBluebookPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showConnect, setShowConnect] = useState(false);

  const apiBase = (process.env.REACT_APP_API_URL || `${window.location.origin}/api/v1`)
    .replace(/\/api\/v1\/?$/, '');
  const accessToken = (() => {
    try { return localStorage.getItem('accessToken') || ''; } catch { return ''; }
  })();

  const copy = (label, value) => {
    navigator.clipboard?.writeText(value);
    toast?.success?.(`${label} copied`);
  };

  const ingest = useCallback(async (bundle) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await importBundle(bundle);
      setResult(res);
      toast?.success?.(res.summary || 'Imported');
    } catch (err) {
      const detail = err?.response?.data?.detail || err.message || 'Import failed';
      setError(detail);
      toast?.error?.(detail);
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setError('Please drop the zooprep-bluebook.json file.');
      return;
    }
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      if (!bundle || !Array.isArray(bundle.attempts)) {
        setError('That file doesn’t look like a ZooPrep Bluebook bundle.');
        return;
      }
      await ingest(bundle);
    } catch (e) {
      setError('Could not read that file — is it valid JSON?');
    }
  }, [ingest]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  }, [handleFile]);

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <PageHeader
        eyebrow="Official results"
        title="Import from Bluebook"
        subtitle="Bring your official College Board practice-test results into ZooPrep — real scores, every question, and what to work on next."
      />

      <Section title="How it works">
        <ol className="space-y-2 text-sm text-ink-muted">
          {STEPS.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-600 dark:text-brand-300">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(EXTENSION_URL, '_blank')}
          >
            <Chrome className="mr-1.5 h-4 w-4" /> Get the extension
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowConnect((v) => !v)}>
            <LinkIcon className="mr-1.5 h-4 w-4" /> Connect for auto-upload
          </Button>
        </div>

        {showConnect && (
          <Surface className="mt-3 rounded-xl border border-edge p-4">
            <p className="text-sm text-ink-muted">
              Paste these into the extension’s <span className="font-medium text-ink-body">Settings</span> to
              upload results straight to your account (otherwise it downloads a file you drop below).
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-body">{apiBase}</code>
                <Button variant="secondary" size="sm" onClick={() => copy('ZooPrep URL', apiBase)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-body">
                  {accessToken ? `${accessToken.slice(0, 12)}…` : 'Sign in to get your token'}
                </code>
                <Button variant="secondary" size="sm" disabled={!accessToken} onClick={() => copy('Access token', accessToken)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              Your token is personal — don’t share it. It refreshes periodically; re-copy if upload stops working.
            </p>
          </Surface>
        )}
      </Section>

      <Section title="Drop your results file">
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
            <span className="font-semibold text-ink">Drop zooprep-bluebook.json here</span>
            <span className="text-ink-muted"> or click to browse</span>
          </div>
          {busy && <span className="text-xs text-ink-muted">Importing…</span>}
        </Surface>
      </Section>

      {error && (
        <Surface className="mt-4 flex items-start gap-3 rounded-xl border border-rose-300/50 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </Surface>
      )}

      {result && (
        <Surface className="mt-4 rounded-xl border border-emerald-300/50 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                {result.summary}
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-ink-muted">
                {(result.detail?.tests || []).map((t) => (
                  <li key={t.test_number} className="flex items-center gap-2">
                    <FileJson className="h-4 w-4 text-brand-500" />
                    <span className="font-medium text-ink">Practice Test {t.test_number}</span>
                    <span>
                      — {t.attempts} attempt{t.attempts === 1 ? '' : 's'},{' '}
                      {t.official_anchors} official score{t.official_anchors === 1 ? '' : 's'},{' '}
                      {t.usable
                        ? `${t.modules_seeded} modules set up`
                        : 'needs both an easier and harder attempt'}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => navigate('/student/practice-tests')}
              >
                View your results <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </Surface>
      )}
    </div>
  );
};

export default ImportBluebookPage;
