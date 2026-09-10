import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radii, spacing, type } from '@/components/tokens';
import {
  type PrivateCollection,
  deletePrivateCollection,
  renamePrivateCollection,
} from '@/features/places/collectionsApi';
import { PlaceSheetLayout } from '@/features/places/PlaceSheetLayout';

type FolderManagerSheetProps = {
  collections: PrivateCollection[];
  onChange: (collections: PrivateCollection[]) => void;
  onDismiss: () => void;
  visible: boolean;
};

export function FolderManagerSheet({ collections, onChange, onDismiss, visible }: FolderManagerSheetProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startRename = (collection: PrivateCollection): void => {
    setEditingId(collection.id);
    setDraftName(collection.name);
    setDeleteCandidateId(null);
    setError(null);
  };

  const rename = async (collection: PrivateCollection): Promise<void> => {
    if (busyId) return;

    setError(null);
    setBusyId(collection.id);
    try {
      const renamed = await renamePrivateCollection(collection, draftName);
      onChange(collections.map((item) => (item.id === renamed.id ? renamed : item)));
      setEditingId(null);
      setDraftName('');
    } catch {
      setError(t('folders.renameError'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (collection: PrivateCollection): Promise<void> => {
    if (busyId) return;
    if (deleteCandidateId !== collection.id) {
      setDeleteCandidateId(collection.id);
      setEditingId(null);
      setError(null);
      return;
    }

    setError(null);
    setBusyId(collection.id);
    try {
      await deletePrivateCollection(collection);
      onChange(collections.filter((item) => item.id !== collection.id));
      setDeleteCandidateId(null);
    } catch {
      setError(t('folders.deleteError'));
    } finally {
      setBusyId(null);
    }
  };

  const close = (): void => {
    if (busyId) return;
    onDismiss();
  };

  return (
    <PlaceSheetLayout
      closeLabel={t('folders.close')}
      eyebrow={t('folders.eyebrow')}
      onDismiss={close}
      title={t('folders.title')}
      visible={visible}
    >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.description}>{t('folders.description')}</Text>
          {collections.length > 0 ? (
            <View style={styles.list}>
              {collections.map((collection) => {
                const isEditing = editingId === collection.id;
                const isDeleteConfirmationVisible = deleteCandidateId === collection.id;
                const isBusy = busyId === collection.id;

                return (
                  <View key={collection.id} style={styles.item}>
                    {isEditing ? (
                      <View style={styles.editRow}>
                        <TextInput
                          autoFocus
                          maxLength={120}
                          onChangeText={setDraftName}
                          style={styles.input}
                          value={draftName}
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ disabled: isBusy }}
                          disabled={isBusy}
                          onPress={() => void rename(collection)}
                          style={styles.saveButton}
                        >
                          {isBusy ? <ActivityIndicator color={colors.ink} size="small" /> : <Text style={styles.saveText}>✓</Text>}
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.itemName}>{collection.name}</Text>
                        <View style={styles.actions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ disabled: isBusy }}
                            disabled={isBusy}
                            onPress={() => startRename(collection)}
                            style={styles.textButton}
                          >
                            <Text style={styles.editText}>{t('folders.rename')}</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ disabled: isBusy }}
                            disabled={isBusy}
                            onPress={() => void remove(collection)}
                            style={[styles.textButton, isDeleteConfirmationVisible ? styles.deleteConfirmButton : null]}
                          >
                            {isBusy ? <ActivityIndicator color={colors.tomato} size="small" /> : null}
                            <Text style={[styles.deleteText, isDeleteConfirmationVisible ? styles.deleteTextConfirm : null]}>
                              {isDeleteConfirmationVisible ? t('folders.confirmDelete') : t('folders.delete')}
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('folders.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('folders.emptyBody')}</Text>
            </View>
          )}
          {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
    </PlaceSheetLayout>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  closeButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  closeText: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '800',
  },
  content: {
    flexGrow: 1,
    paddingBottom: 32,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
  },
  deleteConfirmButton: {
    backgroundColor: '#FFF0ED',
    borderColor: colors.tomato,
  },
  deleteText: {
    color: colors.tomato,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '900',
  },
  deleteTextConfirm: {
    color: '#A92B1E',
  },
  description: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editText: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '900',
  },
  emptyBody: {
    color: colors.panelMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    gap: 6,
    marginTop: 24,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.paper,
    fontFamily: type.display,
    fontSize: 23,
    fontWeight: '900',
  },
  errorText: {
    color: '#AA2D1D',
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
    marginTop: spacing.md,
  },
  eyebrow: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.paper,
    borderColor: '#CDD3CF',
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontFamily: type.body,
    fontSize: 15,
    height: 46,
    paddingHorizontal: spacing.sm,
  },
  item: {
    alignItems: 'center',
    borderBottomColor: '#CDD3CF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingVertical: 10,
  },
  itemName: {
    color: colors.ink,
    flex: 1,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: '900',
    marginRight: spacing.sm,
  },
  list: {
    borderTopColor: '#CDD3CF',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.wasabi,
    borderRadius: 12,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  saveText: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 18,
    fontWeight: '900',
  },
  textButton: {
    alignItems: 'center',
    borderColor: '#CDD3CF',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 35,
    marginTop: 3,
  },
});
