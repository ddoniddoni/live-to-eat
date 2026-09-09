import { z } from 'zod';

export const visibilitySchema = z.enum(['private', 'unlisted', 'public']);
export type Visibility = z.infer<typeof visibilitySchema>;

export const visitStatusSchema = z.enum(['want', 'visited']);
export type VisitStatus = z.infer<typeof visitStatusSchema>;

export const importedRowSchema = z.object({
  sourceRowKey: z.string().min(1).max(256),
  sourceKind: z.enum(['takeout_saved_csv', 'app_json_v1', 'google_url']),
  collectionName: z.string().max(200).optional(),
  inputTitle: z.string().max(500).optional(),
  inputUrl: z.url().optional(),
  ownNote: z.string().max(10_000).optional(),
  inputTags: z.array(z.string().max(100)).max(100).optional(),
  explicitRegionId: z.uuid().optional(),
  explicitPlaceId: z.string().max(512).optional(),
});

export type ImportedRow = z.infer<typeof importedRowSchema>;

export type NewSavedPlace = Readonly<{
  isRecommended: false;
  visibility: 'private';
  visitStatus: 'want';
}>;

export const createNewSavedPlace = (): NewSavedPlace => ({
  isRecommended: false,
  visibility: 'private',
  visitStatus: 'want',
});

export const canRecommend = (visitStatus: VisitStatus): boolean => visitStatus === 'visited';
