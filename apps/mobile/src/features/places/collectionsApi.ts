import { AuthFlowError, toAuthFailure } from '@/features/auth/authApi';
import { getSupabaseClient, isAuthPreviewMode } from '@/lib/supabase/client';

export type PrivateCollection = {
  id: string;
  name: string;
};

type CollectionRow = {
  id?: unknown;
  name?: unknown;
};

const configuredClient = () => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new AuthFlowError('CONFIGURATION_REQUIRED');
  return supabase;
};

const isCollection = (value: CollectionRow): value is Required<PrivateCollection> =>
  typeof value.id === 'string' && typeof value.name === 'string';

export const listPrivateCollections = async (): Promise<PrivateCollection[]> => {
  if (isAuthPreviewMode()) return [];

  const { data, error } = await configuredClient()
    .from('collections')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw toAuthFailure(error);

  return (data ?? []).filter(isCollection).map(({ id, name }) => ({ id, name }));
};

export const createPrivateCollection = async (name: string): Promise<PrivateCollection> => {
  const normalizedName = name.trim();
  if (normalizedName.length < 1 || normalizedName.length > 120) {
    throw new AuthFlowError('INVALID_ONBOARDING_INPUT');
  }

  if (isAuthPreviewMode()) {
    return { id: `preview-collection-${Date.now()}`, name: normalizedName };
  }

  const { data, error } = await configuredClient().rpc('create_manual_collection', {
    collection_name_input: normalizedName,
  });
  if (error) throw toAuthFailure(error);
  if (typeof data !== 'string') throw new AuthFlowError('REQUEST_FAILED');

  return { id: data, name: normalizedName };
};

export const renamePrivateCollection = async (collection: PrivateCollection, name: string): Promise<PrivateCollection> => {
  const normalizedName = name.trim();
  if (normalizedName.length < 1 || normalizedName.length > 120) {
    throw new AuthFlowError('INVALID_ONBOARDING_INPUT');
  }

  if (collection.id.startsWith('preview-')) return { ...collection, name: normalizedName };

  const { error } = await configuredClient().rpc('rename_private_collection', {
    collection_id_input: collection.id,
    collection_name_input: normalizedName,
  });
  if (error) throw toAuthFailure(error);

  return { ...collection, name: normalizedName };
};

export const deletePrivateCollection = async (collection: PrivateCollection): Promise<void> => {
  if (collection.id.startsWith('preview-')) return;

  const { error } = await configuredClient().rpc('delete_private_collection', {
    collection_id_input: collection.id,
  });
  if (error) throw toAuthFailure(error);
};
