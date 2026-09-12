import { z } from 'zod';

export const notebookPlaceSchema = z.object({
  savedId: z.string(),
  displayName: z.string(),
  address: z.string(),
  coordinate: z
    .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
    .nullable(),
  collectionId: z.string().nullable(),
  collectionName: z.string().nullable(),
  isRecommended: z.boolean(),
  note: z.string().max(2000),
  tags: z.array(z.string().max(60)).max(20),
  regionPath: z.array(z.object({ id: z.string(), label: z.string() })),
  version: z.number().int().positive(),
  visitStatus: z.enum(['want', 'visited']),
  visibility: z.enum(['private', 'unlisted', 'public']),
  publicNote: z.string().max(280).default(''),
});
export type NotebookPlace = z.infer<typeof notebookPlaceSchema>;
export const shareDraftSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(80),
  regionId: z.string(),
  savedIds: z.array(z.string()).max(200),
  createdAt: z.number(),
  expiresAt: z.number(),
  revokedAt: z.number().nullable(),
  showAuthor: z.boolean(),
});
export type ShareDraft = z.infer<typeof shareDraftSchema>;
export const notebookSchema = z.object({
  version: z.literal(1),
  places: z.array(notebookPlaceSchema).max(5000),
  collections: z.array(z.object({ id: z.string(), name: z.string().min(1).max(120) })).max(50),
  shares: z.array(shareDraftSchema),
  blockedHandles: z.array(z.string()),
  profile: z.object({
    displayName: z.string().max(60),
    bio: z.string().max(280),
    publicMapEnabled: z.boolean(),
  }),
  locale: z.enum(['ko', 'en']),
  welcomed: z.boolean(),
});
export type Notebook = z.infer<typeof notebookSchema>;
export const inRegion = (place: NotebookPlace, region: string): boolean =>
  region === 'all' ||
  (region === 'unclassified' ? place.regionPath.length === 0 : place.regionPath.some((r) => r.id === region));
export const parseTags = (value: string): string[] =>
  [
    ...new Set(
      value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ]
    .slice(0, 20)
    .map((v) => v.slice(0, 60));
export const shareStatus = (share: ShareDraft, now: number): 'active' | 'expired' | 'revoked' =>
  share.revokedAt !== null ? 'revoked' : share.expiresAt <= now ? 'expired' : 'active';
export const visibleSharePlaces = (
  share: ShareDraft,
  places: NotebookPlace[],
  now: number,
): NotebookPlace[] =>
  shareStatus(share, now) !== 'active'
    ? []
    : places.filter(
        (p) =>
          share.savedIds.includes(p.savedId) && p.visibility !== 'private' && inRegion(p, share.regionId),
      );
// Removing an item is permanent for existing snapshots, even after making it public again.
export const reconcileShares = (shares: ShareDraft[], places: NotebookPlace[]): ShareDraft[] =>
  shares.map((share) => ({
    ...share,
    savedIds: share.savedIds.filter((id) =>
      places.some((p) => p.savedId === id && p.visibility !== 'private' && inRegion(p, share.regionId)),
    ),
  }));
export function makeShareDraft(
  notebook: Notebook,
  input: Omit<ShareDraft, 'revokedAt'>,
  consent: boolean,
): Notebook {
  if (
    !input.title.trim() ||
    input.savedIds.length === 0 ||
    input.savedIds.length > 200 ||
    input.expiresAt <= input.createdAt
  )
    throw new Error('INVALID_SHARE');
  const selected = [...new Set(input.savedIds)].map((id) => notebook.places.find((p) => p.savedId === id));
  if (selected.some((p) => !p || !inRegion(p, input.regionId))) throw new Error('INVALID_SCOPE');
  if (!consent && selected.some((p) => p?.visibility === 'private')) throw new Error('CONSENT_REQUIRED');
  return {
    ...notebook,
    places: notebook.places.map((p) =>
      input.savedIds.includes(p.savedId) && p.visibility === 'private'
        ? { ...p, visibility: 'unlisted', version: p.version + 1 }
        : p,
    ),
    shares: [
      { ...input, title: input.title.trim(), savedIds: [...new Set(input.savedIds)], revokedAt: null },
      ...notebook.shares,
    ],
  };
}
export const copyAsPrivate = (place: NotebookPlace, savedId: string): NotebookPlace => ({
  ...place,
  savedId,
  collectionId: null,
  collectionName: null,
  note: '',
  publicNote: '',
  tags: [],
  visitStatus: 'want',
  visibility: 'private',
  isRecommended: false,
  version: 1,
});
export const removeCollection = (notebook: Notebook, collectionId: string): Notebook => ({
  ...notebook,
  collections: notebook.collections.filter((c) => c.id !== collectionId),
  places: notebook.places.map((p) =>
    p.collectionId === collectionId ? { ...p, collectionId: null, collectionName: null } : p,
  ),
});
// Only user-authored fields are exported. Provider names, addresses and coordinates stay out.
export const exportRecords = (places: NotebookPlace[], includeNotes: boolean) =>
  places.map((p) => ({
    savedId: p.savedId,
    visitStatus: p.visitStatus,
    isRecommended: p.isRecommended,
    visibility: p.visibility,
    tags: p.tags,
    folder: p.collectionName,
    ...(includeNotes ? { personalNote: p.note } : {}),
  }));
const csvCell = (value: unknown): string => {
  const raw = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  const safe = /^[\s]*[=+@\-\t\r]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};
export const exportCsv = (places: NotebookPlace[], includeNotes: boolean): string => {
  const rows = exportRecords(places, includeNotes);
  const columns = [
    'savedId',
    'visitStatus',
    'isRecommended',
    'visibility',
    'tags',
    'folder',
    ...(includeNotes ? ['personalNote'] : []),
  ];
  return (
    '\uFEFF' +
    [
      columns.map(csvCell).join(','),
      ...rows.map((row) => columns.map((key) => csvCell(row[key as keyof typeof row])).join(',')),
    ].join('\r\n')
  );
};
