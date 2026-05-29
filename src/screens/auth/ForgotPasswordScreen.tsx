import { View, Text, StyleSheet } from 'react-native';
import type { ForgotPasswordScreenProps } from '../../navigation/types';

export function ForgotPasswordScreen(_props: ForgotPasswordScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Forgot Password</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 24, fontWeight: '600' },
});
