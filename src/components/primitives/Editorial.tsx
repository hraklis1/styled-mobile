import type { ReactNode } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing, typography } from '../../theme';
import { PressableScale } from './PressableScale';
import { AppText } from './AppText';

type IconName = keyof typeof Ionicons.glyphMap;

type HeaderAction = {
  label: string;
  icon: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  accessibilityLabel?: string;
};

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  subtitleNode?: ReactNode;
  eyebrow?: string;
  primaryAction?: HeaderAction;
  secondaryActions?: HeaderAction[];
  safeTop?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * `default` — system sans, used across most screens with an active header.
   * `display` — the serif editorial face for tab mastheads (Home, Closet,
   * Calendar). Its subtitle is set as tracked `meta` — a line-sheet count or
   * dek under a headline, not a sentence.
   */
  titleVariant?: 'default' | 'display';
};

export function ScreenHeader({
  title,
  subtitle,
  subtitleNode,
  eyebrow,
  primaryAction,
  secondaryActions = [],
  safeTop = true,
  style,
  titleVariant = 'default',
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.3;

  return (
    <View style={[styles.header, safeTop && { paddingTop: insets.top + spacing.md }, stacked && styles.headerStacked, style]}>
      <View style={[styles.headerCopy, stacked && styles.headerCopyStacked]}>
        {eyebrow ? <AppText variant="eyebrow" tone="brand">{eyebrow}</AppText> : null}
        <AppText
          variant={titleVariant === 'display' ? 'editorialHero' : 'pageTitle'}
          tone="primary"
          style={styles.headerTitle}
          numberOfLines={stacked ? undefined : titleVariant === 'display' ? 2 : 1}
        >
          {title}
        </AppText>
        {subtitleNode ?? (subtitle ? (
          <AppText
            variant={titleVariant === 'display' ? 'meta' : 'bodySmall'}
            tone="muted"
            style={styles.headerSubtitle}
            numberOfLines={2}
          >
            {subtitle}
          </AppText>
        ) : null)}
      </View>
      {(primaryAction || secondaryActions.length > 0) && (
        <View style={styles.headerActions}>
          {secondaryActions.map((action) => (
            <IconButton key={action.label} {...action} variant={action.variant ?? 'secondary'} />
          ))}
          {primaryAction ? <ActionButton {...primaryAction} /> : null}
        </View>
      )}
    </View>
  );
}

export function EditorialSection({
  title,
  description,
  actionLabel,
  onAction,
  variant = 'plain',
  headingStyle = 'default',
  trailing,
  children,
  style,
}: {
  title: string;
  /** One line on what the section holds, for sections whose contents aren't self-evident. */
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * `plain` — a titled block on the page background (overview screens).
   * `ruled` — hairline-separated editorial section with a small uppercase
   * eyebrow, for detail screens where sections stack continuously.
   */
  variant?: 'plain' | 'ruled';
  /**
   * `default` keeps the section's existing heading treatment.
   * `editorial` is the department-label treatment for overview screens: a
   * small tracked uppercase label over a visible rule. It deliberately does
   * *not* compete on size with the serif ledes inside the section — the
   * label is findable because nothing else on the page looks like it, not
   * because it is the biggest thing around.
   */
  headingStyle?: 'default' | 'editorial';
  /** Rendered in the header row in place of an action, e.g. a status badge. */
  trailing?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.3;
  const ruled = variant === 'ruled';
  const editorialHeading = headingStyle === 'editorial';

  return (
    <View style={[
      editorialHeading ? styles.editorialSection : ruled ? styles.ruledSection : styles.section,
      style,
    ]}>
      <View style={[
        styles.sectionHeader,
        editorialHeading ? styles.editorialSectionHeader : null,
        description ? styles.sectionHeaderTight : null,
        stacked && styles.sectionHeaderStacked,
      ]}>
        <AppText
          variant={editorialHeading ? 'eyebrowLarge' : ruled ? 'eyebrow' : 'sectionTitle'}
          tone={editorialHeading ? 'primary' : ruled ? 'muted' : 'primary'}
          style={editorialHeading ? styles.editorialSectionTitle : ruled ? styles.ruledSectionTitle : undefined}
        >
          {title}
        </AppText>
        {trailing}
        {actionLabel && onAction ? (
          <PressableScale
            haptic={false}
            onPress={onAction}
            motion="crisp" scaleTo={0.985}
            pressedContentStyle={editorialHeading ? undefined : styles.controlPressed}
            contentStyle={editorialHeading ? styles.editorialSectionAction : styles.sectionAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            {/* Under a department label the action is a text link on the
                same baseline — a 44pt pill floated a full line above the rule
                and read as detached from the title it belonged to. */}
            {/* Quieter than the label it serves: the heading names the
                section, the link is a way out of it. */}
            <AppText
              variant={editorialHeading ? 'bodySmall' : 'label'}
              tone={editorialHeading ? 'secondary' : 'action'}
              style={styles.sectionActionText}
            >
              {actionLabel}{editorialHeading ? ' →' : ''}
            </AppText>
          </PressableScale>
        ) : null}
      </View>
      {description ? <AppText variant={editorialHeading ? 'meta' : 'bodySmall'} tone={editorialHeading ? 'muted' : 'secondary'} style={styles.sectionDescription}>{description}</AppText> : null}
      {children}
    </View>
  );
}

export function IconButton({
  label,
  icon,
  onPress,
  variant = 'secondary',
  accessibilityLabel,
  style,
}: HeaderAction & { style?: StyleProp<ViewStyle> }) {
  return (
    <PressableScale
      motion="crisp" scaleTo={0.985}
      pressedContentStyle={variant === 'primary' ? styles.primaryPressed : styles.controlPressed}
      contentStyle={[styles.iconButton, styles[`${variant}IconButton`], style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Ionicons
        name={icon}
        size={19}
        color={variant === 'primary' ? colors.primaryForeground : colors.foreground}
      />
    </PressableScale>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  accessibilityLabel,
  style,
}: HeaderAction & { style?: StyleProp<ViewStyle> }) {
  return (
    <PressableScale
      motion="crisp" scaleTo={0.985}
      pressedContentStyle={variant === 'primary' ? styles.primaryPressed : styles.controlPressed}
      contentStyle={[styles.actionButton, styles[`${variant}ActionButton`], style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Ionicons
        name={icon}
        size={16}
        color={variant === 'primary' ? colors.primaryForeground : colors.foreground}
      />
      <AppText variant="label" tone={variant === 'primary' ? 'inverse' : 'primary'} style={styles.actionButtonText}>
        {label}
      </AppText>
    </PressableScale>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  variant = 'pill',
  style,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  variant?: 'pill' | 'tabs';
  style?: StyleProp<ViewStyle>;
}) {
  const isTabs = variant === 'tabs';

  return (
    <View style={[isTabs ? styles.tabsSegment : styles.segment, style]} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <PressableScale
            key={option.value}
            haptic={false}
            scaleTo={0.98}
            contentStyle={[
              isTabs ? styles.tabsButton : styles.segmentButton,
              active && !isTabs && styles.segmentButtonActive,
            ]}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <AppText
              variant={isTabs ? 'label' : 'bodySmall'}
              tone={active ? 'primary' : 'muted'}
              style={isTabs ? styles.tabsText : styles.segmentText}
              numberOfLines={1}
            >
              {option.label}
            </AppText>
            {isTabs && <View style={[styles.tabsUnderline, active && styles.tabsUnderlineActive]} />}
          </PressableScale>
        );
      })}
    </View>
  );
}

export function FilterControl({
  count = 0,
  onPress,
  label = 'Sort and filter',
}: {
  count?: number;
  onPress: () => void;
  label?: string;
}) {
  const active = count > 0;
  return (
    <PressableScale
      contentStyle={[styles.filterControl, active && styles.filterControlActive]}
      hitSlop={6}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}${active ? `, ${count} active` : ''}`}
    >
      <Ionicons name="options-outline" size={18} color={colors.foreground} />
      {active ? <AppText variant="caption" tone="inverse" style={styles.filterCount}>{count}</AppText> : null}
    </PressableScale>
  );
}

export function ViewModeControl({
  value,
  onChange,
}: {
  value: 'grid' | 'list';
  onChange: (value: 'grid' | 'list') => void;
}) {
  return (
    <View style={styles.viewModeControl} accessibilityRole="tablist">
      {([
        { value: 'grid' as const, icon: 'grid-outline' as const, label: 'Grid view' },
        { value: 'list' as const, icon: 'list-outline' as const, label: 'List view' },
      ]).map((option) => {
        const selected = value === option.value;
        return (
          <PressableScale
            key={option.value}
            scaleTo={0.96}
            contentStyle={[styles.viewModeButton, selected && styles.viewModeButtonActive]}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
          >
            <Ionicons
              name={option.icon}
              size={18}
              color={selected ? colors.foreground : colors.mutedForeground}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

export function EditorialCardMeta({
  title,
  subtitle,
  eyebrow,
  trailing,
  style,
  titleStyle,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[styles.cardMeta, style]}>
      <View style={styles.cardMetaCopy}>
        {eyebrow ? <AppText variant="eyebrow" tone="brand" numberOfLines={1}>{eyebrow}</AppText> : null}
        <AppText variant="cardTitle" tone="primary" style={titleStyle} numberOfLines={2}>{title}</AppText>
        {subtitle ? <AppText variant="caption" tone="muted" numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.page,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  headerStacked: { flexDirection: 'column', alignItems: 'stretch' },
  headerCopyStacked: { flex: 0 },
  headerCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  headerTitle: { flexShrink: 1 },
  headerSubtitle: { flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 0 },
  iconButton: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.action,
  },
  primaryPressed: { backgroundColor: colors.primaryPressed },
  controlPressed: { backgroundColor: colors.surfaceSelected },
  primaryIconButton: { backgroundColor: colors.primary },
  secondaryIconButton: {
    backgroundColor: colors.surfaceSubtle,
  },
  ghostIconButton: { backgroundColor: 'transparent' },
  actionButton: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radii.action,
  },
  primaryActionButton: { backgroundColor: colors.primary },
  secondaryActionButton: {
    backgroundColor: colors.surfaceSubtle,
  },
  ghostActionButton: { backgroundColor: 'transparent' },
  actionButtonText: { flexShrink: 1 },
  primaryActionButtonText: { color: colors.primaryForeground },
  ruledSectionActionText: { color: colors.action },
  section: {
    marginBottom: spacing.section,
  },
  ruledSection: {
    paddingVertical: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  // The editorial heading carries its own rule *under* the label, so the
  // section takes none at the top — one line per boundary, not two. The
  // asymmetric padding binds the label to the content it introduces.
  editorialSection: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  editorialSectionHeader: {
    minHeight: 22, alignItems: 'flex-end', paddingBottom: spacing.sm, marginBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  sectionHeader: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionHeaderStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: spacing.sm },
  // A description carries its own gap to the content below it.
  sectionHeaderTight: { marginBottom: spacing.xs },
  ruledSectionTitle: {
    flex: 1,
  },
  editorialSectionTitle: {
    flex: 1,
  },
  sectionDescription: {
    maxWidth: 330,
    marginBottom: spacing.md,
  },
  sectionAction: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle,
  },
  sectionActionText: {
    flexShrink: 1,
  },
  // Same 44pt hit target, laid out so its text sits on the eyebrow's baseline
  // rather than in a plate above it.
  editorialSectionAction: {
    minHeight: 44, justifyContent: 'flex-end', paddingLeft: spacing.md,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.full,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  segmentButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
  },
  segmentButtonActive: {
    backgroundColor: colors.surfaceElevated,
    ...shadows.xs,
  },
  segmentText: {},
  segmentTextActive: {},
  tabsSegment: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xl,
  },
  tabsButton: {
    minHeight: 44,
    justifyContent: 'flex-end',
    gap: 5,
  },
  tabsText: {},
  tabsTextActive: {},
  tabsUnderline: {
    width: '100%',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  tabsUnderlineActive: {
    backgroundColor: colors.primary,
  },
  filterControl: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, backgroundColor: colors.surfaceSubtle,
  },
  // Selected controls retain the same container and gain a defined edge.
  filterControlActive: {
    borderWidth: 1, borderColor: colors.controlOutline, backgroundColor: colors.surfaceSelected,
  },
  // A corner badge, so the control keeps its 44pt circle instead of stretching
  // into a pill the moment a filter is on.
  filterCount: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: radii.full,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    fontSize: 10,
    lineHeight: 16,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
  viewModeControl: {
    minHeight: 44, flexDirection: 'row', gap: spacing.xs,
  },
  viewModeButton: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, backgroundColor: colors.surfaceSubtle,
  },
  viewModeButtonActive: {
    borderWidth: 1, borderColor: colors.controlOutline, backgroundColor: colors.surfaceSelected,
  },
  cardMeta: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardMetaCopy: { flex: 1, minWidth: 0, gap: 2 },
  cardEyebrow: {},
  cardTitle: {},
  cardSubtitle: {},
});
