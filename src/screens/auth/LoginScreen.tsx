import { useState, useEffect } from 'react';
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
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import { track } from '../../lib/analytics';
import { getDeviceValue, setDeviceValue } from '../../lib/deviceStorage';
import { useAuth, LAST_LOGIN_EMAIL_KEY } from '../../contexts/AuthContext';
import { Button } from '../../components/primitives/Button';
import { Input } from '../../components/primitives/Input';
import { colors, spacing, typography, radii } from '../../theme';
import type { LoginScreenProps } from '../../navigation/types';

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export function LoginScreen({ navigation }: LoginScreenProps) {
  const { loginWithEmail, loginWithGoogleToken, loginWithAppleToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDeviceValue(LAST_LOGIN_EMAIL_KEY).then((stored) => {
      if (stored) setEmail(stored);
    });
  }, []);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri: makeRedirectUri({ scheme: 'styled' }),
  });

  useEffect(() => {
    if (response?.type === 'success') {
      // Supabase signInWithIdToken requires the OpenID Connect id_token (JWT),
      // not the OAuth2 accessToken
      const idToken = response.authentication?.idToken;
      if (idToken) handleGoogleToken(idToken);
    } else if (response?.type === 'error') {
      setError('Google sign-in failed. Please try again.');
    }
  }, [response]);

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await loginWithEmail(email.trim(), password);
      setDeviceValue(LAST_LOGIN_EMAIL_KEY, email.trim()).catch(() => {});
    } catch (e: any) {
      const msg = e?.message ?? 'Incorrect email or password.';
      setError(msg);
      track('login_error', { provider: 'email', error: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleToken = async (accessToken: string) => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogleToken(accessToken);
    } catch {
      setError('Google sign-in failed. Please try again.');
      track('login_error', { provider: 'google' });
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        await loginWithAppleToken(credential.identityToken);
      }
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        setError('Apple sign-in failed. Please try again.');
        track('login_error', { provider: 'apple' });
      }
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
        <Text style={styles.title}>Styled</Text>
        <Text style={styles.subtitle}>Your AI wardrobe assistant</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Input
          style={styles.field}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          error={!!error}
          editable={!loading}
        />
        <Input
          style={styles.field}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          error={!!error}
          editable={!loading}
        />

        <Button
          label="Sign In"
          onPress={handleEmailLogin}
          loading={loading}
          style={styles.field}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate('ForgotPassword')}
          style={styles.forgotRow}
        >
          <Text style={styles.link}>Forgot password?</Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          label="Continue with Google"
          variant="outline"
          onPress={() => promptAsync()}
          disabled={!request || loading}
          style={styles.field}
        />

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.field, styles.appleButton]}
            onPress={handleAppleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.appleButtonText}>🍎  Continue with Apple</Text>
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
  title: {
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
    marginBottom: spacing.xxl,
  },
  error: {
    color: colors.error,
    fontSize: typography.size.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  field: {
    width: '100%',
    marginBottom: spacing.md,
  },
  forgotRow: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  link: {
    color: colors.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    color: colors.mutedForeground,
    fontSize: typography.size.sm,
  },
  appleButton: {
    height: 50,
    backgroundColor: '#000',
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleButtonText: {
    color: '#fff',
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.2,
  },
});
