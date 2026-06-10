import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';

type Props = {
  message?: string;
  onRetry: () => void;
};

export function ErrorState({ message = "Couldn't load content", onRetry }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={32} color={colors.mutedForeground} />
      </View>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.sub}>Check your connection and try again</Text>
      <TouchableOpacity onPress={onRetry} style={styles.btn} activeOpacity={0.8}>
        <Text style={styles.btnText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    textAlign: 'center',
  },
  sub: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 220,
  },
  btn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  btnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
});
