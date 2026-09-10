import { AuthFlowError, toAuthFailure } from '@/features/auth/authApi';
import { getSupabaseClient, isAuthPreviewMode } from '@/lib/supabase/client';

export type ImportRegionOption = Readonly<{
  countryCode: string;
  id: string;
  isPreview: boolean;
  kind: string;
  name: string;
}>;

type RegionRow = {
  country_code?: unknown;
  id?: unknown;
  kind?: unknown;
  localized_names?: unknown;
};

const previewRegions: ImportRegionOption[] = [
  { countryCode: 'KR', id: '00000000-0000-4000-8000-000000000001', isPreview: true, kind: 'city', name: '서울 · 예시' },
  { countryCode: 'KR', id: '00000000-0000-4000-8000-000000000002', isPreview: true, kind: 'city', name: '부산 · 예시' },
  { countryCode: 'JP', id: '00000000-0000-4000-8000-000000000003', isPreview: true, kind: 'city', name: '도쿄 · 예시' },
];

const configuredClient = () => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new AuthFlowError('CONFIGURATION_REQUIRED');
  return supabase;
};

const localizedName = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const names = value as Record<string, unknown>;

  for (const locale of ['ko', 'en', 'default']) {
    if (typeof names[locale] === 'string' && names[locale].trim()) return names[locale].trim();
  }

  return Object.values(names).find((name): name is string => typeof name === 'string' && name.trim().length > 0)?.trim() ?? null;
};

const toOption = (value: RegionRow): ImportRegionOption | null => {
  const name = localizedName(value.localized_names);
  if (
    typeof value.id !== 'string' ||
    typeof value.country_code !== 'string' ||
    typeof value.kind !== 'string' ||
    name === null
  ) {
    return null;
  }

  return {
    countryCode: value.country_code,
    id: value.id,
    isPreview: false,
    kind: value.kind,
    name,
  };
};

export const listImportRegions = async (): Promise<ImportRegionOption[]> => {
  if (isAuthPreviewMode()) return previewRegions;

  const { data, error } = await configuredClient()
    .from('region_nodes')
    .select('country_code,id,kind,localized_names')
    .order('country_code', { ascending: true })
    .limit(100);
  if (error) throw toAuthFailure(error);

  return (data ?? []).map((row) => toOption(row)).filter((row): row is ImportRegionOption => row !== null);
};
