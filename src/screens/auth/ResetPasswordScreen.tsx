import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyledWordmark } from '../../components/brand/StyledWordmark';
import { Button } from '../../components/primitives/Button';
import { Input } from '../../components/primitives/Input';
import { colors, spacing, typography, radii } from '../../theme';
import { supabase } from '../../lib/supabase';
import type { ResetPasswordScreenProps } from '../../navigation/types';

export function ResetPasswordScreen({ route, navigation }: ResetPasswordScreenProps) {
  const insets = useSafeAreaInsets();
  const token_hash = route.params?.token_hash ?? '';
  const recoveryType = (route.params?.type ?? 'recovery') as 'recovery';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Exchange the one-time token for a recovery session
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash,
        type: recoveryType,
      });
      if (verifyError) throw verifyError;

      // Update the password using the just-established recovery session
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // Sign out so the user lands on Login with a clean state
      await supabase.auth.signOut();
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
      // Clean up any partial session on error
      supabase.auth.signOut().catch(() => {});
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
        <StyledWordmark style={styles.wordmark} />

        <View style={styles.card}>
          {!token_hash ? (
            <View style={styles.centeredContent}>
              <View style={[styles.iconCircle, styles.errorCircle]}>
                <Text style={styles.iconText}>✕</Text>
              </View>
              <Text style={styles.heading}>Link expired</Text>
              <Text style={[styles.body, styles.centered2]}>
                This password reset link is invalid or has expired. Reset links are only valid for 1
                hour.
              </Text>
              <Button
                label="Request a new link"
                variant="outline"
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.actionButton}
              />
            </View>
          ) : done ? (
            <View style={styles.centeredContent}>
              <View style={[styles.iconCircle, styles.successCircle]}>
                <Text style={styles.iconText}>✓</Text>
              </View>
              <Text style={styles.heading}>Password updated</Text>
              <Text style={[styles.body, styles.centered2]}>
                Your password has been reset. You can now sign in with your new password.
              </Text>
              <Button
                label="Sign in"
                onPress={() => navigation.navigate('Login')}
                style={styles.actionButton}
              />
            </View>
          ) : (
            <>
              <Text style={styles.heading}>Choose a new password</Text>
              <Text style={styles.body}>Must be at least 8 characters.</Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.passwordRow}>
                <Input
                  style={styles.passwordInput}
                  placeholder="New password"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  error={!!error}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeToggle}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>

              <Input
                style={styles.field}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  if (error) setError(null);
                }}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                error={!!error}
                editable={!loading}
              />

              <Button
                label="Set new password"
                onPress={handleSubmit}
                loading={loading}
                style={styles.field}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  wordmark: {
    width: 180,
    height: 52,
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
  centered2: {
    textAlign: 'center',
  },
  error: {
    color: colors.error,
    fontSize: typography.size.sm,
  },
  field: {
    width: '100%',
  },
  passwordRow: {
    width: '100%',
    position: 'relative',
  },
  passwordInput: {
    width: '100%',
    paddingRight: 48,
  },
  eyeToggle: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 16,
  },
  centeredContent: {
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    backgroundColor: colors.primary,
  },
  errorCircle: {
    backgroundColor: colors.error,
  },
  iconText: {
    color: colors.white,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },
  actionButton: {
    width: '100%',
    marginTop: spacing.sm,
  },
});
