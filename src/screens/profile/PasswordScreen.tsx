import React, { useState } from 'react';
import { TextInput, Alert, Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { SettingsScaffold, Group, GroupBlock } from '../../components/profile/SettingsUI';
import { styles } from '../../components/profile/fields';
import { colors, spacing, typography, radii } from '../../theme';
import type { ProfileStackScreenProps } from './types';

export function PasswordScreen({ navigation }: ProfileStackScreenProps<'SettingsPassword'>) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const change = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) => api.post('/api/auth/change-password', body),
    onSuccess: () => Alert.alert('Updated', 'Your password has been changed.', [{ text: 'OK', onPress: () => navigation.goBack() }]),
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const submit = () => {
    if (next.length < 8) return Alert.alert('Too short', 'New password must be at least 8 characters.');
    if (next !== confirm) return Alert.alert("Doesn't match", 'New password and confirmation must match.');
    change.mutate({ currentPassword: current, newPassword: next });
  };

  const disabled = change.isPending || !current || !next || !confirm;

  return (
    <SettingsScaffold title="Change Password">
      <Group footer="At least 8 characters.">
        <GroupBlock>
          <TextInput style={styles.input} value={current} onChangeText={setCurrent} placeholder="Current password" placeholderTextColor={colors.mutedForeground} secureTextEntry textContentType="password" />
          <TextInput style={styles.input} value={next} onChangeText={setNext} placeholder="New password" placeholderTextColor={colors.mutedForeground} secureTextEntry textContentType="newPassword" />
          <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} placeholder="Confirm new password" placeholderTextColor={colors.mutedForeground} secureTextEntry textContentType="newPassword" />
        </GroupBlock>
      </Group>
      <Pressable style={[s.btn, disabled && s.btnDisabled]} onPress={submit} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}>
        {change.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={s.btnText}>Update password</Text>}
      </Pressable>
    </SettingsScaffold>
  );
}

const s = StyleSheet.create({
  btn: { height: 50, borderRadius: radii.action, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: -spacing.sm },
  btnDisabled: { backgroundColor: colors.surfaceSelected },
  btnText: { ...typography.text.body, color: colors.primaryForeground, fontWeight: typography.weight.semibold },
});
