import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { File, Paths, EncodingType } from 'expo-file-system';
import { api } from '../../lib/api';
import { compressImageToDataUrl } from '../../lib/compressImage';
import { addToWishlist } from '../../lib/wishlist';
import { VoiceInputButton } from '../../components/primitives/VoiceInputButton';
import { ShopOutfitCard } from '../../components/outfits/ShopOutfitCard';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShopOutfit } from '../../types/shop';
import type { StylistScreenProps } from '../../navigation/types';

type Role = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  /** Server transcript for audio messages — used as history content */
  transcript?: string;
  shopOutfit?: ShopOutfit;
};

type StylistAskResponse = {
  transcript: string;
  response: string;
  itemIds?: number[];
  shopOutfit?: ShopOutfit | null;
};

type TtsResponse = {
  audioReply: string;
};

function makeId() {
  return Math.random().toString(36).slice(2);
}

export function StylistScreen({ route, navigation }: StylistScreenProps) {
  const insets = useSafeAreaInsets();
  const initialQuery = route.params?.query ?? '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const sessionRef = useRef(0);
  const hasSentInitialRef = useRef(false);

  // Build history array for the API (last 20 turns, skip typing stubs)
  function buildHistory(msgs: ChatMessage[]) {
    return msgs.slice(-20).map((m) => ({
      role: m.role,
      content: m.transcript ?? m.text,
    }));
  }

  async function stopCurrentAudio() {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {
        // ignore
      }
      soundRef.current = null;
    }
    setPlayingId(null);
  }

  async function playTts(messageId: string, text: string) {
    await stopCurrentAudio();
    try {
      const { data } = await api.post<TtsResponse>(
        '/api/stylist/tts',
        { text },
        { timeout: 30_000 },
      );
      if (!data.audioReply) return;

      const ttsFile = new File(Paths.cache, `stylist_tts_${Date.now()}.mp3`);
      ttsFile.write(data.audioReply, { encoding: EncodingType.Base64 });

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: ttsFile.uri },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      setPlayingId(messageId);

      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
          setPlayingId(null);
          try { ttsFile.delete(); } catch { /* ignore */ }
        }
      });
    } catch {
      // TTS failure is non-fatal
    }
  }

  const sendMessage = useCallback(
    async (opts: { text?: string; audio?: string; photoData?: string }) => {
      const { text, audio, photoData } = opts;
      if (!text && !audio && !photoData) return;
      if (isLoading) return;

      const session = ++sessionRef.current;

      // Add user bubble
      const userMsg: ChatMessage = {
        id: makeId(),
        role: 'user',
        text: audio ? '🎙 Voice message…' : text ?? '📷 Photo',
      };

      setMessages((prev) => {
        const next = [...prev, userMsg];
        return next;
      });
      setInputText('');
      setIsLoading(true);

      try {
        const history = buildHistory(messages);

        const { data } = await api.post<StylistAskResponse>(
          '/api/stylist/ask',
          {
            ...(text ? { text } : {}),
            ...(audio ? { audio } : {}),
            ...(photoData ? { photoData } : {}),
            history,
          },
          { timeout: 60_000 },
        );

        if (sessionRef.current !== session) return;

        // Update user bubble with transcript if audio was sent
        const transcript = data.transcript ?? text ?? '';
        if (audio && transcript) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMsg.id ? { ...m, text: transcript, transcript } : m,
            ),
          );
        }

        const assistantId = makeId();
        const assistantMsg: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          text: data.response,
          ...(data.shopOutfit ? { shopOutfit: data.shopOutfit } : {}),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // TTS — fire and forget, non-blocking
        playTts(assistantId, data.response);
      } catch (err: unknown) {
        if (sessionRef.current !== session) return;
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Could not reach the stylist. Please try again.';
        Alert.alert('Stylist unavailable', msg);
        // Remove the user bubble on failure
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      } finally {
        if (sessionRef.current === session) setIsLoading(false);
      }
    },
    [isLoading, messages],
  );

  // Auto-send initial query once
  useEffect(() => {
    if (initialQuery && !hasSentInitialRef.current) {
      hasSentInitialRef.current = true;
      sendMessage({ text: initialQuery });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isLoading]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, []);

  async function handlePickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const compressed = await compressImageToDataUrl(asset);
      sendMessage({ photoData: compressed.dataUrl });
    } catch {
      Alert.alert('Could not load photo', 'Please try again.');
    }
  }

  function handleSendText() {
    const trimmed = inputText.trim();
    if (trimmed) sendMessage({ text: trimmed });
  }

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.bottom}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Stylist</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={async () => {
            await stopCurrentAudio();
            sessionRef.current++;
            setMessages([]);
            setIsLoading(false);
          }}
          accessibilityLabel="Clear conversation"
        >
          <Ionicons name="refresh-outline" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={[
          styles.messageListContent,
          isEmpty && styles.messageListEmpty,
        ]}
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          <EmptyState onPrompt={(q) => sendMessage({ text: q })} />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isPlaying={playingId === msg.id}
                onToggleAudio={
                  msg.role === 'assistant'
                    ? () =>
                        playingId === msg.id
                          ? stopCurrentAudio()
                          : playTts(msg.id, msg.text)
                    : undefined
                }
              />
            ))}
            {isLoading && <TypingIndicator />}
          </>
        )}
      </ScrollView>

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable style={styles.photoBtn} onPress={handlePickPhoto} disabled={isLoading}>
          <Ionicons name="image-outline" size={22} color={colors.mutedForeground} />
        </Pressable>

        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask your stylist…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={2000}
          returnKeyType="default"
          editable={!isLoading}
        />

        {inputText.trim() ? (
          <TouchableOpacity style={styles.sendBtn} onPress={handleSendText} disabled={isLoading}>
            <Ionicons name="send" size={18} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <VoiceInputButton onAudioReady={(b64) => sendMessage({ audio: b64 })} disabled={isLoading} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

type BubbleProps = {
  message: ChatMessage;
  isPlaying: boolean;
  onToggleAudio?: () => void;
};

function MessageBubble({ message, isPlaying, onToggleAudio }: BubbleProps) {
  const isUser = message.role === 'user';

  if (!isUser && message.shopOutfit) {
    return (
      <View style={styles.shopCardRow}>
        <View style={styles.avatarCircle}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
        </View>
        <View style={styles.shopCardContainer}>
          <ShopOutfitCard
            outfit={message.shopOutfit}
            onSave={async () => { await addToWishlist(message.shopOutfit!); }}
          />
          {onToggleAudio && (
            <TouchableOpacity style={styles.ttsBtnShop} onPress={onToggleAudio}>
              <Ionicons
                name={isPlaying ? 'pause-circle-outline' : 'volume-medium-outline'}
                size={18}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
      {!isUser && (
        <View style={styles.avatarCircle}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
          {message.text}
        </Text>
        {!isUser && onToggleAudio && (
          <TouchableOpacity style={styles.ttsBtn} onPress={onToggleAudio}>
            <Ionicons
              name={isPlaying ? 'pause-circle-outline' : 'volume-medium-outline'}
              size={18}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    function pulse(val: Animated.Value, delay: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
      );
    }
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 150);
    const a3 = pulse(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={styles.bubbleRow}>
      <View style={styles.avatarCircle}>
        <Ionicons name="sparkles" size={14} color={colors.primary} />
      </View>
      <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
        {[dot1, dot2, dot3].map((d, i) => (
          <Animated.View key={i} style={[styles.typingDot, { opacity: d }]} />
        ))}
      </View>
    </View>
  );
}

const PROMPTS = [
  'What should I wear today?',
  'Build me a casual weekend outfit',
  'What goes with my blue jeans?',
  'Help me dress for a dinner date',
];

function EmptyState({ onPrompt }: { onPrompt: (q: string) => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="sparkles" size={36} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>Your AI Stylist</Text>
      <Text style={styles.emptySubtitle}>
        Ask anything — outfit ideas, style advice, or what to wear for an occasion.
        You can also send a photo or record your voice.
      </Text>
      <View style={styles.promptList}>
        {PROMPTS.map((p) => (
          <TouchableOpacity key={p} style={styles.promptChip} onPress={() => onPrompt(p)}>
            <Text style={styles.promptChipText}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  messageListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.sm,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Message bubbles
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: radii.sm,
  },
  bubbleAssistant: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * 1.55,
  },
  bubbleTextUser: {
    color: colors.white,
  },
  bubbleTextAssistant: {
    color: colors.foreground,
  },
  ttsBtn: {
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  // Shop outfit card in chat
  shopCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  shopCardContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  ttsBtnShop: {
    alignSelf: 'flex-end',
  },
  // Typing indicator
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.mutedForeground,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: typography.size.sm * 1.6,
    maxWidth: 300,
  },
  promptList: {
    width: '100%',
    gap: spacing.sm,
  },
  promptChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
  },
  promptChipText: {
    fontSize: typography.size.sm,
    color: colors.foreground,
    textAlign: 'center',
  },
});
