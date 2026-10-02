/**
 * Settings UI kit: an iOS-grouped list in the app's editorial voice.
 *
 * Every Profile and Settings screen is built from these pieces:
 * - a header (back chevron, serif title, optional trailing action);
 * - rows (navigation, toggle, segmented choice) gathered into groups;
 * - EditScaffold: a header-and-Save frame for the style-profile editors. It
 *   adds an unsaved-changes guard, because each editor has its own Save
 *   rather than one button at the bottom of a 60-field scroll.
 */
import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, radii, stroke } from '../../theme';
import * as Haptics from '../../lib/haptics';

type IconName = keyof typeof Ionicons.glyphMap;

export function ScreenHeader({
  title,
  onBack,
  backIcon = 'chevron-back',
  trailing,
}: {
  title: string;
  onBack?: () => void;
  backIcon?: IconName;
  trailing?: React.ReactNode;
}) {
  const navigation = useNavigation();
  return (
    <View style={[ui.header, { paddingTop: spacing.md }]}>
      <Pressable
        onPress={onBack ?? (() => navigation.goBack())}
        hitSlop={12}
        style={ui.headerSide}
        accessibilityRole="button"
        accessibilityLabel={backIcon === 'close' ? 'Close' : 'Back'}
      >
        <Ionicons name={backIcon} size={24} color={colors.foreground} />
      </Pressable>
      <Text style={ui.headerTitle} numberOfLines={1} accessibilityRole="header">{title}</Text>
      <View style={[ui.headerSide, { alignItems: 'flex-end' }]}>{trailing}</View>
    </View>
  );
}

export function Group({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={ui.group}>
      {!!title && <Text style={ui.groupTitle}>{title}</Text>}
      <View style={ui.groupCard}>
        {rows.map((child, index) => (
          <View key={index}>
            {index > 0 && <View style={ui.separator} />}
            {child}
          </View>
        ))}
      </View>
      {!!footer && <Text style={ui.groupFooter}>{footer}</Text>}
    </View>
  );
}

export function NavRow({
  icon,
  label,
  value,
  detail,
  onPress,
  destructive,
  external,
  badge,
}: {
  icon?: IconName;
  label: string;
  value?: string;
  detail?: string;
  onPress: () => void;
  destructive?: boolean;
  external?: boolean;
  badge?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [ui.row, pressed && ui.rowPressed]}
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={[label, value].filter(Boolean).join(', ')}
    >
      {!!icon && <Ionicons name={icon} size={20} color={destructive ? colors.error : colors.foreground} style={ui.rowIcon} />}
      <View style={ui.rowBody}>
        <Text style={[ui.rowLabel, destructive && { color: colors.error }]}>{label}</Text>
        {!!detail && <Text style={ui.rowDetail} numberOfLines={2}>{detail}</Text>}
      </View>
      {!!badge && <View style={ui.badge}><Text style={ui.badgeText}>{badge}</Text></View>}
      {!!value && <Text style={ui.rowValue} numberOfLines={1}>{value}</Text>}
      {!destructive && (
        <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={external ? 16 : 18} color={colors.controlOutline} />
      )}
    </Pressable>
  );
}

/** A read-only row (an email address, a version number). */
export function InfoRow({ icon, label, detail }: { icon?: IconName; label: string; detail?: string }) {
  return (
    <View style={ui.row} accessible accessibilityLabel={[label, detail].filter(Boolean).join(', ')}>
      {!!icon && <Ionicons name={icon} size={20} color={colors.foreground} style={ui.rowIcon} />}
      <View style={ui.rowBody}>
        <Text style={ui.rowLabel} numberOfLines={1}>{label}</Text>
        {!!detail && <Text style={ui.rowDetail}>{detail}</Text>}
      </View>
    </View>
  );
}

