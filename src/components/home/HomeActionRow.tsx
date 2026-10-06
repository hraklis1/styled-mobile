import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, shadows, spacing, stroke, typography } from '../../theme';

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
  loggedToday?: boolean;
  style?: StyleProp<ViewStyle>;
};

const DISC = 56;

/**
 * Home's everyday actions as one quiet row of discs. The stylist is the
 * charcoal primary; closet, wear and shop sit beside it as outlined
 * twins. Add and Save find both open a camera, so each wears its own glyph
 * (camera + plus for the closet, price tag + camera for shopping). What each
 * does is taught once by the first-run tour, so the captions stay one word.
 */
export const HomeActionRow = forwardRef<HomeActionRowHandle, Props>(function HomeActionRow(
  { onAskStylist, onAddToCloset, onSaveFind, onLogWear, loggedToday = false, style },
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
    key: HomeActionKey; label: string; icon: keyof typeof Ionicons.glyphMap; primary?: boolean;
    badge?: keyof typeof Ionicons.glyphMap; onPress: () => void; a11y: string; hint: string;
  }[] = [
    {
      key: 'stylist', label: 'Stylist', icon: 'chatbubble-ellipses-outline', primary: true, onPress: onAskStylist,
      a11y: 'Ask your stylist', hint: 'Opens your stylist',
    },
    {
      key: 'closet', label: 'Add', icon: 'camera-outline', badge: 'add', onPress: onAddToCloset,
      a11y: 'Add to my closet', hint: 'Take a photo, choose from your library, or import several pieces',
    },
    {
      key: 'wear', label: loggedToday ? 'Logged' : 'Log wear', icon: loggedToday ? 'checkmark' : 'calendar-outline',
      onPress: onLogWear, a11y: loggedToday ? 'Today’s outfit logged' : 'Log today’s outfit', hint: 'Record what you wore today',
    },
    {
      key: 'shop', label: 'Save find', icon: 'pricetag-outline', badge: 'camera', onPress: onSaveFind,
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
            style={[styles.disc, action.primary ? styles.discPrimary : styles.discQuiet]}
          >
            <Ionicons
              name={action.icon}
              size={22}
              color={action.primary ? colors.primaryForeground : colors.foreground}
              accessible={false}
            />
            {action.badge ? (
              <View style={styles.badge}>
                <Ionicons name={action.badge} size={action.badge === 'add' ? 11 : 10} color={colors.primaryForeground} accessible={false} />
              </View>
            ) : null}
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
  },
  discPrimary: { backgroundColor: colors.primary, ...shadows.control },
  discQuiet: { backgroundColor: colors.surfaceSubtle, borderWidth: stroke.fine, borderColor: colors.ghostStroke },
  badge: {
    position: 'absolute', right: -1, bottom: -1, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  label: { ...typography.text.caption, color: colors.inkSubtle, letterSpacing: 0.2 },
});
