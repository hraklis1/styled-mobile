import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VoiceInputButton } from '../../primitives/VoiceInputButton';
import { colors, radii, shadows, spacing, typography } from '../../../theme';
import type { StylistComposerAttachment } from '../../../features/stylist/types';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onSendAudio: (base64: string) => void;
  onStopGeneration: () => void;
  isLoading: boolean;
  attachment: StylistComposerAttachment | null;
  onRemoveAttachment: () => void;
  onOpenAttachmentSheet: () => void;
};

export function StylistComposer({
  value,
  onChangeText,
  onSend,
  onSendAudio,
  onStopGeneration,
  isLoading,
  attachment,
  onRemoveAttachment,
  onOpenAttachmentSheet,
}: Props) {
  return (
    <View style={styles.inputBar}>
      {attachment ? (
        <View style={styles.attachmentPreview}>
          <View style={styles.attachmentThumb}>
            {attachment.uri ? (
              <Image source={{ uri: attachment.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Ionicons name={attachment.type === 'photo' ? 'image-outline' : 'shirt-outline'} size={18} color={colors.primary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.attachmentEyebrow}>{attachment.type === 'photo' ? 'PHOTO' : 'FROM YOUR CLOSET'}</Text>
            <Text style={styles.attachmentLabel} numberOfLines={1}>{attachment.label}</Text>
          </View>
          <TouchableOpacity
            style={styles.attachmentRemove}
            onPress={onRemoveAttachment}
            accessibilityLabel="Remove attachment"
          >
            <Ionicons name="close" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={styles.composer}>
        <Pressable
          style={styles.photoBtn}
          onPress={onOpenAttachmentSheet}
          disabled={isLoading}
          accessibilityLabel="Add photo or wardrobe piece"
        >
          <Ionicons name="camera-outline" size={20} color={colors.primary} />
        </Pressable>

        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask about an outfit or tag @a piece"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={2000}
          returnKeyType="default"
          editable={!isLoading}
        />

        {isLoading ? (
          <TouchableOpacity style={styles.stopBtn} onPress={onStopGeneration} accessibilityLabel="Stop generating">
            <Ionicons name="stop" size={14} color={colors.primaryForeground} />
          </TouchableOpacity>
        ) : value.trim() || attachment ? (
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={onSend}
            disabled={isLoading}
            accessibilityLabel="Send message"
          >
            <Ionicons name="arrow-up" size={19} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <VoiceInputButton onAudioReady={onSendAudio} disabled={isLoading} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  attachmentPreview: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    ...shadows.xs,
  },
  attachmentThumb: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSelected,
  },
  attachmentEyebrow: { color: colors.primary, fontSize: 9, fontWeight: typography.weight.bold, letterSpacing: 0.8 },
  attachmentLabel: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  attachmentRemove: { width: 36, height: 36, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  composer: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 4,
    ...shadows.xs,
  },
  photoBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.sm,
    color: colors.foreground,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
