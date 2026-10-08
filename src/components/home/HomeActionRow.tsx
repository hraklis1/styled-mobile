import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, spacing, stroke, typography } from '../../theme';

export type HomeActionKey = 'stylist' | 'closet' | 'shop' | 'wear';

/** Lets the first-run tour measure each button in window coordinates. */
export type HomeActionRowHandle = {
  measure: (key: HomeActionKey) => Promise<{ x: number; y: number; width: number; height: number } | null>;
};

type Props = {
  onAskStylist: () => void;
  onAddToCloset: () => void;
  onSaveFind: () => void;
  onLogWear: () => void;
  style?: StyleProp<ViewStyle>;
};

const DISC = 56;
const GLYPH = 25;

/**
 * Home's everyday actions as one quiet row of four equal discs. Log wear
 * uses a calendar-with-check (Ionicons has none, so it borrows Material
 * Community's) to read as an action rather than the Calendar tab. No badges:
 * the captions carry it.
 */
export const HomeActionRow = forwardRef<HomeActionRowHandle, Props>(function HomeActionRow(
  { onAskStylist, onAddToCloset, onSaveFind, onLogWear, style },
  ref,
) {
  const refs = { stylist: useRef<View>(null), closet: useRef<View>(null), shop: useRef<View>(null), wear: useRef<View>(null) };

  useImperativeHandle(ref, () => ({
    measure: (key) => new Promise((resolve) => {
      const node = refs[key].current;
      if (!node) return resolve(null);
      node.measureInWindow((x, y, width, height) => resolve(height ? { x, y, width, height } : null));
    }),
  }));

  const actions: {
    key: HomeActionKey; label: string; icon: keyof typeof Ionicons.glyphMap | { mci: keyof typeof MaterialCommunityIcons.glyphMap };
    onPress: () => void; a11y: string; hint: string;
  }[] = [
    {
      key: 'stylist', label: 'Stylist', icon: 'chatbubble-ellipses-outline', onPress: onAskStylist,
      a11y: 'Ask your stylist', hint: 'Opens your stylist',
    },
    {
      key: 'closet', label: 'Add', icon: 'camera-outline', onPress: onAddToCloset,
      a11y: 'Add to my closet', hint: 'Take a photo, choose from your library, or import several pieces',
    },
    {
      key: 'wear', label: 'Log wear', icon: { mci: 'calendar-check-outline' },
      onPress: onLogWear, a11y: 'Log today’s outfit', hint: 'Record what you wore today',
    },
    {
      key: 'shop', label: 'Save find', icon: 'bookmark-outline', onPress: onSaveFind,
      a11y: 'Save a find while shopping', hint: 'Opens the shopping camera to capture something you saw in a store',
    },
  ];

  return (
    <View style={[styles.row, style]}>
      {actions.map((action) => (
        <PressableScale
          key={action.key}
          style={styles.cell}
          contentStyle={styles.cellContent}
          motion="crisp"
          scaleTo={0.94}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.a11y}
          accessibilityHint={action.hint}
        >
          <View
            ref={refs[action.key]}
            collapsable={false}
            style={styles.disc}
          >
            {typeof action.icon === 'string' ? (
              <Ionicons name={action.icon} size={GLYPH} color={colors.foreground} accessible={false} />
            ) : (
              <MaterialCommunityIcons name={action.icon.mci} size={GLYPH + 1} color={colors.foreground} accessible={false} />
            )}
          </View>
          <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.3}>{action.label}</Text>
        </PressableScale>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  cell: { flex: 1, alignItems: 'center' },
  cellContent: { alignItems: 'center', gap: spacing.sm, minWidth: 72 },
  disc: {
    width: DISC, height: DISC, borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle, borderWidth: stroke.fine, borderColor: colors.ghostStroke,
  },
  label: { ...typography.text.caption, color: colors.inkSubtle, letterSpacing: 0.2 },
});
