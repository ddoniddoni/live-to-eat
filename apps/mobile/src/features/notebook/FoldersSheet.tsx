import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { removeCollection } from '@live-to-eat/domain';
import { colors } from '@/components/tokens';
import { Sheet } from '@/components/ui/Sheet';
import { Action, Empty, Field, IconButton, Notice, ui } from '@/components/ui/primitives';
import {
  createPrivateCollection,
  deletePrivateCollection,
  renamePrivateCollection,
} from '@/features/places/collectionsApi';
import type { NotebookController } from './useNotebook';
export function FoldersSheet({
  book,
  isDemo,
  onClose,
}: {
  book: NotebookController;
  isDemo: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(false);
    try {
      const original = book.state.collections.find((c) => c.id === editing);
      const item = isDemo
        ? { id: editing ?? `demo-folder-${Date.now()}`, name: name.trim() }
        : original
          ? await renamePrivateCollection(original, name)
          : await createPrivateCollection(name);
      book.update((b) => ({
        ...b,
        collections: original
          ? b.collections.map((c) => (c.id === item.id ? item : c))
          : [...b.collections, item],
        places: b.places.map((p) => (p.collectionId === item.id ? { ...p, collectionName: item.name } : p)),
      }));
      setName('');
      setEditing(null);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    const collection = book.state.collections.find((c) => c.id === id);
    if (!collection || busy) return;
    setBusy(true);
    try {
      if (!isDemo) await deletePrivateCollection(collection);
      book.update((b) => removeCollection(b, id));
      setDeleting(null);
      if (editing === id) {
        setEditing(null);
        setName('');
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={t('folders.title')} subtitle={t('folders.description')} onClose={onClose}>
      <Field
        label={t(editing ? 'folders.rename' : 'placeSearch.newCollection')}
        value={name}
        onChangeText={setName}
        maxLength={120}
        placeholder={t('placeSearch.collectionPlaceholder')}
        onSubmitEditing={() => void save()}
      />
      <Action
        label={t(editing ? 'folders.rename' : 'placeSearch.createCollection')}
        disabled={!name.trim() || (!editing && book.state.collections.length >= 50)}
        busy={busy}
        onPress={() => void save()}
        icon={editing ? 'check' : 'plus'}
      />
      {editing ? (
        <Action
          label={t('common.cancel')}
          secondary
          onPress={() => {
            setEditing(null);
            setName('');
          }}
        />
      ) : null}
      {error ? <Notice>{t('common.saveError')}</Notice> : null}
      {book.state.collections.map((c) => (
        <View
          key={c.id}
          style={{
            padding: 18,
            borderRadius: 18,
            backgroundColor: colors.paper,
            borderWidth: 1,
            borderColor: colors.rule,
            gap: 14,
          }}
        >
          <View style={ui.between}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={[ui.body, { fontWeight: '700' }]}>{c.name}</Text>
              <Text style={ui.muted}>
                {t('sharing.placeCount', {
                  count: book.state.places.filter((p) => p.collectionId === c.id).length,
                })}
              </Text>
            </View>
            <IconButton
              name="edit"
              label={`${c.name} ${t('folders.rename')}`}
              onPress={() => {
                setEditing(c.id);
                setName(c.name);
              }}
            />
            <IconButton
              name="trash"
              label={`${c.name} ${t('folders.delete')}`}
              onPress={() => setDeleting(c.id)}
            />
          </View>
          {deleting === c.id ? (
            <>
              <Text style={ui.muted}>{t('folders.description')}</Text>
              <Action danger label={t('folders.delete')} busy={busy} onPress={() => void remove(c.id)} />
              <Action secondary label={t('common.cancel')} onPress={() => setDeleting(null)} />
            </>
          ) : null}
        </View>
      ))}
      {!book.state.collections.length ? (
        <Empty title={t('folders.emptyTitle')} body={t('placeSearch.newCollection')} />
      ) : null}
    </Sheet>
  );
}
