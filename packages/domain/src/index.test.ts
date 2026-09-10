import { describe, expect, it } from 'vitest';

import { canRecommend, createNewSavedPlace } from './index';

describe('saved place defaults', () => {
  it('starts private and unvisited', () => {
    expect(createNewSavedPlace()).toEqual({
      isRecommended: false,
      visibility: 'private',
      visitStatus: 'want',
    });
  });

  it('allows recommendations only for visited places', () => {
    expect(canRecommend('want')).toBe(false);
    expect(canRecommend('visited')).toBe(true);
  });
});
