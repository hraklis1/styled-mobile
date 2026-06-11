import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { track } from '../../lib/analytics';
import { useOutfits, useDeleteOutfit, useMarkOutfitWorn, useVisualizeOutfit, useUpdateOutfit } from '../../hooks/useOutfits';
import { useItems } from '../../hooks/useItems';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { CommonActions } from '@react-navigation/native';
import { colors, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS } from '../../types/item';
import type { OutfitDetailScreenProps } from '../../navigation/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function Chip({ label }: { label: string }) {
  return (
    <View style={chipStyles.chip}>
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  );
}
const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
});

const LOADING_PHRASES = [
  'Analyzing pieces...',
  'Arranging layout...',
  'Adding final polish...',
  'Styling your look...',
];

function FlatLayLoadingOverlay({ width }: { width: number }) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.75, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const cycle = setInterval(() => {
      Animated.timing(textOpacity, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => {
        setPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length);
        Animated.timing(textOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      });
    }, 2500);
    return () => clearInterval(cycle);
  }, [textOpacity]);

  return (
    <View style={[overlayStyles.container, { width, height: width }]}>
      <Animated.View
        style={{ ...StyleSheet.absoluteFill, opacity: pulseAnim, backgroundColor: colors.muted }}
      />
      <View style={overlayStyles.textBox}>
        <ActivityIndicator size="small" color={colors.mutedForeground} />
        <Animated.Text style={[overlayStyles.phrase, { opacity: textOpacity }]}>
          {LOADING_PHRASES[phraseIndex]}
        </Animated.Text>
      </View>
    </View>
  );
}

const overlayStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  textBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
    backgroundColor: 'rgba(250, 248, 245, 0.85)',
    borderRadius: radii.full,
  },
  phrase: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
  },
});

