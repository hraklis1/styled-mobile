import { useState, useEffect } from 'react';
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
import type { ResetPasswordScreenProps } from '../../navigation/types';

export function ResetPasswordScreen({ route, navigation }: ResetPasswordScreenProps) {
  const insets = useSafeAreaInsets();
  const token = route.params?.token ?? '';

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setValidating(false);
      return;
    }
    api
      .get(`/api/auth/reset-password/${token}`)
      .then((res) => {
        setTokenValid(res.data?.valid === true);
      })
      .catch(() => {
        setTokenValid(false);
      })
      .finally(() => {
        setValidating(false);
      });
  }, [token]);

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
      await api.post(`/api/auth/reset-password/${token}`, { password });
      setDone(true);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(msg ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
          {!tokenValid ? (
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
