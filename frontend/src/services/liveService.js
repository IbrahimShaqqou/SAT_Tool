/**
 * Live tutoring session transport.
 *
 * Fetches a short-lived WS ticket over authenticated REST, then opens a
 * WebSocket. The socket only mirrors state; the student's answers still go
 * through the normal REST endpoints, so a dropped socket is non-fatal.
 */
import api from './api';

/** Derive the ws(s):// URL from the REST base URL + returned ws_path. */
export function buildWsUrl(apiBaseUrl, wsPath, ticket) {
  const origin = apiBaseUrl.replace(/\/api\/v1\/?$/, '');
  const wsOrigin = origin.replace(/^http/, 'ws'); // http->ws, https->wss
  return `${wsOrigin}${wsPath}?ticket=${ticket}`;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

export async function connect({ sessionId, onMessage, onStatusChange }) {
  onStatusChange && onStatusChange('connecting');
  const { data } = await api.post('/live/token', { session_id: sessionId });
  const url = buildWsUrl(API_BASE_URL, data.ws_path, data.ticket);
  const ws = new WebSocket(url);

  ws.onopen = () => onStatusChange && onStatusChange('connected');
  ws.onclose = () => onStatusChange && onStatusChange('disconnected');
  ws.onerror = () => onStatusChange && onStatusChange('error');
  ws.onmessage = (evt) => {
    try {
      onMessage && onMessage(JSON.parse(evt.data));
    } catch (_) { /* ignore malformed frames */ }
  };

  return {
    send: (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close: () => ws.close(),
    raw: ws,
  };
}

export function getQuestionDetail(questionId) {
  return api.get(`/live/question/${questionId}`);
}

const liveService = { connect, buildWsUrl, getQuestionDetail };
export default liveService;
