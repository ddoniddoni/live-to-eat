import { requireOptionalNativeModule } from 'expo-modules-core';

export type NativeSharedLinkPayload = Readonly<{
  id: string;
  mimeType: string;
  receivedAt: number;
  type: 'text' | 'url';
  value: string;
}>;

type LiveToEatShareInboxNativeModule = Readonly<{
  getPendingPayloads: () => NativeSharedLinkPayload[];
  removePayloads: (payloadIds: string[]) => void;
}>;

export const getShareInboxNativeModule = (): LiveToEatShareInboxNativeModule | null =>
  requireOptionalNativeModule<LiveToEatShareInboxNativeModule>('LiveToEatShareInbox');