export function ToggleRow({
  icon,
  label,
  detail,
  value,
  onChange,
  disabled,
}: {
  icon?: IconName;
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={ui.row}>
      {!!icon && <Ionicons name={icon} size={20} color={colors.foreground} style={ui.rowIcon} />}
      <View style={ui.rowBody}>
        <Text style={ui.rowLabel}>{label}</Text>
        {!!detail && <Text style={ui.rowDetail}>{detail}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={(next) => { void Haptics.selectionAsync(); onChange(next); }}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.surfaceSelected }}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** A labelled segmented control that sits inside a Group as one row. */
export function SegmentRow<T extends string>({
  label,
  detail,
  options,
  value,
  onChange,
}: {
  label: string;
  detail?: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={[ui.row, ui.rowStacked]}>
      <Text style={ui.rowLabel}>{label}</Text>
      <View style={ui.segment} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              style={[ui.segmentItem, selected && ui.segmentItemSel]}
              onPress={() => { void Haptics.selectionAsync(); onChange(option.value); }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[ui.segmentText, selected && ui.segmentTextSel]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {!!detail && <Text style={ui.rowDetail}>{detail}</Text>}
    </View>
  );
}

/** A free-form block inside a Group (fields, chips, inputs). */
export function GroupBlock({ children }: { children: React.ReactNode }) {
  return <View style={ui.block}>{children}</View>;
}

/**
 * Frame for a style-profile editor. Owns the header Save button and blocks
 * leaving with unsaved edits. Leaving after a successful save is allowed,
 * because `dirty` turns false once the form re-baselines.
 */
export function EditScaffold({
  title,
  lede,
  dirty,
  saving,
  onSave,
  children,
  overlay,
}: {
  title: string;
  lede?: string;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  children: React.ReactNode;
  overlay?: React.ReactNode;
}) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!dirty) return;
    return navigation.addListener('beforeRemove', (event) => {
      event.preventDefault();
      Alert.alert('Discard changes?', 'You have unsaved edits on this page.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
      ]);
    });
  }, [dirty, navigation]);

  return (
    <KeyboardAvoidingView style={ui.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenHeader
        title={title}
        trailing={(
          <Pressable
            onPress={onSave}
            disabled={!dirty || saving}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Save"
            accessibilityState={{ disabled: !dirty || saving }}
          >
            {saving
              ? <ActivityIndicator size="small" color={colors.foreground} />
              : <Text style={[ui.saveText, !dirty && ui.saveTextIdle]}>Save</Text>}
          </Pressable>
        )}
      />
      <ScrollView
        style={ui.root}
        contentContainerStyle={[ui.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!!lede && <Text style={ui.lede}>{lede}</Text>}
        {children}
      </ScrollView>
      {overlay}
    </KeyboardAvoidingView>
  );
}

/** Plain scrolling frame for the Settings screens (no form, no Save). */
export function SettingsScaffold({
  title,
  lede,
  backIcon,
  children,
}: {
  title: string;
  lede?: string;
  backIcon?: IconName;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={ui.root}>
      <ScreenHeader title={title} backIcon={backIcon} />
      <ScrollView
        style={ui.root}
        contentContainerStyle={[ui.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!!lede && <Text style={ui.lede}>{lede}</Text>}
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * Optional depth inside an editor ("Fine-tune"). Collapsed by default so a
 * casual user sees only the essentials; the count tells a power user what is
 * already set without opening it.
 */
export function FineTune({
  title = 'Fine-tune',
  count,
  children,
  initiallyOpen = false,
}: {
  title?: string;
  count: number;
  children: React.ReactNode;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(initiallyOpen);
  return (
    <View style={ui.group}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        style={ui.fineTuneHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={ui.groupTitle}>{title}</Text>
        {count > 0 && <Text style={ui.fineTuneCount}>{count} set</Text>}
        <View style={{ flex: 1 }} />
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>
      {open && <View style={ui.groupCard}><View style={ui.block}>{children}</View></View>}
    </View>
  );
}

export const ui = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  headerSide: { width: 56, minHeight: 44, justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.family.editorialRegular,
    fontSize: 20,
    lineHeight: 26,
    color: colors.foreground,
  },
  saveText: { ...typography.text.bodySmall, fontWeight: typography.weight.semibold, color: colors.foreground },
  saveTextIdle: { color: colors.controlOutline },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xl },
  lede: { ...typography.text.bodySmall, color: colors.mutedForeground, lineHeight: 20 },
  group: { gap: spacing.sm },
  groupTitle: {
    ...typography.text.caption,
    color: colors.mutedForeground,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.tracking.label,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.xs,
  },
  groupFooter: { ...typography.text.caption, color: colors.mutedForeground, paddingHorizontal: spacing.xs, lineHeight: 17 },
  groupCard: { backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' },
  separator: { height: stroke.hairline, backgroundColor: colors.hairline, marginLeft: spacing.lg },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowStacked: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.sm },
  rowPressed: { backgroundColor: colors.surfaceSubtle },
  rowIcon: { width: 22 },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { ...typography.text.body, color: colors.foreground },
  rowDetail: { ...typography.text.caption, color: colors.mutedForeground, lineHeight: 17 },
  rowValue: { ...typography.text.bodySmall, color: colors.mutedForeground, maxWidth: '45%' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.full, backgroundColor: colors.accent },
  badgeText: { ...typography.text.caption, color: colors.accentInk, fontWeight: typography.weight.semibold },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceSubtle, borderRadius: radii.full, padding: 3 },
  segmentItem: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full },
  segmentItemSel: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segmentText: { ...typography.text.bodySmall, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  segmentTextSel: { color: colors.foreground, fontWeight: typography.weight.semibold },
  block: { padding: spacing.lg, gap: spacing.lg },
  fineTuneHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  fineTuneCount: { ...typography.text.caption, color: colors.accentInk },
});
