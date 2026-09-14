export type ReportTarget =
  | { kind: 'profile'; handle: string; displayName: string }
  | { kind: 'saved-place'; handle: string; displayName: string; savedId: string; placeName: string };

export const reportReasons = ['spam', 'harassment', 'hate', 'unsafe', 'privacy', 'other'] as const;
export type ReportReason = typeof reportReasons[number];
export const reportDetailLimit = 1000;

export function canReviewReport(reason: ReportReason | null, details: string): boolean {
  return reason !== null && details.length <= reportDetailLimit && (reason !== 'other' || details.trim().length >= 10);
}
