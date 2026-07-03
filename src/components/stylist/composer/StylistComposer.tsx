import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DictationLevelBars } from './DictationLevelBars';
import { useDictation } from './useDictation';
import { colors, radii, shadows, spacing, typography } from '../../../theme';
import type { StylistComposerAttachment } from '../../../features/stylist/types';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  /** Programmatic text updates from dictation — must bypass @-mention parsing. */
  onDictatedText: (text: string) => void;
  onSend: () => void;
  onStopGeneration: () => void;
  isLoading: boolean;
  attachment: StylistComposerAttachment | null;
  onRemoveAttachment: () => void;
  onOpenAttachmentSheet: () => void;
};

function DictationTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, '0');
  return <Text style={styles.dictationTimer}>{`${minutes}:${seconds}`}</Text>;
}

export function StylistComposer({
  value,
  onChangeText,
  onDictatedText,
  onSend,
  onStopGeneration,
  isLoading,
  attachment,
  onRemoveAttachment,
  onOpenAttachmentSheet,
}: Props) {
  const dictation = useDictation({ onText: onDictatedText });
  const isDictating = dictation.state !== 'idle';
  const isListening = dictation.state === 'listening';

  // A send can start mid-dictation (e.g. a suggestion chip); finish gracefully.
  useEffect(() => {
    if (isLoading && isListening) dictation.done();
  }, [isLoading, isListening, dictation]);

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
      <View style={[styles.composer, isListening && styles.composerListening]}>
        <View style={styles.composerRow}>
          {isDictating ? (
            <Pressable
              style={styles.photoBtn}
              onPress={dictation.cancel}
              accessibilityLabel="Cancel dictation"
            >
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          ) : (
            <Pressable
              style={styles.photoBtn}
              onPress={onOpenAttachmentSheet}
              disabled={isLoading}
              accessibilityLabel="Add photo or wardrobe piece"
            >
              <Ionicons name="camera-outline" size={20} color={colors.primary} />
            </Pressable>
          )}

          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={onChangeText}
            placeholder="Ask about an outfit or tag @a piece"
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2000}
            returnKeyType="default"
            editable={!isLoading && !isDictating}
          />

          {isLoading ? (
            <TouchableOpacity style={styles.stopBtn} onPress={onStopGeneration} accessibilityLabel="Stop generating">
              <Ionicons name="stop" size={14} color={colors.primaryForeground} />
            </TouchableOpacity>
          ) : isDictating ? (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={dictation.done}
              accessibilityLabel="Finish dictation"
            >
              <Ionicons name="checkmark" size={20} color={colors.white} />
            </TouchableOpacity>
          ) : value.trim() || attachment ? (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={onSend}
              accessibilityLabel="Send message"
            >
              <Ionicons name="arrow-up" size={19} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <Pressable
              style={styles.photoBtn}
              onPress={() => { void dictation.start(value); }}
              accessibilityLabel="Dictate a message"
            >
              <Ionicons name="mic-outline" size={22} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {isListening ? (
          <View style={styles.dictationStatusRow}>
            <View style={styles.dictationDot} />
            {dictation.startedAt != null ? <DictationTimer startedAt={dictation.startedAt} /> : null}
            <View style={styles.dictationBars}>
              <DictationLevelBars level={dictation.level} />
            </View>
          </View>
        ) : null}
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
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 4,
    ...shadows.xs,
  },
  composerListening: {
    borderColor: `${colors.primary}73`,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
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
  dictationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingBottom: spacing.sm,
    paddingTop: 2,
  },
  dictationDot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.error,
  },
  dictationTimer: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
  dictationBars: {
    flex: 1,
    alignItems: 'flex-end',
  },
});
