import { describe, expect, it } from 'vitest';

import { canRecommend, createNewSavedPlace, importedRowSchema } from './index';

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

describe('imported row contract', () => {
  it('rejects unknown fields instead of guessing their meaning', () => {
    const result = importedRowSchema.strict().safeParse({
      sourceRowKey: 'takeout:0',
      sourceKind: 'takeout_saved_csv',
      guessedLatitude: 37.5,
    });

    expect(result.success).toBe(false);
  });
});
