// Manual mock for useLiveSession. Prevents Jest from loading the real module
// (which imports ../services -> axios, an ESM package CRA's jest does not
// transform). Tests set behavior via useLiveSession.mockReturnValue(...).
const useLiveSession = jest.fn(() => ({
  status: 'idle',
  snapshot: null,
  lastByType: {},
  send: jest.fn(),
}));

export default useLiveSession;
