import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  /** Optional label shown beneath the generic message. Useful for wrapping sub-trees. */
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ─── Class component (required by React for error boundaries) ─────────────────

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // TODO: pipe to a crash reporting service (Sentry, etc.) when one is wired up
    console.error('[ErrorBoundary] Unhandled render error', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.error} />

          <Text style={styles.heading}>Something went wrong</Text>

          {this.props.context ? (
            <Text style={styles.context}>{this.props.context}</Text>
          ) : null}

          <Text style={styles.detail} numberOfLines={3}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>

          <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.75}>
            <Text style={styles.buttonLabel}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  heading: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  context: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  detail: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    marginTop: spacing.sm,
  },
  buttonLabel: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
});
