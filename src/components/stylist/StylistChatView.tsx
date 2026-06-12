import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths, EncodingType } from 'expo-file-system';
import { api, getAccessToken, API_BASE_URL } from '../../lib/api';
import { track } from '../../lib/analytics';
import { compressImageToDataUrl } from '../../lib/compressImage';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { useWeatherCurrent, type CurrentWeather } from '../../hooks/useWeather';
import { useItems } from '../../hooks/useItems';
import { useProfile } from '../../hooks/useProfile';
import { useCreateOutfit, type CreateOutfitInput } from '../../hooks/useOutfits';
import { addToWishlist } from '../../lib/wishlist';
import { VoiceInputButton } from '../primitives/VoiceInputButton';
import { ShopOutfitCard } from '../outfits/ShopOutfitCard';
import { colors, radii, shadows, spacing, typography } from '../../theme';
import type { ShopOutfit } from '../../types/shop';
import type { Item } from '../../types/item';

// ── Types ────────────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant';

type MissingEssential = {
  label: string;
  category: string;
  reason: string;
  context: string;
  priority: number;
};

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  isStreaming?: boolean;
  transcript?: string;
  shopOutfit?: ShopOutfit;
  suggestedItemIds?: number[];
  missingEssentials?: MissingEssential[];
  // Server-side recommendation ledger id — sent back with feedback so the
  // backend can link the reaction to the context that produced the suggestion.
  recId?: number;
};

type TtsResponse = {
  audioReply: string;
};

// ── Constants ────────────────────────────────────────────────────────────────

const CHIPS_CLOSET = [
  'Make it more casual',
  'Make it more formal',
  'Swap the shoes',
  'What accessories work?',
];

const CHIPS_SHOP = [
  'Try a different budget',
  'More casual version',
  'Show me from my closet',
  'Different occasion',
];

const CHIPS_DEFAULT = [
  'What should I wear today?',
  'Build me a casual outfit',
  'What goes with my blue jeans?',
  'Help me dress for a dinner date',
];

