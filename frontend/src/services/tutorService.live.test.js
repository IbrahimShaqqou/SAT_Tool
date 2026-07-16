jest.mock('./api');

import tutorService from './tutorService';
import api from './api';

test('getActiveSessions calls the live/active endpoint', async () => {
  api.get.mockResolvedValue({ data: { sessions: [] } });
  await tutorService.getActiveSessions();
  expect(api.get).toHaveBeenCalledWith('/live/active');
});
