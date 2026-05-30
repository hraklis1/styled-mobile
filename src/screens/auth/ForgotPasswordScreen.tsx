import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/primitives/Button';
import { Input } from '../../components/primitives/Input';
import { colors, spacing, typography, radii } from '../../theme';
import { api } from '../../lib/api';
import type { ForgotPasswordScreenProps } from '../../navigation/types';

export function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(msg ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.wordmark}>Styled</Text>

        <View style={styles.card}>
          {submitted ? (
            <View style={styles.successContent}>
              <View style={styles.checkCircle}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
              <Text style={styles.heading}>Check your email</Text>
              <Text style={styles.body}>
                If an account with <Text style={styles.bold}>{email}</Text> exists, we've sent a
                password reset link. Check your inbox and follow the instructions.
              </Text>
              <Button
                label="Back to sign in"
                variant="outline"
                onPress={() => navigation.navigate('Login')}
                style={styles.actionButton}
              />
            </View>
          ) : (
            <>
              <Text style={styles.heading}>Forgot password?</Text>
              <Text style={styles.body}>
                Enter your email and we'll send you a link to reset your password.
              </Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Input
                style={styles.field}
                placeholder="Email address"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) setError(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                error={!!error}
                editable={!loading}
              />

              <Button
                label="Send reset link"
                onPress={handleSubmit}
                loading={loading}
                style={styles.field}
              />
            </>
          )}
        </View>

        {!submitted && (
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backLink}>Back to sign in</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  wordmark: {
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -1,
    marginBottom: spacing.xxl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  heading: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  body: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  bold: {
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  error: {
    color: colors.error,
    fontSize: typography.size.sm,
  },
  field: {
    width: '100%',
  },
  successContent: {
    alignItems: 'center',
    gap: spacing.md,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: colors.primaryForeground,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },
  actionButton: {
    width: '100%',
    marginTop: spacing.sm,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  backArrow: {
    color: colors.primary,
    fontSize: typography.size.md,
  },
  backLink: {
    color: colors.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
});
