jest.mock('./api');

import { buildWsUrl } from './liveService';

describe('buildWsUrl', () => {
  test('http api url -> ws url with ws_path', () => {
    const url = buildWsUrl('http://localhost:8000/api/v1', '/api/v1/live/ws/s-1', 'TICKET');
    expect(url).toBe('ws://localhost:8000/api/v1/live/ws/s-1?ticket=TICKET');
  });

  test('https api url -> wss url', () => {
    const url = buildWsUrl('https://api.example.com/api/v1', '/api/v1/live/ws/s-1', 'T');
    expect(url).toBe('wss://api.example.com/api/v1/live/ws/s-1?ticket=T');
  });
});
