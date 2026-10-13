import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { EditorialIcon } from '../primitives/EditorialIcon';
import { PressableScale } from '../primitives/PressableScale';
import { colors, spacing, typography } from '../../theme';

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

const DISC = 36;
const GLYPH = 22;

/** Four everyday actions; tour measurement and action order stay stable. */
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
      key: 'closet', label: 'Add piece', icon: 'camera-outline', onPress: onAddToCloset,
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
            <EditorialIcon name={action.key} size={GLYPH} />
          </View>
          <Text style={styles.label} >{action.label.toUpperCase()}</Text>
        </PressableScale>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  cell: { flex: 1, minWidth: 0 },
  cellContent: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 64, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#F5F3EF' },
  disc: {
    width: DISC, height: DISC,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { ...typography.text.utility, fontSize: 10, letterSpacing: 1, fontWeight: '500', color: colors.inkSubtle, textAlign: 'center' },
});
