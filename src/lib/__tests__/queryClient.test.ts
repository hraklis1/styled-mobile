jest.mock('../api', () => ({
  isNetworkError: () => false,
}));

import { clearUserQueryCache, queryClient } from '../queryClient';

describe('user query cache privacy', () => {
  afterEach(async () => {
    await clearUserQueryCache();
  });

  it('removes user-owned data at an auth boundary', async () => {
    queryClient.setQueryData(['items'], [{ id: 1, name: 'Private item' }]);
    queryClient.setQueryData(['profile'], { displayName: 'Private user' });

    await clearUserQueryCache();

    expect(queryClient.getQueryData(['items'])).toBeUndefined();
    expect(queryClient.getQueryData(['profile'])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
