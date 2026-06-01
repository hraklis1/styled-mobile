import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Image,
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
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths, EncodingType } from 'expo-file-system';
import { api } from '../../lib/api';
import { compressImageToDataUrl } from '../../lib/compressImage';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { useWeatherCurrent } from '../../hooks/useWeather';
import { useItems } from '../../hooks/useItems';
import { useCreateOutfit, type CreateOutfitInput } from '../../hooks/useOutfits';
import { addToWishlist } from '../../lib/wishlist';
import { VoiceInputButton } from '../primitives/VoiceInputButton';
import { ShopOutfitCard } from '../outfits/ShopOutfitCard';
import { colors, radii, shadows, spacing, typography } from '../../theme';
import type { ShopOutfit } from '../../types/shop';
import type { Item } from '../../types/item';

// ── Types ────────────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  transcript?: string;
  shopOutfit?: ShopOutfit;
  suggestedItemIds?: number[];
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

// ── Constants ────────────────────────────────────────────────────────────────

const FOLLOWUP_CHIPS = [
  'Make it more casual',
  'Make it more formal',
  'Swap the shoes',
  'Add a jacket',
  'What accessories work?',
  'Try bolder colors',
  'Show me another option',
];

function makeId() {
  return Math.random().toString(36).slice(2);
}

// ── Main Component ───────────────────────────────────────────────────────────

type Props = {
  initialQuery?: string;
  onClose: () => void;
};

