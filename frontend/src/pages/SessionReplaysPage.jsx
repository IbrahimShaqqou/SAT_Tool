import { useEffect, useRef, useState } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import api from '../services/api';

// Walk rrweb's serialized node tree and make all stylesheet/script URLs absolute
// so the player's about:blank iframe can actually load them.
function fixRelativeUrls(events, pageUrl) {
  let origin;
  try { origin = new URL(pageUrl).origin; } catch { return events; }

  function fixNode(node) {
    if (!node) return;
    const tag = node.tagName;
    const attrs = node.attributes || {};
    if (tag === 'link' && attrs.rel === 'stylesheet' && attrs.href && !attrs.href.startsWith('http')) {
      attrs.href = attrs.href.startsWith('/') ? origin + attrs.href : origin + '/' + attrs.href;
    }
    if (tag === 'script' && attrs.src && !attrs.src.startsWith('http')) {
      attrs.src = attrs.src.startsWith('/') ? origin + attrs.src : origin + '/' + attrs.src;
    }
    (node.childNodes || []).forEach(fixNode);
  }

  return events.map(event => {
    if (event.type !== 2) return event;
    const copy = JSON.parse(JSON.stringify(event));
    fixNode(copy.data.node);
    return copy;
  });
}

function formatDuration(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

export default function SessionReplaysPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const playerRef = useRef(null);
  const playerInstanceRef = useRef(null);

  useEffect(() => {
    api.get('/replays/')
      .then(r => setSessions(r.data))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  const openReplay = async (session) => {
    setSelected(session);
    setEvents(null);
    setLoadingEvents(true);
    try {
      const r = await api.get(`/replays/${session.session_id}/events`);
      setEvents(r.data.events);
    } catch {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (!events || !playerRef.current) return;
    if (playerInstanceRef.current) {
      playerInstanceRef.current.$destroy();
      playerInstanceRef.current = null;
    }
    if (events.length === 0) return;
    playerRef.current.innerHTML = '';
    const fixedEvents = fixRelativeUrls(events, selected?.page_url || '');
    playerInstanceRef.current = new rrwebPlayer({
      target: playerRef.current,
      props: {
        events: fixedEvents,
        width: playerRef.current.clientWidth || 800,
        height: 500,
        autoPlay: true,
      },
    });

    // Inject this document's styles into the player iframe so replay renders correctly.
    // rrweb records without inlining CSS (to keep snapshot small), so we supply styles here.
    requestAnimationFrame(() => {
      const iframe = playerRef.current?.querySelector('iframe');
      if (!iframe?.contentDocument) return;
      const allCSS = Array.from(document.styleSheets).flatMap(sheet => {
        try { return Array.from(sheet.cssRules).map(r => r.cssText); }
        catch { return []; }
      }).join('\n');
      const style = iframe.contentDocument.createElement('style');
      style.textContent = allCSS;
      iframe.contentDocument.head?.appendChild(style);
    });
  }, [events, selected]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink-body mb-6">Session Replays</h1>

      <div className="flex gap-6">
        {/* Session list */}
        <div className="w-80 shrink-0">
          {loading ? (
            <p className="text-ink-faint text-sm">Loading…</p>
          ) : sessions.length === 0 ? (
            <p className="text-ink-faint text-sm">No sessions recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map(s => (
                <li key={s.session_id}>
                  <button
                    onClick={() => openReplay(s)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      selected?.session_id === s.session_id
                        ? 'border-brand-primary bg-surface-hover'
                        : 'border-edge-subtle bg-surface-card hover:bg-surface-hover'
                    }`}
                  >
                    <p className="text-sm font-medium text-ink-body truncate">{s.page_url}</p>
                    <p className="text-xs text-ink-faint mt-0.5">
                      {formatDate(s.created_at)} · {formatDuration(s.duration_ms)} · {s.event_count} events
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Player */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="h-80 flex items-center justify-center rounded-xl border border-edge-subtle bg-surface-card">
              <p className="text-ink-faint text-sm">Select a session to watch</p>
            </div>
          ) : loadingEvents ? (
            <div className="h-80 flex items-center justify-center rounded-xl border border-edge-subtle bg-surface-card">
              <p className="text-ink-faint text-sm">Loading events…</p>
            </div>
          ) : events && events.length === 0 ? (
            <div className="h-80 flex items-center justify-center rounded-xl border border-edge-subtle bg-surface-card">
              <p className="text-ink-faint text-sm">No events in this session.</p>
            </div>
          ) : (
            <div ref={playerRef} className="rounded-xl overflow-hidden border border-edge-subtle" />
          )}
        </div>
      </div>
    </div>
  );
}
