import { prepareSharedPlaceInbox, type SharedPlaceInboxCandidate } from '@live-to-eat/domain';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getShareInboxNativeModule } from '../../../../../modules/share-inbox/src';

const nativeModule = getShareInboxNativeModule();

type InboxSnapshot = ReturnType<typeof prepareSharedPlaceInbox>;

const readInboxSnapshot = (): InboxSnapshot => {
  if (!nativeModule) {
    return { candidates: [], clearPayloadIds: [] };
  }

  try {
    return prepareSharedPlaceInbox(nativeModule.getPendingPayloads());
  } catch {
    return { candidates: [], clearPayloadIds: [] };
  }
};

export const useShareInbox = (): Readonly<{
  candidates: SharedPlaceInboxCandidate[];
  discard: (payloadId: string) => void;
}> => {
  const [snapshot, setSnapshot] = useState<InboxSnapshot>(readInboxSnapshot);

  const refresh = useCallback(() => {
    setSnapshot(readInboxSnapshot());
  }, []);

  useEffect(() => {
    if (snapshot.clearPayloadIds.length > 0) {
      nativeModule?.removePayloads(snapshot.clearPayloadIds);
    }
  }, [snapshot.clearPayloadIds]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refresh();
      }
    });

    return () => subscription.remove();
  }, [refresh]);

  const discard = useCallback((payloadId: string) => {
    nativeModule?.removePayloads([payloadId]);
    setSnapshot((current) => ({
      ...current,
      candidates: current.candidates.filter((candidate) => candidate.payloadId !== payloadId),
    }));
  }, []);

  return { candidates: snapshot.candidates, discard };
};
