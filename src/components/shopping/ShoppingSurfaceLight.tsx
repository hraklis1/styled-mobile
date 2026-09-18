import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { shoppingSurfaces } from '../../theme';

export function ShoppingSurfaceLight({ tile = false }: { tile?: boolean }) {
  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={tile ? shoppingSurfaces.tileGradient : shoppingSurfaces.panelGradient}
        locations={tile ? shoppingSurfaces.tileStops : shoppingSurfaces.panelStops}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.highlight} />
    </View>
  );
}
const styles = StyleSheet.create({
  highlight: { position: 'absolute', top: 0, left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: shoppingSurfaces.highlight },
});
