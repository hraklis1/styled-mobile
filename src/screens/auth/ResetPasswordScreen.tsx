import { View, Text, StyleSheet } from 'react-native';
import type { ResetPasswordScreenProps } from '../../navigation/types';

export function ResetPasswordScreen(_props: ResetPasswordScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Reset Password</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 24, fontWeight: '600' },
});
