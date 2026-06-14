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
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths, EncodingType } from 'expo-file-system';
import { api, getAccessToken, API_BASE_URL } from '../../lib/api';
import { track } from '../../lib/analytics';
import { compressImageToDataUrl } from '../../lib/compressImage';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { useStylingWeatherToday, type CurrentWeather } from '../../hooks/useWeather';
import { useItems } from '../../hooks/useItems';
import { useProfile } from '../../hooks/useProfile';
import { useActiveStylingLocation } from '../../hooks/useActiveStylingLocation';
import { conversationLocation, type StylingLocationContext } from '../../lib/stylingLocation';
import { useCreateOutfit, type CreateOutfitInput } from '../../hooks/useOutfits';
import { addToWishlist } from '../../lib/wishlist';
import { VoiceInputButton } from '../primitives/VoiceInputButton';
import { LocationAutocompleteInput } from '../primitives/LocationAutocompleteInput';
import { ShopOutfitCard } from '../outfits/ShopOutfitCard';
import { ResolvedOutfitCollage } from '../outfits/ResolvedOutfitCollage';
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

const PROMPT_ICONS: Array<keyof typeof Ionicons.glyphMap> = [
  'sunny-outline',
  'cafe-outline',
  'color-palette-outline',
  'wine-outline',
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
  initialDestination?: string;
  promptRequestId?: number;
  onPromptConsumed?: () => void;
  onClose: () => void;
  onNavigateToShop?: () => void;
};

