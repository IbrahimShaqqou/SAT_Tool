/**
 * Manual Jest mock for the axios-based api client.
 *
 * Activated via `jest.mock('./api')` in service tests. Without it, importing a
 * service pulls in the real `./api` → `axios`, whose ESM build CRA's Jest does
 * not transform (it lives in node_modules), causing "Cannot use import
 * statement outside a module". This stub keeps service unit tests hermetic.
 */
const api = {
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  patch: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
};

export default api;
