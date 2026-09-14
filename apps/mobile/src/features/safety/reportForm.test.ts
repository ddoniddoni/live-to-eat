import { expect, it } from 'vitest';
import { canReviewReport } from './reportForm';

it('requires a reason and explanatory text for other', () => {
  expect(canReviewReport(null, 'details')).toBe(false);
  expect(canReviewReport('spam', '')).toBe(true);
  expect(canReviewReport('other', '          ')).toBe(false);
  expect(canReviewReport('other', '123456789')).toBe(false);
  expect(canReviewReport('other', '1234567890')).toBe(true);
});
it('rejects detail text beyond the supported limit', () => {
  expect(canReviewReport('privacy', 'a'.repeat(1000))).toBe(true);
  expect(canReviewReport('privacy', 'a'.repeat(1001))).toBe(false);
});
