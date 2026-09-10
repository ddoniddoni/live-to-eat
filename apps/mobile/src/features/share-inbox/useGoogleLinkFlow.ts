import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SavedPlaceDraft, PlaceSearchCandidate } from '@/features/places/placeSearchApi';
import {
  resolveGoogleLink,
  saveGoogleLinkCandidate,
  searchGoogleLinkPlaces,
} from '@/features/share-inbox/googleLinkApi';

export type GoogleLinkStage = 'entry' | 'results' | 'confirm';

type UseGoogleLinkFlowOptions = Readonly<{
  inputUrl: string;
  onDismiss: () => void;
  onSaved: (savedPlace: SavedPlaceDraft) => void;
}>;

export const useGoogleLinkFlow = ({ inputUrl, onDismiss, onSaved }: UseGoogleLinkFlowOptions) => {
  const { i18n, t } = useTranslation();
  const [stage, setStage] = useState<GoogleLinkStage>('entry');
  const [linkValue, setLinkValue] = useState(inputUrl);
  const [manualQuery, setManualQuery] = useState('');
  const [candidates, setCandidates] = useState<PlaceSearchCandidate[]>([]);
  const [selected, setSelected] = useState<PlaceSearchCandidate | null>(null);
  const [isManualSearch, setIsManualSearch] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const languageCode = (): 'en' | 'ko' => (i18n.language.startsWith('ko') ? 'ko' : 'en');
  const isBusy = isResolving || isSearching || isSaving;

  const checkLink = async (): Promise<void> => {
    if (isBusy) return;

    setError(null);
    setIsResolving(true);
    try {
      const candidate = await resolveGoogleLink(linkValue, languageCode());
      setCandidates(candidate ? [candidate] : []);
      setIsManualSearch(candidate === null);
      setStage('results');
    } catch {
      setError(t('googleLink.linkError'));
    } finally {
      setIsResolving(false);
    }
  };

  const runManualSearch = async (): Promise<void> => {
    if (manualQuery.trim().length < 2 || isSearching) {
      setError(t('googleLink.manualQueryHint'));
      return;
    }

    setError(null);
    setIsSearching(true);
    try {
      setCandidates(await searchGoogleLinkPlaces(linkValue, manualQuery, languageCode()));
    } catch {
      setCandidates([]);
      setError(t('googleLink.manualSearchError'));
    } finally {
      setIsSearching(false);
    }
  };

  const chooseCandidate = (candidate: PlaceSearchCandidate): void => {
    setSelected(candidate);
    setError(null);
    setStage('confirm');
  };

  const save = async (): Promise<void> => {
    if (!selected || isSaving) return;

    setError(null);
    setIsSaving(true);
    try {
      const savedPlace = await saveGoogleLinkCandidate({ candidate: selected, inputUrl: linkValue });
      onSaved(savedPlace);
      onDismiss();
    } catch {
      setError(t('googleLink.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const close = (): void => {
    if (!isBusy) onDismiss();
  };

  return {
    backToEntry: () => setStage('entry'),
    backToResults: () => setStage('results'),
    candidates,
    checkLink,
    chooseCandidate,
    close,
    error,
    isManualSearch,
    isResolving,
    isSaving,
    isSearching,
    linkValue,
    manualQuery,
    runManualSearch,
    save,
    selected,
    setLinkValue,
    setManualQuery,
    stage,
  };
};
