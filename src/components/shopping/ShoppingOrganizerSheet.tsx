import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SHORTLIST_COPY } from '../../lib/shoppingVocabulary';
import { colors, radii, spacing, typography } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;

export type OrganizerSheetAction = {
  key: string;
  icon: IconName;
  label: string;
  destructive?: boolean;
  run: () => void;
};

export type OrganizerSheetMoveTarget = { id: string; label: string; meta: string | null; thumbUri: string | null };

export type OrganizerSheetContent = {
  /** Changes whenever the sheet is opened on something new; resets its inner view. */
  key: string;
  thumbUri: string | null;
  eyebrow: string;
  title: string;
  meta: string | null;
  /** An editable name in place of the static title. */
  name?: { value: string; placeholder: string; autoFocus?: boolean; onCommit: (value: string) => void };
  /** Garment | Tag switch for a photo. */
  role?: { value: 'garment' | 'tag'; onChange: (role: 'garment' | 'tag') => void };
  actions: OrganizerSheetAction[];
  move?: { targets: OrganizerSheetMoveTarget[]; allowNew: boolean; onMove: (targetId: string | null) => void; startOpen?: boolean };
};

/**
 * Every menu in the organizer, in the app's own clothes: a bottom sheet that
 * leads with the photo it acts on, lists actions as icon rows, and opens
 * "Move to…" in place as a list of the other pieces rather than a second menu.
 */
