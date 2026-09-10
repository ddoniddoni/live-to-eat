import { z } from 'zod';

export const visibilitySchema = z.enum(['private', 'unlisted', 'public']);
export type Visibility = z.infer<typeof visibilitySchema>;

export const visitStatusSchema = z.enum(['want', 'visited']);
export type VisitStatus = z.infer<typeof visitStatusSchema>;

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
