import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from 'react-native-reanimated';
import { getSwatchColor } from '../../lib/colorUtils';
import type { ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import { colors, radii, shoppingSurfaces, typography } from '../../theme';

/** Illustrative silhouettes convey category and color, never a fabric or stock claim. */
const silhouettes = {
  trousers: 'M27 16H73L79 105H55L50 48L45 105H21Z',
  top: 'M33 18L16 28L6 53L24 60L29 45V105H71V45L76 60L94 53L84 28L67 18Q50 34 33 18Z',
  dress: 'M35 15L26 39L37 47L18 105H82L63 47L74 39L65 15Q50 29 35 15Z',
  skirt: 'M32 22H68L84 104H16Z',
  shoes: 'M18 57L37 65L48 49L58 60L66 77L86 82Q97 86 91 97H11V76Z',
  bag: 'M22 43H78L85 103H15ZM35 43V30Q50 7 65 30V43H58V31Q50 19 42 31V43Z',
};
function silhouette(category: string) {
  if (/trouser|pant|jean|short|bottom/i.test(category)) return silhouettes.trousers;
  if (/shoe|foot|sneaker|boot|loafer|sandal/i.test(category)) return silhouettes.shoes;
  if (/dress|jumpsuit/i.test(category)) return silhouettes.dress;
  if (/skirt/i.test(category)) return silhouettes.skirt;
  if (/bag/i.test(category)) return silhouettes.bag;
  if (/top|shirt|jacket|coat|outer|blazer|knit|sweater|tee/i.test(category)) return silhouettes.top;
  return null;
}
/**
 * `plain` sets the piece on white, matching retailer photography, instead of
 * the bone plate. `fill` crops a photo to the frame so a retailer's own
 * backdrop never leaves bands — for large frames where the piece is the hero.
 */
export function ShoppingStyleVisual({ target, plain = false, fill = false }: { target: ShoppingPriorityTarget; plain?: boolean; fill?: boolean }) {
  const uri = target.offers?.find((offer) => offer.imageUrl)?.imageUrl ?? target.imageUrl;
  const [failed, setFailed] = useState(false);
  const reduceMotion = useReducedMotion();
  useEffect(() => setFailed(false), [uri]);
  const path = silhouette(target.category ?? '');
  const color = getSwatchColor(target.color ?? '').primary;
  return (
    <View
      style={[styles.frame, plain && styles.plain]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={fill ? 'cover' : 'contain'}
          cachePolicy="memory"
          transition={reduceMotion ? 0 : 150}
          onError={() => setFailed(true)}
        />
      ) : path ? (
        <Svg width="82%" height="86%" viewBox="0 0 100 120">
          <Path d={path} fill={color} stroke={colors.controlOutline} strokeWidth={1} />
        </Svg>
      ) : (
        <View style={styles.plate}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
          <Text style={styles.caption}>{target.category}</Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: shoppingSurfaces.bone,
    borderRadius: radii.photo,
    overflow: 'hidden',
  },
  plain: { backgroundColor: colors.surfaceElevated },
  plate: { padding: 8, alignItems: 'center', gap: 8 },
  swatch: { width: 28, height: 36, borderRadius: 2 },
  caption: { ...typography.text.caption, color: colors.inkSubtle, textAlign: 'center' },
});