export function ShoppingOrganizerSheet({ content, onClose }: { content: OrganizerSheetContent | null; onClose: () => void }) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [moving, setMoving] = useState(false);
  const [draftName, setDraftName] = useState('');
  // The last content stays rendered while the sheet animates closed.
  const [shown, setShown] = useState<OrganizerSheetContent | null>(content);

  // Calling dismiss() on a sheet that is not presented wedges @gorhom v5 so
  // every later present() silently does nothing; track it ourselves.
  const isPresented = useRef(false);

  useEffect(() => {
    if (content) {
      setShown(content);
      setMoving(Boolean(content.move?.startOpen));
      setDraftName(content.name?.value ?? '');
    } else if (isPresented.current) {
      isPresented.current = false;
      ref.current?.dismiss();
    }
  }, [content]);

  // Present only once the new content has rendered: a dynamically sized
  // sheet measures what it holds at the moment it opens.
  useEffect(() => {
    if (content && shown?.key === content.key && !isPresented.current) {
      isPresented.current = true;
      ref.current?.present();
    }
  }, [content, shown]);

  const commitName = useCallback(() => {
    if (shown?.name && draftName.trim() !== shown.name.value.trim()) shown.name.onCommit(draftName);
  }, [draftName, shown]);

  // Each action closes the sheet before running, so a follow-on sheet or
  // toast never stacks on one that is still leaving.
  const runAndClose = useCallback((run: () => void) => {
    commitName();
    onClose();
    setTimeout(run, 0);
  }, [commitName, onClose]);

  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} pressBehavior="close" />
  ), []);

  const item = shown;
  const regular = item?.actions.filter((action) => !action.destructive) ?? [];
  const destructive = item?.actions.filter((action) => action.destructive) ?? [];

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      maxDynamicContentSize={height * 0.8}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      onDismiss={() => {
        isPresented.current = false;
        commitName();
        onClose();
      }}
    >
      {item ? (
        <BottomSheetView style={{ paddingBottom: insets.bottom + spacing.md }}>
          <View style={styles.header}>
            {item.thumbUri ? <Image source={{ uri: item.thumbUri }} style={styles.thumb} contentFit="cover" /> : null}
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>{item.eyebrow}</Text>
              {item.name ? (
                <BottomSheetTextInput
                  style={styles.nameInput}
                  value={draftName}
                  onChangeText={setDraftName}
                  onEndEditing={commitName}
                  onSubmitEditing={commitName}
                  placeholder={item.name.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus={item.name.autoFocus}
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  maxLength={60}
                  accessibilityLabel="Piece name"
                />
              ) : (
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              )}
              {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
            </View>
          </View>

          {item.role ? (
            <View style={styles.segment} accessibilityRole="radiogroup">
              {(['garment', 'tag'] as const).map((role) => {
                const active = item.role?.value === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[styles.segmentOption, active && styles.segmentActive]}
                    onPress={() => {
                      if (active) return;
                      item.role?.onChange(role);
                      setShown({ ...item, role: { ...item.role!, value: role } });
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={role === 'tag' ? 'pricetag-outline' : 'shirt-outline'}
                      size={15}
                      color={active ? colors.primaryForeground : colors.foreground}
                    />
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {role === 'tag' ? 'Tag' : 'Garment'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {moving && item.move ? (
            <View style={styles.group}>
              <TouchableOpacity style={styles.backRow} onPress={() => setMoving(false)} accessibilityRole="button">
                <Ionicons name="chevron-back" size={16} color={colors.mutedForeground} />
                <Text style={styles.backText}>{SHORTLIST_COPY.moveTo}</Text>
              </TouchableOpacity>
              {item.move.targets.map((target) => (
                <TouchableOpacity
                  key={target.id}
                  style={styles.row}
                  onPress={() => runAndClose(() => item.move?.onMove(target.id))}
                  accessibilityRole="button"
                >
                  {target.thumbUri
                    ? <Image source={{ uri: target.thumbUri }} style={styles.targetThumb} contentFit="cover" />
                    : <View style={styles.targetThumb} />}
                  <Text style={styles.rowText} numberOfLines={1}>{target.label}</Text>
                  {target.meta ? <Text style={styles.rowMeta}>{target.meta}</Text> : null}
                </TouchableOpacity>
              ))}
              {item.move.allowNew ? (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => runAndClose(() => item.move?.onMove(null))}
                  accessibilityRole="button"
                >
                  <View style={[styles.targetThumb, styles.newThumb]}>
                    <Ionicons name="add" size={18} color={colors.foreground} />
                  </View>
                  <Text style={styles.rowText}>{SHORTLIST_COPY.newPiece}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <>
              <View style={styles.group}>
                {item.move && item.move.targets.length + (item.move.allowNew ? 1 : 0) > 0 ? (
                  <TouchableOpacity style={styles.row} onPress={() => setMoving(true)} accessibilityRole="button">
                    <Ionicons name="swap-horizontal-outline" size={19} color={colors.foreground} style={styles.rowIcon} />
                    <Text style={styles.rowText}>{SHORTLIST_COPY.moveTo}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ) : null}
                {regular.map((action) => (
                  <TouchableOpacity key={action.key} style={styles.row} onPress={() => runAndClose(action.run)} accessibilityRole="button">
                    <Ionicons name={action.icon} size={19} color={colors.foreground} style={styles.rowIcon} />
                    <Text style={styles.rowText}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {destructive.length > 0 ? (
                <View style={[styles.group, styles.destructiveGroup]}>
                  {destructive.map((action) => (
                    <TouchableOpacity key={action.key} style={styles.row} onPress={() => runAndClose(action.run)} accessibilityRole="button">
                      <Ionicons name={action.icon} size={19} color={colors.error} style={styles.rowIcon} />
                      <Text style={[styles.rowText, styles.destructiveText]}>{action.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </BottomSheetView>
      ) : null}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: colors.background },
  handle: { backgroundColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.md },
  thumb: { width: 56, height: 68, borderRadius: radii.photo, backgroundColor: colors.surfaceSubtle },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { ...typography.text.eyebrow, color: colors.mutedForeground },
  title: { ...typography.text.editorialCard, fontSize: 22, lineHeight: 28, color: colors.foreground },
  nameInput: {
    ...typography.text.editorialCard,
    fontSize: 22,
    lineHeight: 28,
    paddingVertical: 2,
    color: colors.foreground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  meta: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  segment: { flexDirection: 'row', gap: 4, marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: 3, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
  segmentOption: { flex: 1, minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radii.full },
  segmentActive: { backgroundColor: colors.foreground },
  segmentText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.medium, color: colors.foreground },
  segmentTextActive: { color: colors.primaryForeground },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  destructiveGroup: { marginTop: spacing.sm },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: { width: 22 },
  rowText: { flex: 1, fontSize: typography.text.body.fontSize, color: colors.foreground },
  rowMeta: { ...typography.text.editorialCard, color: colors.foreground, fontVariant: ['tabular-nums'] },
  destructiveText: { color: colors.error },
  backRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.lg - 2 },
  backText: { ...typography.text.eyebrow, color: colors.mutedForeground },
  targetThumb: { width: 36, height: 44, borderRadius: 6, backgroundColor: colors.surfaceSubtle },
  newThumb: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: 'transparent' },
});
