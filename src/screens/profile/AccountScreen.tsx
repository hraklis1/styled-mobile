import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Modal, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { SettingsScaffold, Group, GroupBlock, InfoRow, NavRow } from '../../components/profile/SettingsUI';
import { styles, dm } from '../../components/profile/fields';
import { colors, spacing } from '../../theme';
import type { ProfileStackScreenProps } from './types';

const PROVIDER_LABEL = { local: 'Email & password', google: 'Google', apple: 'Apple' } as const;

export function AccountScreen({ navigation }: ProfileStackScreenProps<'SettingsAccount'>) {
  const { user, logout } = useAuth();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  useEffect(() => { setName(profile?.displayName ?? ''); }, [profile?.displayName]);

  const saveName = () => {
    const next = name.trim();
    if (next !== (profile?.displayName ?? '')) update.mutate({ displayName: next || null });
  };

  /**
   * Clearing onboardingComplete reopens the questionnaire: AppGate watches the
   * flag. It prefills from the saved profile, so this is an edit pass, not a
   * fresh start.
   */
  const retakeQuiz = () => Alert.alert('Retake style quiz', 'Your saved answers will be filled in. Change anything you like.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Retake', onPress: () => update.mutate({ onboardingComplete: false }) },
  ]);

  const signOut = () => Alert.alert('Sign out', 'Are you sure you want to sign out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => logout() },
  ]);

  const deleteAccount = useMutation({
    // The server requires a freshly issued token as proof of a recent sign-in.
    // Email users re-enter their password; social users get a refreshed session.
    mutationFn: async (password?: string) => {
      const { data, error } = password && user?.email
        ? await supabase.auth.signInWithPassword({ email: user.email, password })
        : await supabase.auth.refreshSession();
      if (error || !data.session) {
        throw new Error(password ? 'Incorrect password.' : 'Please sign in again to delete your account.');
      }
      return api.delete('/api/auth/account', { headers: { Authorization: `Bearer ${data.session.access_token}` } });
    },
    onSuccess: () => logout(),
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const isLocal = user?.authProvider === 'local';
  const closeDelete = () => { setDeleteVisible(false); setDeletePassword(''); };

  return (
    <SettingsScaffold title="Account">
      <Group title="Name" footer="How your stylist addresses you.">
        <GroupBlock>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            onEndEditing={saveName}
            placeholder="e.g. Alex"
            placeholderTextColor={colors.mutedForeground}
            maxLength={80}
            returnKeyType="done"
          />
        </GroupBlock>
      </Group>

      <Group title="Sign-in">
        <InfoRow icon="mail-outline" label={user?.email ?? 'No email'}
          detail={user?.authProvider ? `Signed in with ${PROVIDER_LABEL[user.authProvider]}` : undefined} />
        {isLocal && <NavRow icon="key-outline" label="Change password" onPress={() => navigation.navigate('SettingsPassword')} />}
      </Group>

      <Group>
        <NavRow icon="sparkles-outline" label="Retake style quiz" onPress={retakeQuiz} />
        <NavRow icon="log-out-outline" label="Sign out" destructive onPress={signOut} />
      </Group>

      <Group footer="Permanently deletes your profile, closet, outfits and events. This can't be undone.">
        <NavRow icon="trash-outline" label="Delete account" destructive onPress={() => setDeleteVisible(true)} />
      </Group>

      <Modal visible={deleteVisible} transparent animationType="fade" onRequestClose={closeDelete}>
        <KeyboardAvoidingView style={dm.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={dm.card}>
            <Text style={dm.title}>Delete account?</Text>
            <Text style={dm.body}>
              This permanently erases your profile, wardrobe, outfits, and events. There is no way to recover this data.
            </Text>
            {isLocal && (
              <TextInput
                style={[styles.input, { marginTop: spacing.md }]}
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Confirm with your password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
              />
            )}
            <View style={dm.actions}>
              <TouchableOpacity style={dm.cancelBtn} onPress={closeDelete} activeOpacity={0.7}>
                <Text style={dm.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dm.confirmBtn, deleteAccount.isPending && { opacity: 0.6 }]}
                disabled={deleteAccount.isPending || (isLocal && !deletePassword)}
                onPress={() => deleteAccount.mutate(isLocal ? deletePassword : undefined)}
                activeOpacity={0.8}
              >
                {deleteAccount.isPending
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Text style={dm.confirmText}>Yes, delete everything</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SettingsScaffold>
  );
}