export function OutfitDetailScreen({ route, navigation }: OutfitDetailScreenProps) {
  const { outfitId } = route.params;
  const { data: outfits = [] } = useOutfits();
  const { data: items = [] } = useItems();
  const outfit = outfits.find((o) => o.id === outfitId);

  const deleteOutfit = useDeleteOutfit();
  const markWorn = useMarkOutfitWorn();
  const visualize = useVisualizeOutfit();
  const updateOutfit = useUpdateOutfit();

  const [localName, setLocalName] = useState(outfit?.name ?? '');
  const [localNotes, setLocalNotes] = useState(outfit?.notes ?? '');
  const [localTags, setLocalTags] = useState<string[]>(outfit?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');

  useEffect(() => {
    if (outfit) {
      setLocalName(outfit.name);
      setLocalNotes(outfit.notes ?? '');
      setLocalTags(outfit.tags ?? []);
    }
  }, [outfit?.id]);

  useEffect(() => {
    if (outfitId) track('outfit_viewed', { outfit_id: outfitId });
  }, [outfitId]);

  const addTag = useCallback((raw: string) => {
    if (!outfit) return;
    const tag = raw.trim().toLowerCase();
    if (!tag || localTags.includes(tag)) {
      setTagDraft('');
      return;
    }
    const next = [...localTags, tag];
    setLocalTags(next);
    setTagDraft('');
    updateOutfit.mutate({ id: outfit.id, tags: next });
  }, [localTags, outfit, updateOutfit]);

  const removeTag = useCallback((tag: string) => {
    if (!outfit) return;
    const next = localTags.filter(t => t !== tag);
    setLocalTags(next);
    updateOutfit.mutate({ id: outfit.id, tags: next });
  }, [localTags, outfit, updateOutfit]);

  const [notesSaved, setNotesSaved] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<TextInput>(null);
  const tagInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);

  const saveName = useCallback(() => {
    if (!outfit) return;
    const trimmed = localName.trim();
    if (!trimmed || trimmed === outfit.name) return;
    updateOutfit.mutate({ id: outfit.id, name: trimmed });
  }, [localName, outfit, updateOutfit]);

  const saveNotes = useCallback(() => {
    if (!outfit) return;
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    updateOutfit.mutate(
      { id: outfit.id, notes: localNotes.trim() || null },
      {
        onSuccess: () => {
          notesInputRef.current?.blur();
          setNotesSaved(true);
          savedTimerRef.current = setTimeout(() => setNotesSaved(false), 2000);
        },
      }
    );
  }, [localNotes, outfit, updateOutfit]);

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const pieces = useMemo(() => {
    if (!outfit) return [];
    return (outfit.itemIds ?? []).map((e) => ({
      entry: e,
      item: itemMap.get(e.id) ?? null,
    }));
  }, [outfit, itemMap]);

  const hasDeletedPieces = pieces.some((p) => p.item === null);

  if (!outfit) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isBusy = deleteOutfit.isPending || markWorn.isPending;
  const handleMarkWorn = () => markWorn.mutate(outfit.id);
  const handleGenerate = (force = false) => visualize.mutate({ id: outfit.id, force });

  // When OutfitDetail is the only screen in the ClosetStack (opened from the Home tab),
  // goBack() would bubble up to the tab navigator and go to Home — but leave OutfitDetail
  // at the top of the ClosetStack. Reset to ClosetMain first so the Closet tab is clean.
  const handleBack = () => {
    const { routes } = navigation.getState();
    if (routes.length > 1) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'ClosetMain' }] });
      navigation.dispatch(CommonActions.navigate({ name: 'Home' }));
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete outfit',
      `Delete "${outfit.name}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteOutfit.mutate(outfit.id);
            handleBack();
          },
        },
      ]
    );
  };

  const hasAiImage = !!outfit.aiGeneratedImageUrl;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero ── */}
        <View style={{ position: 'relative' }}>
          <OutfitCollage outfit={outfit} size={width} borderRadius={0} />

          {/* Dark tint over collage grid — before generation only */}
          {!hasAiImage && !visualize.isPending && (
            <View style={[StyleSheet.absoluteFill, styles.collageOverlay]} />
          )}

          {/* Shimmer + cycling text — while generating */}
          {visualize.isPending && <FlatLayLoadingOverlay width={width} />}

          {/* Back */}
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + spacing.sm }]}
            onPress={handleBack}
          >
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </TouchableOpacity>

          {/* Delete — top-right */}
          <TouchableOpacity
            style={[styles.headerIconButton, { top: insets.top + spacing.sm }]}
            onPress={handleDelete}
            disabled={isBusy}
          >
            <Ionicons name="trash-outline" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* ── Generate / Regenerate ── */}
        {!hasAiImage && !visualize.isPending && !visualize.isError && (
          <TouchableOpacity style={styles.generateCta} onPress={() => handleGenerate()}>
            <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
            <Text style={styles.generateCtaLabel}>Generate flat-lay</Text>
          </TouchableOpacity>
        )}

        {visualize.isError && (
          <View style={styles.generateErrorRow}>
            <Text style={styles.generateErrorText}>
              {(visualize.error as any)?.response?.data?.message ?? 'Generation failed'}
            </Text>
            <TouchableOpacity onPress={() => handleGenerate(hasAiImage)}>
              <Text style={styles.retryLabel}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {hasAiImage && !visualize.isPending && (
          <TouchableOpacity style={styles.regenRow} onPress={() => handleGenerate(true)}>
            <Ionicons name="refresh-outline" size={13} color={colors.mutedForeground} />
            <Text style={styles.regenLabel}>Regenerate</Text>
          </TouchableOpacity>
        )}

        {/* ── Title ── */}
        <View style={[styles.header, { maxWidth: width }]}>
          <View style={[styles.nameRow, isNameFocused && styles.nameRowFocused]}>
            <TextInput
              ref={nameInputRef}
              style={styles.name}
              value={localName}
              onChangeText={setLocalName}
              onFocus={() => setIsNameFocused(true)}
              onBlur={() => { setIsNameFocused(false); saveName(); }}
              onSubmitEditing={saveName}
              returnKeyType="done"
              autoCapitalize="words"
              selectTextOnFocus
              editable={isNameFocused}
            />
            {!isNameFocused && (
              <TouchableOpacity
                onPress={() => {
                  setIsNameFocused(true);
                  setTimeout(() => nameInputRef.current?.focus(), 0);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          {outfit.event ? (
            <View style={styles.eventRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
              <Text style={styles.event}>{outfit.event}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Primary CTA ── */}
        <TouchableOpacity
          style={[styles.wornButton, isBusy && styles.actionDisabled]}
          onPress={handleMarkWorn}
          disabled={isBusy}
        >
          {markWorn.isPending ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.primaryForeground} />
              <Text style={styles.wornButtonLabel}>Worn today</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Details ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Times worn</Text>
              <Text style={styles.detailValue}>{outfit.wearCount}</Text>
            </View>
            {outfit.lastWornAt && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Last worn</Text>
                <Text style={styles.detailValue}>{formatDate(outfit.lastWornAt)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Pieces ── */}
        {pieces.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pieces ({pieces.length})</Text>
            <View style={styles.piecesGrid}>
              {pieces.map(({ entry, item }) => {
                if (!item) {
                  return (
                    <View key={`deleted-${entry.id}`} style={[styles.pieceItem, styles.pieceGhost]}>
                      <View style={[styles.pieceImageContainer, styles.pieceGhostImage]}>
                        <Ionicons name="trash-outline" size={20} color={colors.mutedForeground} />
                      </View>
                      <Text style={[styles.pieceName, styles.pieceGhostText]} numberOfLines={1}>Deleted</Text>
                      <Text style={styles.pieceCategory} numberOfLines={1}>
                        {CATEGORY_LABELS[entry.category as keyof typeof CATEGORY_LABELS] ?? entry.category}
                      </Text>
                    </View>
                  );
                }
                const uri = resolveImageUri(item.imageUrl);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.pieceItem}
                    onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
                    activeOpacity={0.75}
                  >
                    <View style={styles.pieceImageContainer}>
                      {uri ? (
                        <Image
                          source={{ uri }}
                          style={styles.pieceImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.pieceImage, styles.piecePlaceholder]}>
                          <Ionicons name="shirt-outline" size={20} color={colors.border} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.pieceName} numberOfLines={1}>{item.name}</Text>
                    {item.category ? (
                      <Text style={styles.pieceCategory} numberOfLines={1}>
                        {CATEGORY_LABELS[item.category]}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            {hasDeletedPieces && (
              <TouchableOpacity
                style={styles.clearDeletedBtn}
                onPress={() => {
                  const validIds = pieces.filter((p) => p.item).map((p) => p.entry);
                  updateOutfit.mutate({ id: outfit.id, itemIds: validIds });
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={13} color={colors.mutedForeground} />
                <Text style={styles.clearDeletedText}>Clear deleted items</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Tags ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Tags</Text>
          {localTags.length > 0 && (
            <View style={styles.chipRow}>
              {localTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[chipStyles.chip, styles.tagChip]}
                  onPress={() => removeTag(tag)}
                  activeOpacity={0.7}
                >
                  <Text style={chipStyles.label}>{tag}</Text>
                  <Ionicons name="close-circle" size={13} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.tagAddRow}>
            <TextInput
              ref={tagInputRef}
              style={styles.tagAddInput}
              value={tagDraft}
              onChangeText={setTagDraft}
              placeholder="e.g. summer, casual, linen…"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => addTag(tagDraft)}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.tagAddBtn, !tagDraft.trim() && styles.tagAddBtnDisabled]}
              onPress={() => addTag(tagDraft)}
              disabled={!tagDraft.trim()}
              activeOpacity={0.75}
            >
              <Text style={[styles.tagAddBtnLabel, !tagDraft.trim() && styles.tagAddBtnLabelDisabled]}>
                Add
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Notes ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            ref={notesInputRef}
            style={styles.notesTextArea}
            value={localNotes}
            onChangeText={setLocalNotes}
            placeholder="Add styling notes, reminders, or outfit inspiration…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
            autoCapitalize="sentences"
          />
          <View style={styles.notesFooter}>
            {notesSaved ? (
              <View style={styles.notesSavedBadge}>
                <Ionicons name="checkmark" size={13} color={colors.primary} />
                <Text style={styles.notesSavedText}>Saved</Text>
              </View>
            ) : localNotes.trim() !== (outfit.notes ?? '') ? (
              <TouchableOpacity
                style={[styles.notesSaveBtn, updateOutfit.isPending && styles.actionDisabled]}
                onPress={saveNotes}
                disabled={updateOutfit.isPending}
                activeOpacity={0.8}
              >
                <Text style={styles.notesSaveBtnLabel}>Save</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const PIECE_SIZE = 80;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: spacing.xxxl },

  // ── Hero buttons ──
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  headerIconButton: {
    position: 'absolute',
    right: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },

  // ── Collage overlay ──
  collageOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },

  // ── Generate / Regenerate ──
  generateCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  generateCtaLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  generateErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  generateErrorText: {
    fontSize: typography.size.sm,
    color: colors.error,
  },
  retryLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  regenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  regenLabel: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },

  // ── Header / Title ──
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderBottomWidth: 1.5,
    borderBottomColor: 'transparent',
    paddingBottom: 2,
  },
  nameRowFocused: {
    borderBottomColor: colors.primary,
  },
  name: {
    flex: 1,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
    lineHeight: typography.size.xl * typography.lineHeight.normal,
  },
  nameEditIcon: {
    flexShrink: 0,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  event: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },

  // ── Primary CTA ──
  wornButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md + 2,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
  },
  wornButtonLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  actionDisabled: { opacity: 0.5 },

  // ── Section cards ──
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },

  detailGrid: { gap: spacing.sm },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },
  detailValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },

  piecesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  pieceItem: {
    width: PIECE_SIZE,
    alignItems: 'center',
  },
  pieceImageContainer: {
    width: PIECE_SIZE,
    height: PIECE_SIZE,
    borderRadius: radii.md,
    overflow: 'hidden',
    marginBottom: spacing.xs,
    backgroundColor: colors.muted,
  },
  pieceImage: {
    width: '100%',
    height: '100%',
  },
  piecePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  pieceName: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    textAlign: 'center',
  },
  pieceCategory: {
    fontSize: 10,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  pieceGhost: {
    opacity: 0.5,
  },
  pieceGhostImage: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  pieceGhostText: {
    color: colors.mutedForeground,
  },
  clearDeletedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  clearDeletedText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tagAddInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.sm,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  tagAddBtn: {
    height: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagAddBtnDisabled: {
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagAddBtnLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  tagAddBtnLabelDisabled: {
    color: colors.mutedForeground,
  },
  notesTextArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.foreground,
    lineHeight: typography.size.md * 1.5,
    minHeight: 100,
    backgroundColor: colors.background,
    textAlignVertical: 'top',
  },
  notesFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: 36,
    marginTop: spacing.sm,
  },
  notesSaveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  notesSaveBtnLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  notesSavedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notesSavedText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
});
