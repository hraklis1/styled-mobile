import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { StylistChatView } from '../../components/stylist/StylistChatView';
import { useEntitlement } from '../../hooks/useEntitlement';
import { presentPaywall } from '../../lib/paywall';
import { colors, radii, spacing, typography } from '../../theme';

export function StylistScreen() {
  const { isPremium } = useEntitlement();
  const [openingPaywall, setOpeningPaywall] = useState(false);

  if (isPremium) {
    return (
      <StylistChatView
        source="center_tab"
        threadMode="resume"
        openRequestId={1}
        embedded
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.mark}>
        <Ionicons name="sparkles" size={28} color={colors.primary} />
      </View>
      <Text style={styles.eyebrow}>PRIVATE STYLING</Text>
      <Text style={styles.title}>A stylist who already knows your wardrobe.</Text>
      <Text style={styles.body}>
        Build looks, plan for events, spot wardrobe gaps, and shop with more intention.
      </Text>
      <TouchableOpacity
        style={styles.button}
        disabled={openingPaywall}
        onPress={async () => {
          setOpeningPaywall(true);
          try { await presentPaywall(); } finally { setOpeningPaywall(false); }
        }}
        accessibilityRole="button"
        accessibilityLabel="See premium plans"
      >
        {openingPaywall ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={styles.buttonText}>Meet your stylist</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.background,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSelected,
  },
  eyebrow: {
    marginTop: spacing.sm,
    color: colors.primary,
    fontSize: 11,
    fontWeight: typography.weight.bold,
    letterSpacing: 1.4,
  },
  title: {
    color: colors.foreground,
    fontFamily: typography.family.display,
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
  },
  body: {
    maxWidth: 340,
    color: colors.mutedForeground,
    fontSize: typography.size.md,
    lineHeight: 23,
    textAlign: 'center',
  },
  button: {
    minHeight: 52,
    minWidth: 220,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: colors.primaryForeground,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});