export function StylistChatView({ initialQuery, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const weather = useWeatherCurrent();
  const { data: allItems = [] } = useItems();
  const createOutfit = useCreateOutfit();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const player = useAudioPlayer(null);
  const playingFileRef = useRef<File | null>(null);
  const sessionRef = useRef(0);
  const hasSentInitialRef = useRef(false);

  // ── Mention filtering ──────────────────────────────────────────────────────

  const mentionItems = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const filtered = q
      ? allItems.filter((i) => i.name.toLowerCase().includes(q))
      : allItems.slice(0, 5);
    return filtered.slice(0, 5);
  }, [mentionQuery, allItems]);

  // ── Audio helpers ──────────────────────────────────────────────────────────

  function buildHistory(msgs: ChatMessage[]) {
    return msgs.slice(-12).map((m) => ({
      role: m.role,
      content: m.transcript ?? m.text,
    }));
  }

  function stopCurrentAudio() {
    try { player.pause(); } catch { /* ignore */ }
    try { player.replace(null); } catch { /* ignore */ }
    if (playingFileRef.current) {
      try { playingFileRef.current.delete(); } catch { /* ignore */ }
      playingFileRef.current = null;
    }
    setPlayingId(null);
  }

  async function playTts(messageId: string, text: string) {
    stopCurrentAudio();
    try {
      const { data } = await api.post<TtsResponse>(
        '/api/stylist/tts',
        { text },
        { timeout: 30_000 },
      );
      if (!data.audioReply) return;

      const ttsFile = new File(Paths.cache, `stylist_tts_${Date.now()}.mp3`);
      ttsFile.write(data.audioReply, { encoding: EncodingType.Base64 });
      playingFileRef.current = ttsFile;

      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      player.replace({ uri: ttsFile.uri });
      player.play();
      setPlayingId(messageId);

      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          sub.remove();
          try { ttsFile.delete(); } catch { /* ignore */ }
          playingFileRef.current = null;
          setPlayingId(null);
        }
      });
    } catch {
      // TTS failure is non-fatal
    }
  }

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (opts: { text?: string; audio?: string; photoData?: string }) => {
      const { text, audio, photoData } = opts;
      if (!text && !audio && !photoData) return;
      if (isLoading) return;

      const session = ++sessionRef.current;

      const userMsg: ChatMessage = {
        id: makeId(),
        role: 'user',
        text: audio ? '🎙 Voice message…' : text ?? '📷 Photo',
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
      setMentionQuery(null);
      setIsLoading(true);

      try {
        const history = buildHistory(messages);
        const weatherSummary = weather.data
          ? `${weather.data.summary} ${weather.data.temperatureF}°F`
          : undefined;

        const { data } = await api.post<StylistAskResponse>(
          '/api/stylist/ask',
          {
            ...(text ? { text } : {}),
            ...(audio ? { audio } : {}),
            ...(photoData ? { photoData } : {}),
            ...(weatherSummary ? { weatherSummary } : {}),
            history,
          },
          { timeout: 60_000 },
        );

        if (sessionRef.current !== session) return;

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
          ...(data.itemIds?.length ? { suggestedItemIds: data.itemIds } : {}),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        playTts(assistantId, data.response);
      } catch (err: unknown) {
        if (sessionRef.current !== session) return;
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Could not reach the stylist. Please try again.';
        Alert.alert('Stylist unavailable', msg);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      } finally {
        if (sessionRef.current === session) setIsLoading(false);
      }
    },
    [isLoading, messages],
  );

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (initialQuery && !hasSentInitialRef.current) {
      hasSentInitialRef.current = true;
      sendMessage({ text: initialQuery });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isLoading]);

  useEffect(() => {
    return () => { stopCurrentAudio(); };
  }, []);

  // ── Input handlers ─────────────────────────────────────────────────────────

  async function handlePickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return;
      const compressed = await compressImageToDataUrl(result.assets[0]);
      sendMessage({ photoData: compressed.dataUrl });
    } catch {
      Alert.alert('Could not load photo', 'Please try again.');
    }
  }

  function handleSendText() {
    const trimmed = inputText.trim();
    if (trimmed) sendMessage({ text: trimmed });
  }

  function handleTextChange(text: string) {
    setInputText(text);
    const lastAt = text.lastIndexOf('@');
    if (lastAt !== -1) {
      const afterAt = text.slice(lastAt + 1);
      if (!afterAt.includes(' ')) {
        setMentionQuery(afterAt);
        return;
      }
    }
    if (mentionQuery !== null) setMentionQuery(null);
  }

  function handleMentionSelect(item: Item) {
    const lastAt = inputText.lastIndexOf('@');
    const newText = inputText.slice(0, lastAt) + `@${item.name} `;
    setInputText(newText);
    setMentionQuery(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.bottom}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
          <Ionicons name="chevron-down" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Stylist</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {
            stopCurrentAudio();
            sessionRef.current++;
            setMessages([]);
            setIsLoading(false);
            setMentionQuery(null);
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
                allItems={allItems}
                isPlaying={playingId === msg.id}
                createOutfit={createOutfit}
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

      {/* Follow-up chips */}
      {messages.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsBar}
          contentContainerStyle={styles.chipsContent}
          keyboardShouldPersistTaps="always"
        >
          {FOLLOWUP_CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip}
              style={styles.chip}
              onPress={() => sendMessage({ text: chip })}
              disabled={isLoading}
            >
              <Text style={styles.chipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* @ Mention menu — sits between chips and input bar */}
      {mentionQuery !== null && mentionItems.length > 0 && (
        <View style={styles.mentionMenu}>
          {mentionItems.map((item) => {
            const imgUri = resolveImageUri(item.imageUrl);
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.mentionRow}
                onPress={() => handleMentionSelect(item)}
              >
                <View style={styles.mentionThumb}>
                  {imgUri ? (
                    <Image source={{ uri: imgUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <Ionicons name="shirt-outline" size={14} color={colors.mutedForeground} />
                  )}
                </View>
                <View style={styles.mentionInfo}>
                  <Text style={styles.mentionName}>{item.name}</Text>
                  {item.category && (
                    <Text style={styles.mentionCategory}>
                      {item.category.replace('_', ' ')}
                    </Text>
                  )}
                </View>
                <Ionicons name="return-down-back-outline" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable style={styles.photoBtn} onPress={handlePickPhoto} disabled={isLoading}>
          <Ionicons name="image-outline" size={22} color={colors.mutedForeground} />
        </Pressable>

        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={handleTextChange}
          placeholder="Ask your stylist… or type @ to tag a piece"
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

// ── MessageBubble ─────────────────────────────────────────────────────────────

type BubbleProps = {
  message: ChatMessage;
  allItems: Item[];
  isPlaying: boolean;
  createOutfit: ReturnType<typeof useCreateOutfit>;
  onToggleAudio?: () => void;
};

function MessageBubble({ message, allItems, isPlaying, createOutfit, onToggleAudio }: BubbleProps) {
  const isUser = message.role === 'user';

  if (!isUser && message.suggestedItemIds?.length) {
    return (
      <View style={styles.bubbleRowAssistant}>
        <View style={styles.avatarCircle}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
        </View>
        <View style={styles.bubbleAssistantWrap}>
          <OutfitSuggestionCard
            messageText={message.text}
            itemIds={message.suggestedItemIds}
            allItems={allItems}
            createOutfit={createOutfit}
          />
          {onToggleAudio && (
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

// ── OutfitSuggestionCard ──────────────────────────────────────────────────────

type OutfitSuggestionCardProps = {
  messageText: string;
  itemIds: number[];
  allItems: Item[];
  createOutfit: ReturnType<typeof useCreateOutfit>;
};

function OutfitSuggestionCard({ messageText, itemIds, allItems, createOutfit }: OutfitSuggestionCardProps) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const matchedItems = useMemo(
    () => itemIds.map((id) => allItems.find((i) => i.id === id)).filter((i): i is Item => !!i),
    [itemIds, allItems],
  );

  async function handleSave() {
    if (saved || saving) return;
    setSaving(true);
    try {
      const input: CreateOutfitInput = {
        name: messageText.slice(0, 60).replace(/\n/g, ' ').trim() || 'AI Suggestion',
        description: messageText.slice(0, 200) || null,
        topId: matchedItems.find((i) => i.category === 'top')?.id ?? null,
        bottomId: matchedItems.find((i) => i.category === 'bottom')?.id ?? null,
        shoesId: matchedItems.find((i) => i.category === 'shoes')?.id ?? null,
        outerwearId: matchedItems.find((i) => i.category === 'outerwear')?.id ?? null,
        accessoryId: matchedItems.find((i) => i.category === 'accessory')?.id ?? null,
      };
      await createOutfit.mutateAsync(input);
      setSaved(true);
    } catch {
      // Error alert handled by the mutation
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.outfitCard}>
      {/* Item thumbnails */}
      {matchedItems.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.outfitCardThumbs}
        >
          {matchedItems.map((item) => {
            const imgUri = resolveImageUri(item.imageUrl);
            return (
              <View key={item.id} style={styles.outfitItemThumb}>
                {imgUri ? (
                  <Image source={{ uri: imgUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <Ionicons name="shirt-outline" size={18} color={colors.mutedForeground} />
                )}
                <View style={styles.outfitItemLabel}>
                  <Text style={styles.outfitItemLabelText} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* AI response text */}
      <Text style={styles.outfitCardText}>{messageText}</Text>

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveBtn, (saved || saving) && styles.saveBtnDone]}
        onPress={handleSave}
        disabled={saved || saving}
        activeOpacity={0.8}
      >
        <Ionicons
          name={saved ? 'checkmark-circle' : 'bookmark-outline'}
          size={15}
          color={saved ? colors.primaryForeground : colors.primaryForeground}
        />
        <Text style={styles.saveBtnText}>
          {saving ? 'Saving…' : saved ? 'Saved to Outfits' : 'Save to Outfits'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── TypingIndicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    function pulse(val: Animated.Value, delay: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 380, useNativeDriver: true }),
        ]),
      );
    }
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 180);
    const a3 = pulse(dot3, 360);
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
          <Animated.View
            key={i}
            style={[
              styles.typingDot,
              {
                opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.85] }),
                transform: [{ scale: d.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

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
        Type @ to tag items from your wardrobe.
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header
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
  // Messages
  messageList: { flex: 1 },
  messageListContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  messageListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  // Follow-up chips
  chipsBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexGrow: 0,
  },
  chipsContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.card,
  },
  chipText: {
    fontSize: typography.size.xs,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
  },
  // @ Mention menu
  mentionMenu: {
    marginHorizontal: spacing.md,
    marginBottom: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mentionThumb: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.muted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mentionInfo: { flex: 1 },
  mentionName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  mentionCategory: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
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
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubbleAssistantWrap: { flex: 1, gap: spacing.xs },
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
    backgroundColor: '#F8F4EF',
    borderBottomLeftRadius: radii.sm,
    borderWidth: 1,
    borderColor: `${colors.primary}22`,
    shadowColor: '#956D51',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.09,
    shadowRadius: 5,
    elevation: 2,
  },
  bubbleText: {
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * 1.55,
  },
  bubbleTextUser: { color: colors.white },
  bubbleTextAssistant: { color: colors.foreground },
  ttsBtn: { marginTop: spacing.xs, alignSelf: 'flex-end' },
  // Shop outfit card
  shopCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  shopCardContainer: { flex: 1, gap: spacing.xs },
  ttsBtnShop: { alignSelf: 'flex-end' },
  // Outfit suggestion card
  outfitCard: {
    flex: 1,
    backgroundColor: '#F8F4EF',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: `${colors.primary}22`,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#956D51',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.09,
    shadowRadius: 5,
    elevation: 2,
  },
  outfitCardThumbs: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  outfitItemThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitItemLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  outfitItemLabelText: {
    fontSize: 8,
    color: '#fff',
    textAlign: 'center',
  },
  outfitCardText: {
    fontSize: typography.size.sm,
    color: colors.foreground,
    lineHeight: typography.size.sm * 1.55,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
  },
  saveBtnDone: {
    backgroundColor: `${colors.primary}80`,
  },
  saveBtnText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.white,
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
    backgroundColor: colors.primary,
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
  promptList: { width: '100%', gap: spacing.sm },
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
