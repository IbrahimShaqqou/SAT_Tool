import { useEffect, useRef, useState, useCallback } from 'react';
import { liveService } from '../services';

const HEARTBEAT_MS = 20000;
const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 30000;

/**
 * Owns a live-session WebSocket. Mirrors student state to a watching tutor, or
 * carries a student's outbound deltas. Reconnects with backoff; sends
 * heartbeats. `enabled` gates connection so it only runs when a live view is open.
 */
export function useLiveSession({ sessionId, role, enabled = true, onMessage }) {
  const [status, setStatus] = useState('idle');
  const [snapshot, setSnapshot] = useState(null);
  const [lastByType, setLastByType] = useState({});
  const handleRef = useRef(null);
  const backoffRef = useRef(BACKOFF_START_MS);
  const heartbeatRef = useRef(null);
  const closedByUs = useRef(false);
  const rxCounter = useRef(0);
  // Read the per-message callback via ref so it never triggers reconnects.
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const handleMessage = useCallback((msg) => {
    if (!msg || !msg.type) return;
    msg._rx = ++rxCounter.current;
    if (msg.type === 'snapshot') setSnapshot(msg.payload);
    setLastByType((prev) => ({ ...prev, [msg.type]: msg }));
    if (onMessageRef.current) onMessageRef.current(msg);
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId) return undefined;
    closedByUs.current = false;
    let cancelled = false;

    const open = async () => {
      try {
        const handle = await liveService.connect({
          sessionId,
          onMessage: handleMessage,
          onStatusChange: (s) => {
            setStatus(s);
            if (s === 'connected') {
              backoffRef.current = BACKOFF_START_MS;
              heartbeatRef.current = setInterval(() => {
                handle.send({ type: 'heartbeat', session_id: sessionId,
                  sender_role: role, seq: 0, payload: {} });
              }, HEARTBEAT_MS);
            }
            if ((s === 'disconnected' || s === 'error') && !closedByUs.current && !cancelled) {
              clearInterval(heartbeatRef.current);
              const delay = backoffRef.current;
              backoffRef.current = Math.min(delay * 2, BACKOFF_MAX_MS);
              setTimeout(() => { if (!cancelled) open(); }, delay);
            }
          },
        });
        if (cancelled) { handle.close(); return; }
        handleRef.current = handle;
      } catch (_) {
        if (!cancelled) {
          const delay = backoffRef.current;
          backoffRef.current = Math.min(delay * 2, BACKOFF_MAX_MS);
          setTimeout(() => { if (!cancelled) open(); }, delay);
        }
      }
    };
    open();

    return () => {
      cancelled = true;
      closedByUs.current = true;
      clearInterval(heartbeatRef.current);
      if (handleRef.current) handleRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionId, role, handleMessage]);

  const send = useCallback((msg) => {
    if (handleRef.current) handleRef.current.send(msg);
  }, []);

  return { status, snapshot, lastByType, send };
}

export default useLiveSession;