export function StylistChatView({
  initialQuery,
  initialDestination,
  promptRequestId = 0,
  onPromptConsumed,
  onClose,
  onNavigateToShop,
}: Props) {
  const insets = useSafeAreaInsets();
  const { data: allItems = [] } = useItems();
  const { data: profile } = useProfile();
  const stylingLocation = useActiveStylingLocation();
  const [conversationLocationContext, setConversationLocationContext] = useState<StylingLocationContext | null>(
    initialDestination ? conversationLocation(initialDestination) : null,
  );
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const activeLocation = conversationLocationContext ?? stylingLocation.activeLocation;
  const weather = useStylingWeatherToday(activeLocation);
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

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
            ? `${weather.data.current.temperatureC}°C`
            : `${weather.data.current.temperatureF}°F`;
          weatherSummary = `${weather.data.current.summary} ${tempStr}`;
        }

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
            ...((activeLocation.label || activeLocation.coords) ? {
              locationContext: {
                source: activeLocation.source,
                ...(activeLocation.label ? { label: activeLocation.label } : {}),
                ...(activeLocation.coords ? { coords: activeLocation.coords } : {}),
              },
            } : {}),
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
    [activeLocation, isLoading, messages, profile?.tempUnit, weather.data],
  );

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    setConversationLocationContext(initialDestination ? conversationLocation(initialDestination) : null);
  }, [initialDestination]);

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
    const timer = setTimeout(() => {
      if (messages.length === 0 && !isLoading) {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        return;
      }
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
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

  function confirmNewConversation() {
    Alert.alert(
      'Start a new styling session?',
      'This clears the current conversation from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start New',
          onPress: () => {
            stopCurrentAudio();
            sessionRef.current++;
            setMessages([]);
            setInputText('');
            setIsLoading(false);
            setMentionQuery(null);
            setConversationLocationContext(null);
            AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
            Haptics.selectionAsync().catch(() => {});
          },
        },
      ],
    );
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
      <BlurView
        intensity={35}
        tint="systemThinMaterialLight"
        style={[styles.header, { paddingTop: insets.top }]}
        {...(Platform.OS === 'android' && { blurMethod: 'dimezisBlurViewSdk31Plus' })}
      >
        <TouchableOpacity style={styles.headerBtn} onPress={onClose} accessibilityLabel="Close stylist">
          <Ionicons name="chevron-down" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerIdentity}>
          <View style={styles.headerMark}>
            <Ionicons name="sparkles" size={13} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Your Stylist</Text>
            <TouchableOpacity onPress={() => setLocationPickerVisible(true)} activeOpacity={0.7}>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {activeLocation.label || 'Set location'} · {activeLocation.source === 'conversation' ? 'Destination' : activeLocation.source === 'home' ? 'Home fallback' : 'Current'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={confirmNewConversation}
          accessibilityLabel="Start a new conversation"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </BlurView>

      {/* Messages */}
      <ScrollView
        key={isEmpty ? 'empty-session' : 'active-session'}
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
          <EmptyState
            weather={weather.data?.current}
            displayName={profile?.displayName}
            location={activeLocation.label}
            wardrobeCount={allItems.length}
            onLocationPress={() => setLocationPickerVisible(true)}
            onPrompt={(q) => sendMessage({ text: q })}
          />
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

      <ConversationLocationPicker
        visible={locationPickerVisible}
        activeLocation={activeLocation}
        homeLocation={stylingLocation.homeLocation}
        everydayLocation={stylingLocation.activeLocation}
        permissionStatus={stylingLocation.permissionStatus}
        onRequestCurrent={stylingLocation.requestCurrentLocation}
        onSelect={(location) => {
          setConversationLocationContext(location);
          setLocationPickerVisible(false);
        }}
        onClose={() => setLocationPickerVisible(false)}
      />

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
        <View style={styles.composer}>
          <Pressable
            style={styles.photoBtn}
            onPress={handlePickPhoto}
            disabled={isLoading}
            accessibilityLabel="Add a photo"
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>

          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Ask about an outfit or tag @a piece"
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2000}
            returnKeyType="default"
            editable={!isLoading}
          />

          {inputText.trim() ? (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleSendText}
              disabled={isLoading}
              accessibilityLabel="Send message"
            >
              <Ionicons name="arrow-up" size={19} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <VoiceInputButton onAudioReady={(b64) => sendMessage({ audio: b64 })} disabled={isLoading} />
          )}
        </View>
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
      <EditorialEntrance>
        <View style={styles.editorialResponse}>
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
            <TouchableOpacity style={styles.quietAudioBtn} onPress={onToggleAudio} accessibilityLabel="Read styling notes aloud">
              <Ionicons
                name={isPlaying ? 'pause-circle-outline' : 'volume-medium-outline'}
                size={18}
                color={colors.mutedForeground}
              />
              <Text style={styles.quietActionText}>{isPlaying ? 'Pause notes' : 'Listen to notes'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </EditorialEntrance>
    );
  }

  if (!isUser && message.shopOutfit) {
    return (
      <EditorialEntrance>
        <View style={styles.shopCardContainer}>
          <View style={styles.sectionEyebrow}>
            <Ionicons name="bag-handle-outline" size={13} color={colors.primary} />
            <Text style={styles.sectionEyebrowText}>Shopping edit</Text>
          </View>
          <ShopOutfitCard
            outfit={message.shopOutfit}
            onSave={async () => {
              await addToWishlist(message.shopOutfit!);
              track('outfit_saved_to_wishlist');
            }}
          />
          {onToggleAudio && (
            <TouchableOpacity style={styles.quietAudioBtn} onPress={onToggleAudio} accessibilityLabel="Read shopping notes aloud">
              <Ionicons
                name={isPlaying ? 'pause-circle-outline' : 'volume-medium-outline'}
                size={18}
                color={colors.mutedForeground}
              />
              <Text style={styles.quietActionText}>{isPlaying ? 'Pause notes' : 'Listen to notes'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </EditorialEntrance>
    );
  }

  if (!isUser) {
    return (
      <EditorialEntrance>
        <View style={styles.stylistNote}>
          <View style={styles.sectionEyebrow}>
            <Ionicons name="sparkles" size={13} color={colors.primary} />
            <Text style={styles.sectionEyebrowText}>Stylist note</Text>
          </View>
          <Text style={styles.stylistNoteText}>
            {message.text}{message.isStreaming ? '▍' : ''}
          </Text>
          {onToggleAudio && (
            <TouchableOpacity style={styles.quietAudioBtn} onPress={onToggleAudio} accessibilityLabel="Read stylist note aloud">
              <Ionicons
                name={isPlaying ? 'pause-circle-outline' : 'volume-medium-outline'}
                size={18}
                color={colors.mutedForeground}
              />
              <Text style={styles.quietActionText}>{isPlaying ? 'Pause' : 'Listen'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </EditorialEntrance>
    );
  }

  return (
    <View style={[styles.bubbleRow, styles.bubbleRowUser]}>
      <View style={[styles.bubble, styles.bubbleUser]}>
        <Text style={[styles.bubbleText, styles.bubbleTextUser]}>
          {message.text}{message.isStreaming ? '▍' : ''}
        </Text>
      </View>
    </View>
  );
}

function EditorialEntrance({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
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
  const { width } = useWindowDimensions();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const matchedItems = useMemo(
    () => itemIds.map((id) => allItems.find((i) => i.id === id)).filter((i): i is Item => !!i),
    [itemIds, allItems],
  );
  const collageSlots = useMemo(
    () => matchedItems.map((item) => ({
      key: String(item.id),
      uri: resolveImageUri(item.imageUrl),
    })),
    [matchedItems],
  );
  const collageSize = Math.max(240, Math.min(width - spacing.xxl * 2, 420));
  const lookTitle = outfitNameFromItems(matchedItems);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
      <View style={styles.lookHeader}>
        <View style={styles.sectionEyebrow}>
          <Ionicons name="sparkles" size={13} color={colors.primary} />
          <Text style={styles.sectionEyebrowText}>Styled for you</Text>
        </View>
        <Text style={styles.lookTitle} numberOfLines={2}>{lookTitle}</Text>
        <Text style={styles.lookMeta}>{matchedItems.length} pieces from your wardrobe</Text>
      </View>

      {collageSlots.length > 0 && (
        <View style={styles.collageFrame}>
          <ResolvedOutfitCollage
            slots={collageSlots}
            size={collageSize}
            height={Math.round(collageSize * 0.88)}
            borderRadius={radii.lg}
          />
          <View style={styles.collageLabels}>
            {matchedItems.slice(0, 4).map((item, index) => (
              <Pressable
                key={item.id}
                style={styles.collageLabel}
                onPress={() => setSelectedItem(item)}
                accessibilityLabel={`View ${item.name}`}
              >
                <Text style={styles.collageLabelIndex}>{index + 1}</Text>
                <Text style={styles.collageLabelText} numberOfLines={1}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.rationaleLabel}>Why it works</Text>
      <Text style={styles.outfitCardText}>{messageText}</Text>

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
            {saving ? 'Saving…' : saved ? 'Saved to outfits' : 'Save this look'}
          </Text>
        </TouchableOpacity>

        <View style={styles.feedbackRow}>
          <Text style={styles.feedbackLabel}>Was this useful?</Text>
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
    <View style={styles.typingRow}>
      <View style={styles.typingLabel}>
        <Ionicons name="sparkles" size={13} color={colors.primary} />
        <Text style={styles.sectionEyebrowText}>Styling your answer</Text>
      </View>
      <View style={styles.typingBubble}>
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

function EmptyState({
  weather,
  displayName,
  location,
  wardrobeCount,
  onLocationPress,
  onPrompt,
}: {
  weather: CurrentWeather | undefined;
  displayName?: string | null;
  location?: string;
  wardrobeCount: number;
  onLocationPress: () => void;
  onPrompt: (q: string) => void;
}) {
  const prompts = buildEmptyStatePrompts(weather);
  const firstName = displayName?.trim().split(/\s+/)[0];
  const context = [
    location,
    weather?.summary,
    wardrobeCount > 0 ? `${wardrobeCount} wardrobe pieces ready` : 'Ready to learn your wardrobe',
  ].filter(Boolean).join(' · ');

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyHero}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="sparkles" size={28} color={colors.primary} />
        </View>
        <Text style={styles.emptyKicker}>Your private styling session</Text>
        <Text style={styles.emptyTitle}>
          {firstName ? `What are we dressing for, ${firstName}?` : 'What are we dressing for?'}
        </Text>
        <Text style={styles.emptySubtitle}>
          I can build looks from your wardrobe, refine an idea, or help you dress for what is next.
        </Text>
        <TouchableOpacity style={styles.contextPill} onPress={onLocationPress} activeOpacity={0.7}>
          <Ionicons name="location-outline" size={13} color={colors.primary} />
          <Text style={styles.contextPillText}>{context}</Text>
          <Ionicons name="chevron-down" size={12} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.promptHeader}>
        <Text style={styles.promptHeaderTitle}>Start with an idea</Text>
        <Text style={styles.promptHeaderHint}>or ask anything below</Text>
      </View>
      <View style={styles.promptList}>
        {prompts.map((p, index) => (
          <TouchableOpacity
            key={p}
            style={styles.promptChip}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onPrompt(p);
            }}
          >
            <View style={styles.promptIcon}>
              <Ionicons name={PROMPT_ICONS[index]} size={17} color={colors.primary} />
            </View>
            <Text style={styles.promptChipText}>{p}</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ConversationLocationPicker({
  visible,
  activeLocation,
  homeLocation,
  everydayLocation,
  permissionStatus,
  onRequestCurrent,
  onSelect,
  onClose,
}: {
  visible: boolean;
  activeLocation: StylingLocationContext;
  homeLocation?: string;
  everydayLocation: StylingLocationContext;
  permissionStatus: 'granted' | 'denied' | 'undetermined';
  onRequestCurrent: () => Promise<unknown>;
  onSelect: (location: StylingLocationContext | null) => void;
  onClose: () => void;
}) {
  const [destination, setDestination] = useState('');

  useEffect(() => {
    if (visible) setDestination(activeLocation.source === 'conversation' ? activeLocation.label ?? '' : '');
  }, [activeLocation, visible]);

  const chooseCurrent = async () => {
    if (permissionStatus !== 'granted') {
      const status = await onRequestCurrent();
      if (status !== 'granted') return;
    }
    onSelect(null);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.locationPicker} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.locationPickerHeader}>
          <View style={styles.locationPickerHeaderCopy}>
            <Text style={styles.locationPickerTitle}>Where are we dressing for?</Text>
            <Text style={styles.locationPickerSubtitle}>This choice lasts only for this conversation.</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose} accessibilityLabel="Close location picker">
            <Ionicons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.locationChoice} onPress={chooseCurrent}>
          <Ionicons name="navigate-outline" size={18} color={colors.primary} />
          <View style={styles.locationChoiceCopy}>
            <Text style={styles.locationChoiceTitle}>Current location</Text>
            <Text style={styles.locationChoiceHint}>
              {everydayLocation.source === 'current' ? everydayLocation.label : permissionStatus === 'granted' ? 'Refresh current location' : 'Enable current location'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.locationChoice, !homeLocation && styles.locationChoiceDisabled]}
          onPress={() => homeLocation && onSelect({ source: 'home', label: homeLocation, isFallback: false })}
          disabled={!homeLocation}
        >
          <Ionicons name="home-outline" size={18} color={colors.primary} />
          <View style={styles.locationChoiceCopy}>
            <Text style={styles.locationChoiceTitle}>Home</Text>
            <Text style={styles.locationChoiceHint}>{homeLocation || 'Add a Home city in Profile first'}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.destinationCard}>
          <Text style={styles.locationChoiceTitle}>Choose destination</Text>
          <Text style={styles.locationChoiceHint}>Useful for trips, packing, or plans somewhere else.</Text>
          <LocationAutocompleteInput
            value={destination}
            onChangeText={setDestination}
            onSelect={setDestination}
            placeholder="Search a city or region"
          />
          <TouchableOpacity
            style={[styles.destinationButton, !destination.trim() && styles.locationChoiceDisabled]}
            onPress={() => destination.trim() && onSelect(conversationLocation(destination))}
            disabled={!destination.trim()}
          >
            <Text style={styles.destinationButtonText}>Use destination</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerMark: {
    width: 32, height: 32, borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSelected,
  },
  headerSubtitle: { fontSize: 10, color: colors.mutedForeground, marginTop: 1 },
  // Messages
  messageList: { flex: 1 },
  messageListContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  messageListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  // Follow-up chips
  chipsBar: {
    flexGrow: 0,
  },
  chipsContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surfaceElevated,
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  composer: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    ...shadows.md,
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
  // Message bubbles
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: radii.md,
  },
  bubbleText: {
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * 1.55,
  },
  bubbleTextUser: { color: colors.white },
  editorialResponse: { gap: spacing.sm },
  shopCardContainer: { gap: spacing.sm },
  stylistNote: { gap: spacing.sm, paddingHorizontal: spacing.xs },
  stylistNoteText: {
    fontSize: typography.size.md,
    color: colors.foreground,
    lineHeight: typography.size.md * 1.6,
  },
  sectionEyebrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionEyebrowText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quietAudioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  quietActionText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
  },
  // Outfit suggestion card
  outfitCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.md,
  },
  lookHeader: { gap: spacing.xs },
  lookTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    lineHeight: typography.size.xl * 1.25,
    letterSpacing: -0.4,
  },
  lookMeta: { fontSize: typography.size.xs, color: colors.mutedForeground },
  collageFrame: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  collageLabels: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  collageLabel: {
    maxWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingRight: spacing.xs,
  },
  collageLabelIndex: {
    width: 18,
    height: 18,
    borderRadius: 9,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 18,
    color: colors.primary,
    backgroundColor: colors.surfaceSelected,
    overflow: 'hidden',
  },
  collageLabelText: { flexShrink: 1, fontSize: 10, color: colors.mutedForeground },
  rationaleLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  outfitCardText: {
    fontSize: typography.size.sm,
    color: colors.foreground,
    lineHeight: typography.size.sm * 1.65,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: spacing.sm + 2,
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
    color: colors.white,
  },
  saveBtnTextDone: {
    color: colors.white,
  },
  outfitCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  feedbackLabel: { display: 'none', fontSize: 10, color: colors.mutedForeground },
  feedbackBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
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
  typingRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  typingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typingBubble: { flexDirection: 'row', gap: spacing.xs },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  // Empty state
  emptyState: {
    paddingHorizontal: spacing.sm,
    gap: spacing.xl,
  },
  emptyHero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyKicker: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  emptyTitle: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    textAlign: 'center',
    lineHeight: typography.size.xxl * 1.15,
    letterSpacing: -0.7,
  },
  emptySubtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: typography.size.sm * 1.6,
    maxWidth: 330,
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceSelected,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  contextPillText: {
    flexShrink: 1,
    fontSize: 10,
    color: colors.secondaryForeground,
    fontWeight: typography.weight.medium,
  },
  locationPicker: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  locationPickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  locationPickerHeaderCopy: { flex: 1, gap: 3 },
  locationPickerTitle: {
    fontSize: typography.size.xl,
    color: colors.foreground,
    fontWeight: typography.weight.bold,
  },
  locationPickerSubtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    lineHeight: 19,
  },
  locationChoice: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
  },
  locationChoiceDisabled: { opacity: 0.45 },
  locationChoiceCopy: { flex: 1, gap: 2 },
  locationChoiceTitle: {
    fontSize: typography.size.md,
    color: colors.foreground,
    fontWeight: typography.weight.semibold,
  },
  locationChoiceHint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    lineHeight: 17,
  },
  destinationCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    ...shadows.sm,
  },
  destinationButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  destinationButtonText: {
    fontSize: typography.size.sm,
    color: colors.primaryForeground,
    fontWeight: typography.weight.semibold,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  promptHeaderTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  promptHeaderHint: { fontSize: typography.size.xs, color: colors.mutedForeground },
  promptIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptList: { width: '100%', gap: spacing.sm },
  promptChip: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    ...shadows.xs,
  },
  promptChipText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
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