function useContextualChips(lastMessage: ChatMessage | undefined): string[] {
  return useMemo(() => {
    if (!lastMessage || lastMessage.role !== 'assistant') return CHIPS_DEFAULT;
    if (lastMessage.shopOutfit) return CHIPS_SHOP;
    if (lastMessage.suggestedItemIds?.length) return CHIPS_CLOSET;
    return CHIPS_DEFAULT;
  }, [lastMessage]);
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

type OccasionHint = 'formal' | 'business' | 'smart_casual' | 'casual' | 'athletic';

const OCCASION_PATTERNS: Array<{ hint: OccasionHint; pattern: RegExp }> = [
  {
    hint: 'athletic',
    pattern: /\b(gym|workout|work.?out|run(ning)?|exercise|sport|yoga|hike|hiking|active|trail|cycling|swim)\b/i,
  },
  {
    hint: 'formal',
    pattern: /\b(date.?night|dinner date|gala|black.?tie|cocktail|wedding|formal|fancy|suave|elegant|evening wear|dressed up)\b/i,
  },
  {
    hint: 'business',
    pattern: /\b(work|office|meeting|interview|conference|professional|corporate|boardroom|business)\b/i,
  },
  {
    hint: 'smart_casual',
    pattern: /\b(brunch|dinner|restaurant|bar|drinks|going out|night out|date)\b/i,
  },
  {
    hint: 'casual',
    pattern: /\b(casual|chill|errand|weekend|relax|lounge|comfortable|everyday|laid.?back)\b/i,
  },
];

function detectOccasionHint(text: string): OccasionHint | undefined {
  for (const { hint, pattern } of OCCASION_PATTERNS) {
    if (pattern.test(text)) return hint;
  }
  return undefined;
}

// ── Main Component ───────────────────────────────────────────────────────────

type Props = {
  initialQuery?: string;
  promptRequestId?: number;
  onPromptConsumed?: () => void;
  onClose: () => void;
  onNavigateToShop?: () => void;
};

export function StylistChatView({
  initialQuery,
  promptRequestId = 0,
  onPromptConsumed,
  onClose,
  onNavigateToShop,
}: Props) {
  const insets = useSafeAreaInsets();
  const weather = useWeatherCurrent();
  const { data: allItems = [] } = useItems();
  const { data: profile } = useProfile();
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
  const lastPromptRequestIdRef = useRef(0);

  const SESSION_KEY = 'stylist_last_session';

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

  async function playAudioFromBase64(messageId: string, base64: string) {
    const ttsFile = new File(Paths.cache, `stylist_tts_${Date.now()}.mp3`);
    ttsFile.write(base64, { encoding: EncodingType.Base64 });
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
      await playAudioFromBase64(messageId, data.audioReply);
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

      track('stylist_message_sent', {
        input_type: audio ? 'voice' : photoData ? 'photo' : 'text',
      });

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

      const assistantId = makeId();
      let assistantAdded = false;
      let pendingText = '';
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      let finalResponseText = '';
      let ttsReceivedFromStream = false;

      const flushPending = () => {
        const toFlush = pendingText;
        pendingText = '';
        flushTimer = null;
        if (!toFlush) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + toFlush } : m)),
        );
      };

      try {
        const history = buildHistory(messages);

        let weatherSummary: string | undefined;
        if (weather.data) {
          const useCelsius = profile?.tempUnit === 'C';
          const tempStr = useCelsius
            ? `${weather.data.temperatureC}°C`
            : `${weather.data.temperatureF}°F`;
          weatherSummary = `${weather.data.summary} ${tempStr}`;
        }

        let liveLocation: { lat: number; lon: number } | undefined;
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            liveLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          }
        } catch { /* location is non-fatal */ }

        const occasionHint = text ? detectOccasionHint(text) : undefined;

        const token = getAccessToken();
        const response = await fetch(`${API_BASE_URL}/api/stylist/ask`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ...(text ? { text } : {}),
            ...(audio ? { audio } : {}),
            ...(photoData ? { photoData } : {}),
            ...(weatherSummary ? { weatherSummary } : {}),
            ...(liveLocation ? { liveLocation } : {}),
            ...(occasionHint ? { occasionHint } : {}),
            history,
            _stream: true,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({})) as { message?: string };
          throw new Error(errData.message ?? 'Could not reach the stylist. Please try again.');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let sseBuffer = '';
        let currentEvent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (sessionRef.current !== session) { reader.cancel(); break; }

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              let parsed: Record<string, unknown>;
              try { parsed = JSON.parse(line.slice(6)); } catch { continue; }

              if (currentEvent === 'error') {
                throw new Error((parsed.message as string) ?? 'Could not reach the stylist. Please try again.');
              }

              if (currentEvent === 'done') {
                // Flush any remaining buffered text before processing the done event.
                if (flushTimer) { clearTimeout(flushTimer); }
                flushPending();

                const { transcript, responseText, itemIds, missingEssentials: mes, missingEssential: legacyMe, shopOutfit, recId } =
                  parsed as { transcript: string; responseText: string; itemIds?: number[]; missingEssentials?: MissingEssential[]; missingEssential?: { label: string; category: string; reason: string } | null; shopOutfit?: ShopOutfit | null; recId?: number | null };
                const hydratedEssentials: MissingEssential[] =
                  Array.isArray(mes) && mes.length > 0
                    ? mes
                    : legacyMe && typeof legacyMe === 'object' && legacyMe.label
                      ? [{ ...legacyMe, context: '', priority: 1 }]
                      : [];

                finalResponseText = responseText ?? '';

                if (audio && transcript) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === userMsg.id ? { ...m, text: transcript, transcript } : m,
                    ),
                  );
                }

                const finalMsg: ChatMessage = {
                  id: assistantId,
                  role: 'assistant',
                  text: finalResponseText,
                  isStreaming: false,
                  ...(shopOutfit ? { shopOutfit } : {}),
                  ...(itemIds?.length ? { suggestedItemIds: itemIds } : {}),
                  ...(hydratedEssentials.length ? { missingEssentials: hydratedEssentials } : {}),
                  ...(typeof recId === 'number' ? { recId } : {}),
                };

                if (!assistantAdded) {
                  // shop_new or error case — no tokens were streamed; add message now
                  setMessages((prev) => {
                    const next = [...prev, finalMsg];
                    AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next.slice(-6))).catch(() => {});
                    return next;
                  });
                } else {
                  // Finalize the streaming bubble
                  setMessages((prev) => {
                    const next = prev.map((m) =>
                      m.id === assistantId
                        ? { ...finalMsg, text: finalResponseText || m.text }
                        : m,
                    );
                    AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next.slice(-6))).catch(() => {});
                    return next;
                  });
                }

              } else if (currentEvent === 'tts_ready') {
                const { audioReply } = parsed as { audioReply: string };
                ttsReceivedFromStream = true;
                stopCurrentAudio();
                playAudioFromBase64(assistantId, audioReply).catch(() => {});
              } else if ('t' in parsed && typeof parsed.t === 'string') {
                // Text token — show streaming bubble on first token
                if (!assistantAdded) {
                  assistantAdded = true;
                  setMessages((prev) => [
                    ...prev,
                    { id: assistantId, role: 'assistant', text: '', isStreaming: true },
                  ]);
                }
                pendingText += parsed.t;
                if (!flushTimer) {
                  flushTimer = setTimeout(flushPending, 32);
                }
              }

              currentEvent = '';
            }
          }
        }

        if (!ttsReceivedFromStream && finalResponseText) {
          playTts(assistantId, finalResponseText);
        }
      } catch (err: unknown) {
        if (flushTimer) clearTimeout(flushTimer);
        if (sessionRef.current !== session) return;
        const msg = (err as { message?: string })?.message ?? 'Could not reach the stylist. Please try again.';
        Alert.alert('Stylist unavailable', msg);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== assistantId));
      } finally {
        if (sessionRef.current === session) setIsLoading(false);
      }
    },
    [isLoading, messages, profile?.tempUnit, weather.data],
  );

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved: ChatMessage[] = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length > 0) {
          setMessages(saved.slice(-6));
        }
      } catch { /* ignore corrupt data */ }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialQuery && !isLoading && promptRequestId > lastPromptRequestIdRef.current) {
      lastPromptRequestIdRef.current = promptRequestId;
      sendMessage({ text: initialQuery });
      onPromptConsumed?.();
    }
  }, [initialQuery, isLoading, onPromptConsumed, promptRequestId, sendMessage]);

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
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const contextualChips = useContextualChips(lastAssistantMsg);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.bottom}
    >
      {/* Header — glassmorphism via BlurView; falls back to a semi-opaque view on
          older Android devices where hardware blur isn't available. */}
      <BlurView
        intensity={20}
        tint="light"
        style={[styles.header, { paddingTop: insets.top }]}
        {...(Platform.OS === 'android' && { experimentalBlurMethod: 'dimezisBlurView' })}
      >
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
            AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
          }}
          accessibilityLabel="Clear conversation"
        >
          <Ionicons name="refresh-outline" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </BlurView>

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
          <EmptyState weather={weather.data} onPrompt={(q) => sendMessage({ text: q })} />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                allItems={allItems}
                isPlaying={playingId === msg.id}
                createOutfit={createOutfit}
                onNavigateToShop={onNavigateToShop}
                onToggleAudio={
                  msg.role === 'assistant' && !msg.isStreaming
                    ? () =>
                        playingId === msg.id
                          ? stopCurrentAudio()
                          : playTts(msg.id, msg.text)
                    : undefined
                }
              />
            ))}
            {isLoading && !messages.some((m) => m.isStreaming) && <TypingIndicator />}
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
          {contextualChips.map((chip) => (
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
  onNavigateToShop?: () => void;
};

function MessageBubble({ message, allItems, isPlaying, createOutfit, onToggleAudio, onNavigateToShop }: BubbleProps) {
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
            missingEssentials={message.missingEssentials}
            onNavigateToShop={onNavigateToShop}
            recId={message.recId}
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
            onSave={async () => {
              await addToWishlist(message.shopOutfit!);
              track('outfit_saved_to_wishlist');
            }}
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
          {message.text}{message.isStreaming ? '▍' : ''}
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

const OUTFIT_CATEGORY_ORDER = ['full_body', 'top', 'bottom', 'shoes', 'outerwear', 'accessory'];

function outfitNameFromItems(items: Item[]): string {
  if (items.length === 0) return 'AI Outfit';
  const sorted = [...items].sort(
    (a, b) => OUTFIT_CATEGORY_ORDER.indexOf(a.category ?? '') - OUTFIT_CATEGORY_ORDER.indexOf(b.category ?? ''),
  );
  return sorted.slice(0, 2).map((i) => i.name).join(' · ');
}

type OutfitSuggestionCardProps = {
  messageText: string;
  itemIds: number[];
  allItems: Item[];
  createOutfit: ReturnType<typeof useCreateOutfit>;
  missingEssentials?: MissingEssential[];
  onNavigateToShop?: () => void;
  recId?: number;
};

function OutfitSuggestionCard({ messageText, itemIds, allItems, createOutfit, missingEssentials, onNavigateToShop, recId }: OutfitSuggestionCardProps) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const matchedItems = useMemo(
    () => itemIds.map((id) => allItems.find((i) => i.id === id)).filter((i): i is Item => !!i),
    [itemIds, allItems],
  );

  async function handleSave() {
    if (saved || saving) return;
    setSaving(true);
    try {
      const input: CreateOutfitInput = {
        name: outfitNameFromItems(matchedItems),
        description: messageText.slice(0, 200) || null,
        itemIds: matchedItems.map((i) => ({ id: i.id, category: i.category as string })),
      };
      await createOutfit.mutateAsync(input);
      setSaved(true);
    } catch {
      // Error alert handled by the mutation
    } finally {
      setSaving(false);
    }
  }

  function handleFeedback(rating: 'up' | 'down') {
    if (feedback) return;
    setFeedback(rating);
    api.post('/api/stylist/feedback', { itemIds, rating, ...(recId ? { recId } : {}) }).catch(() => {});
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
              <Pressable key={item.id} style={styles.outfitThumbWrap} onPress={() => setSelectedItem(item)}>
                <View style={styles.outfitItemThumb}>
                  {imgUri ? (
                    <Image source={{ uri: imgUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <Ionicons name="shirt-outline" size={18} color={colors.mutedForeground} />
                  )}
                </View>
                <Text style={styles.outfitThumbLabel} numberOfLines={1} ellipsizeMode="tail">
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* AI response text */}
      <Text style={styles.outfitCardText}>{messageText}</Text>

      {/* Save button + feedback row */}
      <View style={styles.outfitCardActions}>
        <TouchableOpacity
          style={[styles.saveBtn, (saved || saving) && styles.saveBtnDone]}
          onPress={handleSave}
          disabled={saved || saving}
          activeOpacity={0.8}
        >
          <Ionicons
            name={saved ? 'checkmark-circle' : 'bookmark-outline'}
            size={15}
            color={saved ? colors.primaryForeground : colors.primary}
          />
          <Text style={[styles.saveBtnText, saved && styles.saveBtnTextDone]}>
            {saving ? 'Saving…' : saved ? 'Saved to Outfits' : 'Save to Outfits'}
          </Text>
        </TouchableOpacity>

        <View style={styles.feedbackRow}>
          <TouchableOpacity
            style={[styles.feedbackBtn, feedback === 'up' && styles.feedbackBtnActive]}
            onPress={() => handleFeedback('up')}
            disabled={!!feedback}
            accessibilityLabel="This outfit works for me"
          >
            <Ionicons
              name="thumbs-up-outline"
              size={16}
              color={feedback === 'up' ? colors.primary : colors.mutedForeground}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.feedbackBtn, feedback === 'down' && styles.feedbackBtnActive]}
            onPress={() => handleFeedback('down')}
            disabled={!!feedback}
            accessibilityLabel="This outfit doesn't work for me"
          >
            <Ionicons
              name="thumbs-down-outline"
              size={16}
              color={feedback === 'down' ? colors.primary : colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Wardrobe gap banners — sorted by priority, max 3 */}
      {(missingEssentials ?? []).map((item, i) => (
        <TouchableOpacity
          key={i}
          style={styles.missingEssentialBanner}
          onPress={onNavigateToShop}
          activeOpacity={onNavigateToShop ? 0.7 : 1}
        >
          <Ionicons name="bag-handle-outline" size={14} color={colors.primary} />
          <Text style={styles.missingEssentialText} numberOfLines={1}>
            {item.label}{item.context ? ` — ${item.context}` : ''}
          </Text>
          {onNavigateToShop && (
            <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
          )}
        </TouchableOpacity>
      ))}

      <ItemDetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
    </View>
  );
}

// ── ItemDetailSheet ───────────────────────────────────────────────────────────

type ItemDetailSheetProps = {
  item: Item | null;
  onClose: () => void;
};

function ItemDetailSheet({ item, onClose }: ItemDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const imgUri = item ? resolveImageUri(item.imageUrl) : null;

  const metaRows = item
    ? ([
        item.category && { label: 'Category', value: item.category.replace(/_/g, ' ') },
        item.brand    && { label: 'Brand',    value: item.brand },
        item.color    && { label: 'Color',    value: item.color },
        item.style    && { label: 'Style',    value: item.style },
        item.occasions?.[0] && { label: 'Occasion', value: item.occasions[0] },
      ].filter(Boolean) as { label: string; value: string }[])
    : [];

  return (
    <Modal
      visible={!!item}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {item && (
        <View style={[styles.sheetRoot, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={2}>{item.name}</Text>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sheetImageWrap}>
              {imgUri ? (
                <Image source={{ uri: imgUri }} style={styles.sheetImage} resizeMode="contain" />
              ) : (
                <View style={styles.sheetImagePlaceholder}>
                  <Ionicons name="shirt-outline" size={48} color={colors.border} />
                </View>
              )}
            </View>

            {metaRows.length > 0 && (
              <View style={styles.sheetMeta}>
                {metaRows.map((row, i) => (
                  <View
                    key={row.label}
                    style={[styles.sheetMetaRow, i < metaRows.length - 1 && styles.sheetMetaRowBorder]}
                  >
                    <Text style={styles.sheetMetaLabel}>{row.label}</Text>
                    <Text style={styles.sheetMetaValue} numberOfLines={1}>{row.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </Modal>
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

function buildEmptyStatePrompts(weather: CurrentWeather | undefined): string[] {
  const day = new Date().toLocaleDateString('en', { weekday: 'long' });
  const prompts: string[] = [];

  if (weather) {
    const { condition, summary } = weather;
    if (condition === 'rainy') {
      prompts.push(`It's ${summary.toLowerCase()} — what should I wear?`);
    } else if (condition === 'cold') {
      prompts.push(`It's ${summary.toLowerCase()} — help me stay warm and stylish`);
    } else {
      prompts.push(`What should I wear on this ${summary.toLowerCase()} ${day}?`);
    }
  } else {
    prompts.push(`What should I wear today?`);
  }

  prompts.push('Build me a casual weekend outfit');
  prompts.push('What goes with my blue jeans?');
  prompts.push('Help me dress for a dinner date');

  return prompts;
}

function EmptyState({ weather, onPrompt }: { weather: CurrentWeather | undefined; onPrompt: (q: string) => void }) {
  const prompts = buildEmptyStatePrompts(weather);

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
        {prompts.map((p) => (
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
  // Header — backgroundColor intentionally omitted; BlurView owns the background.
  // On Android devices that don't support hardware blur, expo-blur renders a
  // semi-transparent tinted surface automatically, so no explicit fallback is needed.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD6CD',
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
  outfitThumbWrap: {
    alignItems: 'center',
    width: 72,
    gap: spacing.xs,
  },
  outfitItemThumb: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitThumbLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
    textAlign: 'center',
    width: 72,
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
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
  },
  saveBtnDone: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  saveBtnText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  saveBtnTextDone: {
    color: colors.white,
  },
  outfitCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  feedbackBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBtnActive: {
    backgroundColor: `${colors.primary}18`,
    borderColor: colors.primary,
  },
  missingEssentialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    backgroundColor: `${colors.primary}0D`,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: `${colors.primary}22`,
  },
  missingEssentialText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
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
  // Item detail sheet
  sheetRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  sheetTitle: {
    flex: 1,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    flexShrink: 0,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.xl,
  },
  sheetImageWrap: {
    width: '80%',
    aspectRatio: 4 / 5,
    borderRadius: radii.lg,
    backgroundColor: colors.muted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetImage: {
    width: '100%',
    height: '100%',
  },
  sheetImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetMeta: {
    width: '100%',
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sheetMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  sheetMetaRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetMetaLabel: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
  },
  sheetMetaValue: {
    fontSize: typography.size.sm,
    color: colors.foreground,
    textTransform: 'capitalize',
    maxWidth: '60%',
    textAlign: 'right',
  },
});
