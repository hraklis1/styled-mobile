import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';

interface SectionCardProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  collapsible?: boolean;
  initiallyExpanded?: boolean;
}

export function SectionCard({
  title,
  icon,
  children,
  collapsible = false,
  initiallyExpanded = true,
}: SectionCardProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const heading = icon ? (
    <View style={styles.heading}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={styles.iconLabel}>{title}</Text>
      {collapsible && (
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.mutedForeground}
          style={styles.chevron}
        />
      )}
    </View>
  ) : (
    <Text style={styles.title}>{title}</Text>
  );

  return (
    <View style={[styles.card, icon ? styles.borderedCard : styles.plainCard]}>
      {collapsible ? (
        <TouchableOpacity
          onPress={() => setExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
          accessibilityState={{ expanded }}
          activeOpacity={0.7}
        >
          {heading}
        </TouchableOpacity>
      ) : heading}
      {expanded && children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  borderedCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  plainCard: {
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 24,
  },
  chevron: { marginLeft: 'auto' },
  iconLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.mutedForeground,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
});
