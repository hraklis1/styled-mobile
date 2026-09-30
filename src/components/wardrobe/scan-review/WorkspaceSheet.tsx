import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Host, RNHostView } from '@expo/ui';
import { NativeReviewSheet } from './NativeReviewSheet';
import { colors, spacing, typography } from '../../../theme';

export type SheetDetent = 'medium' | 'large';

/** Native presentation is anchored inside the review modal, not the app portal. */
export function WorkspaceSheet({ title, subtitle, detent = 'medium', dismissed = false, onClose, children, footer }: {
  title: string;
  subtitle?: ReactNode;
  detent?: SheetDetent;
  reduceMotion: boolean;
  dismissed?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [presented, setPresented] = useState(true);
  useEffect(() => {
    if (dismissed) {
      Keyboard.dismiss();
      setPresented(false);
    }
  }, [dismissed]);
  const close = () => { Keyboard.dismiss(); setPresented(false); };
  return (
    <Host colorScheme="light" seedColor={colors.primary}>
      <NativeReviewSheet isPresented={presented} onDismiss={onClose} snapPoints={detent === 'large' ? ['full'] : ['half', 'full']}>
        <RNHostView matchContents={false}>
          <View style={styles.root} accessibilityViewIsModal>
            <View style={styles.header}>
              <View style={styles.heading}>
                <Text style={styles.title} accessibilityRole="header">{title}</Text>
                {subtitle}
              </View>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={`Close ${title}`} style={styles.close}>
                <Text style={styles.closeText}>Done</Text>
              </Pressable>
            </View>
            <View style={styles.body}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </RNHostView>
      </NativeReviewSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  heading: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { ...typography.text.editorialSection, color: colors.foreground },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { ...typography.text.label, color: colors.foreground },
  body: { flex: 1, minHeight: 0 },
  footer: { padding: spacing.lg },
});
