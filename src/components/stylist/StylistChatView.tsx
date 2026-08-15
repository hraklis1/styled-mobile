import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  type ViewStyle,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  FadeInUp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths, EncodingType } from 'expo-file-system';
import * as onDeviceSpeech from '../../lib/speech';
import { api } from '../../lib/api';
import { track } from '../../lib/analytics';
import { compressImageToDataUrl } from '../../lib/compressImage';
import { prepareStylistPhoto } from '../../lib/prepareStylistPhoto';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { useStylingWeatherToday, type CurrentWeather } from '../../hooks/useWeather';
import { useItems } from '../../hooks/useItems';
import { useProfile } from '../../hooks/useProfile';
import { useActiveStylingLocation } from '../../hooks/useActiveStylingLocation';
import { conversationLocation, type StylingLocationContext } from '../../lib/stylingLocation';
import { resolveTempUnit } from '../../lib/temperature';
import {
  useAcceptEventOutfitPlan,
  useCreateOutfit,
  useDeleteOutfit,
  useGenerateEventOutfitPlan,
  type CreateOutfitInput,
} from '../../hooks/useOutfits';
import { useAssignEventItems } from '../../hooks/useEvents';
import { addOutfitToWishlist } from '../../hooks/useWishlist';
import { StylistComposer } from './composer/StylistComposer';
import { LocationAutocompleteInput } from '../primitives/LocationAutocompleteInput';
import { ShopOutfitCard } from '../outfits/ShopOutfitCard';
import { ItemPickerSheet } from '../outfits/ItemPickerSheet';
import { BoardPickerModal } from '../boards/BoardPickerModal';
import type { BoardEntryRef } from '../../hooks/useBoards';
import { ResolvedOutfitCollage } from '../outfits/ResolvedOutfitCollage';
import { StylistRichText } from './StylistRichText';
import { GapCard } from './GapCard';
import { TripPlanCard } from './TripPlanCard';
import { StylistIntakeSheet } from './StylistIntakeSheet';
import { WardrobeAuditCard } from './WardrobeAuditCard';
import { buildStylistStarters, buildTodayPrompt, type StylistStarter } from './stylist-empty-state';
import { colors, radii, shadows, spacing, typography } from '../../theme';
import { useStylistTransport } from '../../features/stylist/hooks/useStylistTransport';
import { buildInitialStylistSendOptions } from '../../features/stylist/initialPrompt';
import {
  STYLIST_NEGATIVE_REASON_CHIPS,
  type StylistAskRequest,
  type StylistComposerAttachment,
  type StylistEntryContext,
  type StylistEventPlanData,
  type StylistFeedbackMetadata,
  type StylistMessage,
  type StylistMissingEssential,
  type StylistMode,
  type StylistNegativeReason,
  type StylistRenderType,
  type StylistSendOptions,
  type StylistTripPlanData,
  type StylistWardrobeAuditData,
  type StylistWorkflow,
} from '../../features/stylist/types';
import { deviceTimeContext, summarizeStylistWorkflow } from '../../features/stylist/workflows';
import { BUDGET_OPTIONS, OCCASION_OPTIONS, STYLE_OPTIONS } from '../../lib/profileOptions';
import type { ShopOutfit } from '../../types/shop';
import type { Item } from '../../types/item';

// ── Types ────────────────────────────────────────────────────────────────────

type Role = StylistMessage['role'];
type MissingEssential = StylistMissingEssential;
type ChatMessage = StylistMessage;
type ComposerAttachment = StylistComposerAttachment;
type SendOptions = StylistSendOptions;

// A persisted stylist thread, as summarized by GET /api/stylist/conversations.
type Conversation = {
  id: number;
  title: string;
  source?: string | null;
  updatedAt: string;
  preview?: string | null;
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

const CHIPS_ADVICE = [
  'Build that into an outfit',
  'What else pairs with it?',
  "What's missing from my closet?",
  'What should I buy next?',
];

const CHIPS_TRIP = [
  'Add a dressier option',
  'Keep it carry-on only',
  'Make it more casual',
  'What am I missing to pack?',
];

const CHIPS_AUDIT = [
  'Show me my best investments',
  'Which pieces should I let go?',
  'Build an outfit with an underused piece',
  'How can I get more from what I own?',
];

function useContextualChips(lastMessage: ChatMessage | undefined): string[] {
  return useMemo(() => {
    if (!lastMessage || lastMessage.role !== 'assistant') return CHIPS_DEFAULT;
    if (lastMessage.wardrobeAudit || lastMessage.mode === 'wardrobe_audit') return CHIPS_AUDIT;
    if (lastMessage.tripPlan || lastMessage.mode === 'trip') return CHIPS_TRIP;
    if (lastMessage.mode === 'advice') return CHIPS_ADVICE;
    if (lastMessage.shopOutfit) return CHIPS_SHOP;
    if (lastMessage.suggestedItemIds?.length) return CHIPS_CLOSET;
    return CHIPS_DEFAULT;
  }, [lastMessage]);
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

// ── Conversation persistence keys ──────────────────────────────────────────────
// The server is the source of truth for threads; these AsyncStorage entries are a
// thin cache so the active thread resumes instantly and reads while offline.
const ACTIVE_THREAD_KEY = 'stylist_active_thread_id';
const LEGACY_SESSION_KEY = 'stylist_last_session';
const threadKey = (id: number) => `stylist_thread_${id}`;

// Structured render data the server stores alongside an assistant turn, so a
// reloaded thread redraws outfit cards, shop edits, and trip carousels instead
// of degrading them to plain notes. Mirrors the /ask `done` event's rich fields.
type ServerMessagePayload = {
  mode?: StylistMode;
  itemIds?: number[];
  eventPlan?: StylistEventPlanData | null;
  lookName?: string;
  missingEssentials?: MissingEssential[];
  shopOutfit?: ShopOutfit;
  tripPlan?: StylistTripPlanData;
  wardrobeAudit?: StylistWardrobeAuditData;
  boardAction?: 'outfit' | 'complete' | 'capsule' | 'theme';
};

type ServerMessage = { id: number; role: Role; text: string; recId?: number | null; payload?: ServerMessagePayload | null; createdAt?: string };

function renderTypeForAssistantPayload(payload?: ServerMessagePayload | null): StylistRenderType {
  if (payload?.wardrobeAudit) return 'wardrobe_audit';
  if (payload?.tripPlan) return 'trip_plan';
  if (payload?.shopOutfit) return 'shopping_outfit';
  if (payload?.mode === 'advice') return 'advice';
  if (payload?.itemIds?.length || payload?.eventPlan) return 'closet_outfit';
  return 'text';
}

function renderTypeForAssistantMessage(message: {
  tripPlan?: StylistTripPlanData;
  shopOutfit?: ShopOutfit;
  mode?: StylistMode;
  suggestedItemIds?: number[];
  wardrobeAudit?: StylistWardrobeAuditData;
}): StylistRenderType {
  if (message.wardrobeAudit) return 'wardrobe_audit';
  if (message.tripPlan) return 'trip_plan';
  if (message.shopOutfit) return 'shopping_outfit';
  if (message.mode === 'advice') return 'advice';
  if (message.suggestedItemIds?.length) return 'closet_outfit';
  return 'text';
}

function normalizeChatMessage(message: ChatMessage): ChatMessage {
  if (message.role === 'assistant') {
    return {
      ...message,
      kind: 'assistant',
      renderType: renderTypeForAssistantMessage(message),
    };
  }
  return {
    ...message,
    kind: 'user',
    renderType: 'text',
  };
}

function isRichAssistantMessage(message: ChatMessage | undefined): message is Extract<ChatMessage, { role: 'assistant' }> {
  return !!message
    && message.role === 'assistant'
    && !message.isStreaming
    && (
      message.renderType === 'closet_outfit'
      || message.renderType === 'shopping_outfit'
      || message.renderType === 'trip_plan'
      || message.renderType === 'wardrobe_audit'
      || !!message.suggestedItemIds?.length
      || !!message.shopOutfit
      || !!message.tripPlan
      || !!message.wardrobeAudit
    );
}

// Map a server-stored thread into chat messages. The recId is preserved so
// feedback still links; the payload (when present) rehydrates rich replies —
// without it, an assistant turn falls back to a plain stylist note.
function mapServerMessages(rows: ServerMessage[]): ChatMessage[] {
  return rows.map((m) => {
    const p = m.payload ?? undefined;
    if (m.role === 'user') {
      return {
        id: `srv_${m.id}`,
        role: 'user',
        kind: 'user',
        renderType: 'text',
        text: m.text,
        ...(m.createdAt ? { createdAt: new Date(m.createdAt).getTime() } : {}),
      };
    }
    return {
      id: `srv_${m.id}`,
      role: 'assistant',
      kind: 'assistant',
      renderType: renderTypeForAssistantPayload(p),
      text: m.text,
      ...(typeof m.recId === 'number' ? { recId: m.recId } : {}),
      ...(p?.mode ? { mode: p.mode } : {}),
      ...(p?.itemIds?.length && p.boardAction !== 'complete' && p.boardAction !== 'theme' ? { suggestedItemIds: p.itemIds } : {}),
      ...(p?.eventPlan ? { eventPlan: p.eventPlan } : {}),
      ...(p?.lookName ? { lookName: p.lookName } : {}),
      ...(p?.missingEssentials?.length ? { missingEssentials: p.missingEssentials } : {}),
      ...(p?.shopOutfit ? { shopOutfit: p.shopOutfit } : {}),
      // Reloaded trip plans are complete, never mid-stream — clear the pending flag.
      ...(p?.tripPlan ? { tripPlan: { ...p.tripPlan, pending: false } } : {}),
      ...(p?.wardrobeAudit ? { wardrobeAudit: p.wardrobeAudit } : {}),
      ...(p?.boardAction ? { boardAction: p.boardAction } : {}),
      ...(m.createdAt ? { createdAt: new Date(m.createdAt).getTime() } : {}),
    };
  });
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString('en', { month: 'short', day: 'numeric' });
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

type EventContext = { id: number; title: string };

type Props = {
  initialQuery?: string;
  initialAttachmentUri?: string;
  initialMode?: StylistMode;
  initialDestination?: string;
  eventContext?: EventContext;
  entryContext?: StylistEntryContext;
  promptRequestId?: number;
  // Entry point that opened the stylist — stored on a new thread for analytics.
  source?: string;
  // Whether opening should start a fresh thread or resume the last one. Topical
  // entry points pass 'new'; the generic center-tab open passes 'resume'.
  threadMode?: 'new' | 'resume';
  // Increments on every open() so the view can apply threadMode each time, even
  // though it stays mounted inside the always-rendered modal.
  openRequestId?: number;
  onPromptConsumed?: () => void;
  onClose?: () => void;
  /** True when rendered as the permanent Stylist tab rather than a contextual modal. */
  embedded?: boolean;
  onNavigateToShop?: () => void;
  onNavigateToCloset?: (outfitId: number) => void;
};

export function StylistChatView({
  initialQuery,
  initialAttachmentUri,
  initialMode,
  initialDestination,
  eventContext,
  entryContext,
  promptRequestId = 0,
  source,
  threadMode = 'resume',
  openRequestId = 0,
  onPromptConsumed,
  onClose,
  embedded = false,
  onNavigateToShop,
  onNavigateToCloset,
}: Props) {
  const insets = useSafeAreaInsets();
  const { data: allItems = [] } = useItems();
  const { data: profile } = useProfile();
  const tempUnit = resolveTempUnit(profile?.tempUnit, profile?.location);
  const stylingLocation = useActiveStylingLocation();
  const [conversationLocationContext, setConversationLocationContext] = useState<StylingLocationContext | null>(
    initialDestination ? conversationLocation(initialDestination) : null,
  );
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const activeLocation = conversationLocationContext ?? stylingLocation.activeLocation;
  const weather = useStylingWeatherToday(activeLocation);
  const createOutfit = useCreateOutfit();
  const assignEventItems = useAssignEventItems();
  const acceptEventPlan = useAcceptEventOutfitPlan();
  // When the chat was launched from a calendar event, suggested looks can be
  // assigned straight back onto that event (in addition to "Save this look").
  const onAddToEvent = useMemo(
    () =>
      eventContext
        ? async (itemIds: number[], eventPlan?: StylistEventPlanData | null) => {
            if (eventPlan?.candidateId) {
              const result = await acceptEventPlan.mutateAsync({
                eventId: eventContext.id,
                candidateId: eventPlan.candidateId,
              });
              return { outfitId: result.outfit.id };
            }
            const outfit = await createOutfit.mutateAsync({
              name: `${eventContext.title} Look`,
              description: null,
              event: eventContext.title,
              itemIds: itemIds
                .map((id) => allItems.find((item) => item.id === id))
                .filter((item): item is Item => !!item)
                .map((item) => ({ id: item.id, category: item.category ?? 'other' })),
            });
            await assignEventItems.mutateAsync({ id: eventContext.id, itemIds, outfitId: outfit.id });
            return { outfitId: outfit.id };
          }
        : undefined,
    [acceptEventPlan, allItems, assignEventItems, createOutfit, eventContext],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  // Active server thread. null means "unsaved draft" — the next send lazily
  // creates a thread server-side and returns its id in the `done` event.
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [showNewSessionConfirm, setShowNewSessionConfirm] = useState(false);
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [wardrobePickerVisible, setWardrobePickerVisible] = useState(false);
  const [boardTarget, setBoardTarget] = useState<BoardEntryRef | null>(null);
  const [composerAttachment, setComposerAttachment] = useState<ComposerAttachment | null>(null);
  const [composerPhotoData, setComposerPhotoData] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedRequest, setFailedRequest] = useState<SendOptions | null>(null);
  const [followUpsOpen, setFollowUpsOpen] = useState(false);
  const [intakeKind, setIntakeKind] = useState<Exclude<StylistWorkflow['kind'], 'wardrobe_audit'> | null>(null);
  const [intakeInitialItemId, setIntakeInitialItemId] = useState<number | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const messageLayoutsRef = useRef<Record<string, number>>({});
  const pendingFocusMessageIdRef = useRef<string | null>(null);
  const focusedRichMessageIdRef = useRef<string | null>(null);
  const player = useAudioPlayer(null);
  const playingFileRef = useRef<File | null>(null);
  const lastPromptRequestIdRef = useRef(0);
  const lastOpenRequestIdRef = useRef(0);
  // Mirror of `messages` so sendMessage can read the latest history without being
  // re-created on every message, and so a thread reset takes effect synchronously.
  const messagesRef = useRef<ChatMessage[]>([]);
  // Mirror of `conversationId` for synchronous reads: a topical "new" open resets
  // the thread and immediately fires the initial query, so the send must see the
  // cleared id rather than the previous render's value.
  const conversationIdRef = useRef<number | null>(null);
  const tripOutfitsRef = useRef<Record<string, StylistTripPlanData['outfits']>>({});
  const transportRequestMetaRef = useRef<Record<string, { userMessageId: string }>>({});

  const setActiveConversationId = useCallback((id: number | null) => {
    conversationIdRef.current = id;
    setConversationId(id);
  }, []);

  // Cache the active thread's recent tail for instant resume + offline reads.
  const cacheThread = useCallback((id: number | null, msgs: ChatMessage[]) => {
    if (id == null) return;
    AsyncStorage.multiSet([
      [threadKey(id), JSON.stringify(msgs.slice(-6))],
      [ACTIVE_THREAD_KEY, String(id)],
    ]).catch(() => {});
  }, []);

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

  // Keep the history mirror in sync with rendered messages.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToMessageStart = useCallback((messageId: string, animated = true) => {
    const y = messageLayoutsRef.current[messageId];
    if (typeof y !== 'number') return false;
    scrollRef.current?.scrollTo({ y: Math.max(y - spacing.md, 0), animated });
    return true;
  }, []);

  function stopCurrentAudio() {
    onDeviceSpeech.stop();
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

    // On-device speech is the default: it's free, instant, and works offline.
    // The server round-trip below only runs on a build where expo-speech's
    // native module isn't linked yet (isAvailable() proves that with a real
    // bridge call, not just a successful import) — see src/lib/speech.ts.
    if (await onDeviceSpeech.isAvailable()) {
      setPlayingId(messageId);
      // Functional updates below: onDone/onError fire later and must not
      // clear a DIFFERENT message's playingId if the user tapped another
      // speaker icon in the meantime.
      onDeviceSpeech.speak(text, {
        onDone: () => setPlayingId((id) => (id === messageId ? null : id)),
        onError: () => setPlayingId((id) => (id === messageId ? null : id)),
      });
      return;
    }

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

  const {
    isLoading,
    sendMessage: sendTransportMessage,
    abortCurrent: abortTransport,
  } = useStylistTransport({
    onAssistantStart: (assistantId) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === assistantId)) return prev;
        return [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            kind: 'assistant',
            renderType: 'text',
            text: '',
            isStreaming: true,
          },
        ];
      });
    },
    onAssistantToken: (assistantId, token) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + token } : m)),
      );
    },
    onAssistantDone: (assistantId, event) => {
      const {
        responseText,
        itemIds,
        lookName,
        eventPlan,
        missingEssentials: mes,
        missingEssential: legacyMe,
        shopOutfit,
        tripPlan,
        wardrobeAudit,
        mode: respMode,
        recId,
        conversationId: doneConversationId,
        boardAction,
      } = event;

      const resolvedConvId = typeof doneConversationId === 'number' ? doneConversationId : conversationIdRef.current;
      if (resolvedConvId != null && resolvedConvId !== conversationIdRef.current) {
        setActiveConversationId(resolvedConvId);
      }

      const hydratedEssentials: MissingEssential[] =
        Array.isArray(mes) && mes.length > 0
          ? mes
          : legacyMe && typeof legacyMe === 'object' && legacyMe.label
            ? [{ ...legacyMe, context: '', priority: 1 }]
            : [];

      const finalMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        kind: 'assistant',
        renderType: wardrobeAudit
          ? 'wardrobe_audit'
          : tripPlan
          ? 'trip_plan'
          : eventPlan
            ? 'closet_outfit'
          : shopOutfit
            ? 'shopping_outfit'
            : respMode === 'advice'
              ? 'advice'
              : itemIds?.length
                ? 'closet_outfit'
                : 'text',
        text: responseText ?? '',
        isStreaming: false,
        ...(respMode ? { mode: respMode } : {}),
        ...(shopOutfit ? { shopOutfit } : {}),
        ...(tripPlan ? { tripPlan: { ...tripPlan, pending: false } } : {}),
        ...(wardrobeAudit ? { wardrobeAudit } : {}),
        ...(eventPlan ? { eventPlan } : {}),
        ...(itemIds?.length && boardAction !== 'complete' && boardAction !== 'theme' ? { suggestedItemIds: itemIds } : {}),
        ...(lookName ? { lookName } : {}),
        ...(hydratedEssentials.length ? { missingEssentials: hydratedEssentials } : {}),
        ...(typeof recId === 'number' ? { recId } : {}),
        ...(boardAction ? { boardAction } : {}),
      };

      setMessages((prev) => {
        const withTranscript = prev.map((m) =>
          m.id === transportRequestMetaRef.current[assistantId]?.userMessageId && m.role === 'user'
            ? { ...m, transcript: event.transcript || m.text }
            : m,
        );
        const hasAssistant = withTranscript.some((m) => m.id === assistantId);
        const next = hasAssistant
          ? withTranscript.map((m) => (m.id === assistantId ? { ...finalMsg, text: finalMsg.text || m.text } : m))
          : [...withTranscript, finalMsg];
        messagesRef.current = next;
        cacheThread(resolvedConvId, next);
        return next;
      });

      delete tripOutfitsRef.current[assistantId];
      delete transportRequestMetaRef.current[assistantId];
    },
    onTripOutfit: (assistantId, outfit) => {
      const snapshot = [...(tripOutfitsRef.current[assistantId] ?? []), outfit];
      tripOutfitsRef.current[assistantId] = snapshot;
      setMessages((prev) =>
        prev.map((m): ChatMessage =>
          m.id === assistantId && m.role === 'assistant'
            ? {
                ...m,
                kind: 'assistant',
                renderType: 'trip_plan',
                mode: 'trip',
                tripPlan: { intro: m.text, outfits: snapshot, packingList: [], pending: true },
              }
            : m,
        ),
      );
    },
    onConversationResolved: (resolvedConversationId) => {
      if (resolvedConversationId !== conversationIdRef.current) {
        setActiveConversationId(resolvedConversationId);
      }
    },
    onError: ({ message, request }) => {
      setErrorMessage(message);
      setFailedRequest(request.originalOptions ?? null);
      setMessages((prev) =>
        prev.filter((m) => m.id !== request.userMessageId && m.id !== request.assistantMessageId),
      );
      delete tripOutfitsRef.current[request.assistantMessageId];
      delete transportRequestMetaRef.current[request.assistantMessageId];
    },
  });

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (opts: SendOptions) => {
      const { text, displayText, photoData, attachment, context, mode, workflow } = opts;
      if (!text && !photoData && !workflow) return;
      if (isLoading) return;

      track('stylist_message_sent', {
        input_type: photoData ? 'photo' : 'text',
        ...(workflow ? { workflow_kind: workflow.kind } : {}),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      setErrorMessage(null);
      setFailedRequest(null);

      const userMsg: ChatMessage = {
        id: makeId(),
        role: 'user',
        kind: 'user',
        renderType: 'text',
        text: displayText ?? text ?? 'Styling brief',
        ...(attachment ? { attachment } : {}),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
      setMentionQuery(null);

      const assistantId = makeId();
      transportRequestMetaRef.current[assistantId] = { userMessageId: userMsg.id };
      tripOutfitsRef.current[assistantId] = [];

      const history = buildHistory(messagesRef.current);
      const lastAssistant = [...messagesRef.current]
        .reverse()
        .find((message): message is Extract<ChatMessage, { role: 'assistant' }> => message.role === 'assistant');
      const continuationMode = !workflow && !mode ? lastAssistant?.mode : undefined;
      const continuationItemIds = lastAssistant
        ? Array.from(new Set([
            ...(lastAssistant.suggestedItemIds ?? []),
            ...(lastAssistant.tripPlan?.outfits.flatMap((outfit) => outfit.itemIds) ?? []),
            ...(lastAssistant.wardrobeAudit?.workhorses.map((entry) => entry.itemId) ?? []),
            ...(lastAssistant.wardrobeAudit?.underused.map((entry) => entry.itemId) ?? []),
          ])).slice(0, 12)
        : [];

      let weatherSummary: string | undefined;
      if (weather.data) {
        const tempStr = tempUnit === 'C'
          ? `${weather.data.current.temperatureC}°C`
          : `${weather.data.current.temperatureF}°F`;
        weatherSummary = `${weather.data.current.summary} ${tempStr}`;
      }

      const occasionHint = text ? detectOccasionHint(text) : undefined;
      const requestContext = context ?? entryContext;
      const locationSource = activeLocation.source === 'destination' ? 'conversation' : activeLocation.source;
      const request: StylistAskRequest = {
        ...(text ? { text } : {}),
        ...(workflow ? { workflow } : {}),
        ...(continuationMode ? { continuationMode } : {}),
        ...(continuationItemIds.length ? { continuationItemIds } : {}),
        ...deviceTimeContext(),
        ...(photoData ? { photoData } : {}),
        tempUnit,
        ...(weatherSummary ? { weatherSummary } : {}),
        ...((activeLocation.label || activeLocation.coords) ? {
          locationContext: {
            source: locationSource,
            ...(activeLocation.label ? { label: activeLocation.label } : {}),
            ...(activeLocation.coords ? { coords: activeLocation.coords } : {}),
          },
        } : {}),
        ...(occasionHint ? { occasionHint } : {}),
        ...(conversationIdRef.current ? { conversationId: conversationIdRef.current } : {}),
        ...(source ? { source } : {}),
        ...(requestContext ? { context: requestContext } : {}),
        ...(mode ? { mode } : {}),
        history,
      };

      void sendTransportMessage({
        request,
        assistantMessageId: assistantId,
        userMessageId: userMsg.id,
        originalOptions: opts,
      });
    },
    [activeLocation, entryContext, isLoading, tempUnit, sendTransportMessage, source, weather.data],
  );

  // ── Thread lifecycle ─────────────────────────────────────────────────────────

  function startFreshThread() {
    stopCurrentAudio();
    abortTransport();
    messagesRef.current = [];
    tripOutfitsRef.current = {};
    transportRequestMetaRef.current = {};
    setMessages([]);
    setActiveConversationId(null);
    setInputText('');
    setMentionQuery(null);
    setComposerAttachment(null);
    setComposerPhotoData(null);
    setErrorMessage(null);
    setFailedRequest(null);
    setIntakeKind(null);
    setIntakeInitialItemId(null);
  }

  function applyServerThread(id: number, rows: ServerMessage[]) {
    const msgs = mapServerMessages(rows);
    messagesRef.current = msgs;
    setMessages(msgs);
    setActiveConversationId(id);
  }

  async function loadThreadFromCache(id: number): Promise<boolean> {
    try {
      const cached = await AsyncStorage.getItem(threadKey(id));
      if (!cached) return false;
      const parsedMsgs: ChatMessage[] = JSON.parse(cached);
      const normalizedMsgs = parsedMsgs.map(normalizeChatMessage);
      messagesRef.current = normalizedMsgs;
      setMessages(normalizedMsgs);
      setActiveConversationId(id);
      return true;
    } catch {
      return false;
    }
  }

  // Resume the most-recent thread (center-tab open). Server is source of truth;
  // fall back to the offline cache, then to a one-time legacy-cache migration.
  async function resumeActiveThread() {
    try {
      const activeId = await AsyncStorage.getItem(ACTIVE_THREAD_KEY);
      if (activeId) {
        const id = Number(activeId);
        if (Number.isInteger(id) && id > 0) {
          try {
            const { data } = await api.get<{ messages: ServerMessage[] }>(`/api/stylist/conversations/${id}`);
            applyServerThread(id, data.messages ?? []);
            return;
          } catch {
            if (await loadThreadFromCache(id)) return;
          }
        }
      }
      // Legacy migration: surface the old single-session cache once as a draft.
      // The next send creates a real server thread; then drop the legacy key.
      const legacy = await AsyncStorage.getItem(LEGACY_SESSION_KEY);
      if (legacy) {
        try {
          const legacyMsgs: ChatMessage[] = JSON.parse(legacy);
          if (Array.isArray(legacyMsgs) && legacyMsgs.length > 0) {
            const tail = legacyMsgs.slice(-6).map(normalizeChatMessage);
            messagesRef.current = tail;
            setMessages(tail);
            setActiveConversationId(null);
          }
        } catch { /* ignore corrupt data */ }
        AsyncStorage.removeItem(LEGACY_SESSION_KEY).catch(() => {});
      }
    } catch { /* ignore */ }
  }

  async function loadConversations() {
    setConversationsLoading(true);
    try {
      const { data } = await api.get<Conversation[]>('/api/stylist/conversations');
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      // Offline or transient — keep whatever list we already have.
    } finally {
      setConversationsLoading(false);
    }
  }

  function openDrawer() {
    setDrawerOpen(true);
    loadConversations();
  }

  async function selectConversation(id: number) {
    setDrawerOpen(false);
    if (id === conversationIdRef.current) return;
    stopCurrentAudio();
    abortTransport();
    try {
      const { data } = await api.get<{ messages: ServerMessage[] }>(`/api/stylist/conversations/${id}`);
      applyServerThread(id, data.messages ?? []);
      AsyncStorage.setItem(ACTIVE_THREAD_KEY, String(id)).catch(() => {});
    } catch {
      if (await loadThreadFromCache(id)) {
        AsyncStorage.setItem(ACTIVE_THREAD_KEY, String(id)).catch(() => {});
      } else {
        Alert.alert('Offline', "Can't load that conversation right now. Try again when you're back online.");
      }
    }
  }

  async function deleteConversation(id: number) {
    // Optimistic: drop it from the list immediately, reconcile on failure.
    setConversations((prev) => prev.filter((c) => c.id !== id));
    AsyncStorage.removeItem(threadKey(id)).catch(() => {});
    try {
      await api.delete(`/api/stylist/conversations/${id}`);
    } catch {
      Alert.alert('Could not delete', "Please try again when you're back online.");
      loadConversations();
      return;
    }
    // If we just deleted the thread on screen, fall back to a fresh draft.
    if (id === conversationIdRef.current) startNewConversation();
  }

  async function renameConversation(id: number, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)));
    try {
      await api.patch(`/api/stylist/conversations/${id}`, { title: trimmed });
    } catch {
      Alert.alert('Could not rename', "Please try again when you're back online.");
      loadConversations();
    }
  }

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    setConversationLocationContext(initialDestination ? conversationLocation(initialDestination) : null);
  }, [initialDestination]);

  // Apply the open intent each time the stylist is opened. The view stays mounted
  // inside the always-rendered modal, so this runs off an incrementing request id
  // rather than on mount. Declared before the initial-query effect so a topical
  // "new" reset clears history synchronously before that query is sent.
  useEffect(() => {
    if (openRequestId <= lastOpenRequestIdRef.current) return;
    lastOpenRequestIdRef.current = openRequestId;
    if (threadMode === 'new') {
      startFreshThread();
    } else {
      resumeActiveThread();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequestId, threadMode]);

  useEffect(() => {
    if (initialQuery && !isLoading && promptRequestId > lastPromptRequestIdRef.current) {
      let cancelled = false;
      const sendInitialMessage = async () => {
        let preparedPhoto: Awaited<ReturnType<typeof prepareStylistPhoto>> | undefined;
        if (initialAttachmentUri) {
          try {
            preparedPhoto = await prepareStylistPhoto(initialAttachmentUri);
          } catch {
            // The metadata context and question are still useful without the photo.
          }
        }
        if (cancelled || promptRequestId <= lastPromptRequestIdRef.current) return;
        lastPromptRequestIdRef.current = promptRequestId;
        sendMessage(buildInitialStylistSendOptions({
          text: initialQuery,
          mode: initialMode,
          attachmentUri: initialAttachmentUri,
          photoData: preparedPhoto?.dataUrl,
        }));
        onPromptConsumed?.();
      };
      void sendInitialMessage();
      return () => { cancelled = true; };
    }
  }, [initialAttachmentUri, initialMode, initialQuery, isLoading, onPromptConsumed, promptRequestId, sendMessage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (messages.length === 0 && !isLoading) {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        return;
      }
      const lastMessage = messages[messages.length - 1];
      if (isRichAssistantMessage(lastMessage) && !isLoading) {
        if (focusedRichMessageIdRef.current !== lastMessage.id) {
          focusedRichMessageIdRef.current = lastMessage.id;
          pendingFocusMessageIdRef.current = lastMessage.id;
          if (scrollToMessageStart(lastMessage.id)) pendingFocusMessageIdRef.current = null;
        }
        return;
      }
      pendingFocusMessageIdRef.current = null;
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isLoading, scrollToMessageStart]);

  useEffect(() => {
    return () => { stopCurrentAudio(); };
  }, []);

  // ── Input handlers ─────────────────────────────────────────────────────────

  async function stagePhoto(source: 'camera' | 'library') {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera access needed', 'Allow camera access to show your stylist what you are wearing.');
          return;
        }
      }
      const result = await (source === 'camera'
        ? ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      }));
      if (result.canceled || !result.assets[0]) return;
      const compressed = await compressImageToDataUrl(result.assets[0]);
      setComposerAttachment({ type: 'photo', label: 'Photo', uri: result.assets[0].uri });
      setComposerPhotoData(compressed.dataUrl);
      setAttachmentSheetVisible(false);
    } catch {
      Alert.alert('Could not load photo', 'Please try again.');
    }
  }

  function handleSendText() {
    const trimmed = inputText.trim();
    if (!trimmed && !composerAttachment) return;
    const attachmentText = composerAttachment?.type === 'item'
      ? `@${composerAttachment.label}${trimmed ? ` ${trimmed}` : ''}`
      : trimmed || 'What do you think of this look?';
    sendMessage({
      text: attachmentText,
      displayText: trimmed || (composerAttachment?.type === 'photo' ? 'What do you think of this look?' : 'How would you style this?'),
      ...(composerPhotoData ? { photoData: composerPhotoData } : {}),
      ...(composerAttachment ? { attachment: composerAttachment } : {}),
    });
    setComposerAttachment(null);
    setComposerPhotoData(null);
  }

  function stopGeneration() {
    abortTransport();
    setMessages((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)));
    Haptics.selectionAsync().catch(() => {});
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
    const uri = itemImageUri(item);
    const lastAt = inputText.lastIndexOf('@');
    setInputText(lastAt >= 0 ? inputText.slice(0, lastAt) : inputText);
    setComposerAttachment({ type: 'item', label: item.name, uri, itemId: item.id });
    setMentionQuery(null);
  }

  function openStarterWorkflow(kind: StylistWorkflow['kind']) {
    track('stylist_starter_opened', { workflow_kind: kind });
    if (kind === 'wardrobe_audit') {
      const workflow: StylistWorkflow = { kind };
      sendMessage({
        workflow,
        displayText: summarizeStylistWorkflow(workflow, allItems),
      });
      return;
    }
    setIntakeInitialItemId(null);
    setIntakeKind(kind);
  }

  function submitStarterWorkflow(workflow: StylistWorkflow) {
    const stylesByValue = Object.fromEntries(STYLE_OPTIONS.map((option) => [option.value, option.label]));
    const budgetsByValue = Object.fromEntries(BUDGET_OPTIONS.map((option) => [option.value, option.label]));
    const lifestylesByValue = Object.fromEntries(OCCASION_OPTIONS.map((option) => [option.value, option.label]));
    const displayText = summarizeStylistWorkflow(workflow, allItems, {
      styles: stylesByValue,
      budgets: budgetsByValue,
      lifestyles: lifestylesByValue,
    });
    if (workflow.kind === 'trip') {
      setConversationLocationContext(conversationLocation(workflow.destination));
    }
    setIntakeKind(null);
    setIntakeInitialItemId(null);
    track('stylist_starter_submitted', { workflow_kind: workflow.kind });
    sendMessage({ workflow, displayText });
  }

  function openAuditItemStyling(itemId: number) {
    setIntakeInitialItemId(itemId);
    setIntakeKind('style_piece');
  }

  function startNewConversation() {
    startFreshThread();
    setConversationLocationContext(null);
    // Clear the active pointer so a fresh draft is shown until the next send
    // creates a new server thread. The previous thread stays saved in history.
    AsyncStorage.removeItem(ACTIVE_THREAD_KEY).catch(() => {});
    Haptics.selectionAsync().catch(() => {});
  }

  function confirmNewConversation() {
    if (messages.length === 0) {
      startNewConversation();
      return;
    }
    setShowNewSessionConfirm(true);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isEmpty = messages.length === 0 && !isLoading && !errorMessage;
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
        style={[styles.header, { paddingTop: embedded ? insets.top + spacing.xs : insets.top }]}
        {...(Platform.OS === 'android' && { blurMethod: 'dimezisBlurViewSdk31Plus' })}
      >
        <View style={styles.headerIdentity}>
          <Text style={styles.headerTitle}>Your Stylist</Text>
          <TouchableOpacity
            style={styles.headerContextPill}
            onPress={() => setLocationPickerVisible(true)}
            activeOpacity={0.75}
            accessibilityLabel={`Styling location: ${activeLocation.label || 'not set'}`}
          >
            <Ionicons name="location-outline" size={12} color={colors.primary} />
            <Text style={styles.headerSubtitle} numberOfLines={1}>{activeLocation.label || 'Set location'}</Text>
            {weather.data?.current ? (
              <Text style={styles.headerWeather}>
                {tempUnit === 'C' ? `${weather.data.current.temperatureC}°` : `${weather.data.current.temperatureF}°`}
              </Text>
            ) : null}
          </TouchableOpacity>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={openDrawer}
            accessibilityLabel="Conversation history"
          >
            <Ionicons name="time-outline" size={21} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={confirmNewConversation}
            accessibilityLabel="New styling session"
          >
            <Ionicons name="create-outline" size={21} color={colors.foreground} />
          </TouchableOpacity>
          {onClose && !embedded ? (
            <TouchableOpacity style={styles.doneBtn} onPress={onClose} accessibilityLabel="Done with stylist">
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </BlurView>

      <ConversationDrawer
        visible={drawerOpen}
        conversations={conversations}
        loading={conversationsLoading}
        activeId={conversationId}
        onSelect={selectConversation}
        onDelete={deleteConversation}
        onRename={renameConversation}
        onNew={() => {
          setDrawerOpen(false);
          startNewConversation();
        }}
        onClose={() => setDrawerOpen(false)}
      />

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
            tempUnit={tempUnit}
            displayName={profile?.displayName}
            wardrobeCount={allItems.length}
            onPrompt={(q) => sendMessage({ text: q, mode: 'from_closet' })}
            onWorkflow={openStarterWorkflow}
          />
        ) : (
          <>
            {messages.map((msg) => (
              <View
                key={msg.id}
                onLayout={(event) => {
                  messageLayoutsRef.current[msg.id] = event.nativeEvent.layout.y;
                  if (pendingFocusMessageIdRef.current === msg.id && scrollToMessageStart(msg.id)) {
                    pendingFocusMessageIdRef.current = null;
                  }
                }}
              >
                <MessageBubble
                  message={msg}
                  allItems={allItems}
                  isPlaying={playingId === msg.id}
                  createOutfit={createOutfit}
                  eventContext={eventContext}
                  onAddToEvent={onAddToEvent}
                  onNavigateToShop={onNavigateToShop}
                  onNavigateToCloset={onNavigateToCloset}
                  onStyleAuditItem={openAuditItemStyling}
                  onSaveToBoard={setBoardTarget}
                  onToggleAudio={
                    msg.role === 'assistant' && !msg.isStreaming
                      ? () =>
                          playingId === msg.id
                            ? stopCurrentAudio()
                            : playTts(msg.id, msg.text)
                      : undefined
                  }
                />
              </View>
            ))}
            {isLoading && !messages.some((m) => m.isStreaming) && <TypingIndicator />}
            {errorMessage ? (
              <View style={styles.inlineError} accessibilityRole="alert">
                <View style={styles.inlineErrorCopy}>
                  <Ionicons name="cloud-offline-outline" size={18} color={colors.error} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inlineErrorTitle}>That look did not come through</Text>
                    <Text style={styles.inlineErrorText} numberOfLines={2}>{errorMessage}</Text>
                  </View>
                </View>
                {failedRequest ? (
                  <TouchableOpacity style={styles.retryBtn} onPress={() => sendMessage(failedRequest)}>
                    <Text style={styles.retryBtnText}>Try again</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
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

      <StylistIntakeSheet
        visible={intakeKind !== null}
        kind={intakeKind}
        items={allItems}
        profile={profile}
        initialItemId={intakeInitialItemId}
        onClose={() => {
          if (intakeKind) track('stylist_starter_cancelled', { workflow_kind: intakeKind });
          setIntakeKind(null);
          setIntakeInitialItemId(null);
        }}
        onSubmit={submitStarterWorkflow}
      />

      <BlurView
        intensity={42}
        tint="systemThinMaterialLight"
        style={[styles.bottomDock, { paddingBottom: embedded ? spacing.sm : insets.bottom + spacing.sm }]}
        {...(Platform.OS === 'android' && { blurMethod: 'dimezisBlurViewSdk31Plus' })}
      >
        {/* Follow-up chips */}
        {messages.length > 0 && !isLoading && (
          <View style={styles.chipsShell}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContent}
              keyboardShouldPersistTaps="handled"
            >
              {contextualChips.slice(0, 2).map((chip) => (
                <TouchableOpacity
                  key={chip}
                  style={styles.chip}
                  onPress={() => sendMessage({ text: chip })}
                  disabled={isLoading}
                >
                  <Text style={styles.chipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
              {contextualChips.length > 2 ? (
                <TouchableOpacity style={styles.moreChip} onPress={() => setFollowUpsOpen(true)} accessibilityLabel="More follow-up ideas">
                  <Ionicons name="add-circle-outline" size={17} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        )}

        {/* @ Mention menu — sits between chips and input bar */}
        {mentionQuery !== null && mentionItems.length > 0 && (
          <View style={styles.mentionMenu}>
            {mentionItems.map((item) => {
              const imgUri = itemImageUri(item);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.mentionRow}
                  onPress={() => handleMentionSelect(item)}
                >
                  <View style={styles.mentionThumb}>
                    {imgUri ? (
                      <Image source={{ uri: imgUri }} style={StyleSheet.absoluteFill} resizeMode={itemImageContentFit(item)} />
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
        <StylistComposer
          value={inputText}
          onChangeText={handleTextChange}
          onDictatedText={setInputText}
          onSend={handleSendText}
          onStopGeneration={stopGeneration}
          isLoading={isLoading}
          attachment={composerAttachment}
          onRemoveAttachment={() => { setComposerAttachment(null); setComposerPhotoData(null); }}
          onOpenAttachmentSheet={() => setAttachmentSheetVisible(true)}
        />
      </BlurView>

      <StylistOverlaySheet
        visible={attachmentSheetVisible}
        bottomInset={insets.bottom}
        onClose={() => setAttachmentSheetVisible(false)}
      >
        <Text style={styles.attachmentSheetTitle}>Add to your question</Text>
        <Text style={styles.attachmentSheetSubtitle}>Give your stylist something visual to work with.</Text>
        <View style={styles.attachmentChoices}>
          <AttachmentChoice icon="camera-outline" label="Camera" onPress={() => stagePhoto('camera')} />
          <AttachmentChoice icon="images-outline" label="Photo library" onPress={() => stagePhoto('library')} />
          <AttachmentChoice
            icon="shirt-outline"
            label="Wardrobe piece"
            onPress={() => { setAttachmentSheetVisible(false); setWardrobePickerVisible(true); }}
          />
        </View>
      </StylistOverlaySheet>

      {/* One picker for the whole thread — mounting per card would create a
          modal per message. A plain Modal, not SaveToBoardSheet: this view
          lives inside a fullscreen RN Modal that a bottom sheet renders behind. */}
      <BoardPickerModal
        visible={boardTarget != null}
        target={boardTarget}
        onClose={() => setBoardTarget(null)}
      />

      <ItemPickerSheet
        visible={wardrobePickerVisible}
        onClose={() => setWardrobePickerVisible(false)}
        title="Choose a wardrobe piece"
        items={allItems}
        selectedId={composerAttachment?.type === 'item' ? composerAttachment.itemId : undefined}
        onSelect={(item) => {
          setComposerAttachment({ type: 'item', label: item.name, itemId: item.id, uri: itemImageUri(item) });
          setComposerPhotoData(null);
          setWardrobePickerVisible(false);
        }}
      />

      <StylistOverlaySheet
        visible={followUpsOpen}
        bottomInset={insets.bottom}
        onClose={() => setFollowUpsOpen(false)}
      >
        <Text style={styles.attachmentSheetTitle}>Refine the edit</Text>
        <View style={styles.followUpList}>
          {contextualChips.map((chip) => (
            <TouchableOpacity key={chip} style={styles.followUpRow} onPress={() => { setFollowUpsOpen(false); sendMessage({ text: chip }); }}>
              <Text style={styles.followUpText}>{chip}</Text>
              <Ionicons name="arrow-forward" size={17} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      </StylistOverlaySheet>

      <Modal visible={showNewSessionConfirm} transparent animationType="fade" onRequestClose={() => setShowNewSessionConfirm(false)}>
        <Pressable style={styles.confirmOverlay} onPress={() => setShowNewSessionConfirm(false)}>
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <Text style={styles.confirmTitle}>Start a new styling session?</Text>
            <Text style={styles.confirmBody}>Your current conversation stays saved in History.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setShowNewSessionConfirm(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmPrimaryBtn}
                onPress={() => { setShowNewSessionConfirm(false); startNewConversation(); }}
              >
                <Text style={styles.confirmPrimaryText}>Start New</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function AttachmentChoice({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.attachmentChoice} onPress={onPress} accessibilityRole="button">
      <View style={styles.attachmentChoiceIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.attachmentChoiceLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

type BubbleProps = {
  message: ChatMessage;
  allItems: Item[];
  isPlaying: boolean;
  createOutfit: ReturnType<typeof useCreateOutfit>;
  eventContext?: EventContext;
  onAddToEvent?: (itemIds: number[], eventPlan?: StylistEventPlanData | null) => Promise<unknown>;
  onToggleAudio?: () => void;
  onNavigateToShop?: () => void;
  onNavigateToCloset?: (outfitId: number) => void;
  onStyleAuditItem?: (itemId: number) => void;
  onSaveToBoard?: (ref: BoardEntryRef) => void;
};

function MessageBubble({ message, allItems, isPlaying, createOutfit, eventContext, onAddToEvent, onToggleAudio, onNavigateToShop, onNavigateToCloset, onStyleAuditItem, onSaveToBoard }: BubbleProps) {
  const isUser = message.role === 'user';
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  // Bridges ShopOutfitCard's onSave (which mints the entry) to its onSaved
  // (which offers to board it) without widening the card's public contract.
  const savedWishlistIdRef = useRef<string | null>(null);

  if (!isUser && message.wardrobeAudit) {
    return (
      <EditorialEntrance>
        <View style={styles.editorialResponse}>
          <WardrobeAuditCard
            audit={message.wardrobeAudit}
            items={allItems}
            onStyleItem={onStyleAuditItem ?? (() => {})}
            onNavigateToShop={onNavigateToShop}
          />
        </View>
      </EditorialEntrance>
    );
  }

  // Trip plan — multi-outfit carousel + packing list (also renders progressively
  // while streaming, so check before the streaming-text fallback below).
  if (!isUser && message.tripPlan) {
    return (
      <EditorialEntrance>
        <View style={styles.editorialResponse}>
          <TripPlanCard
            plan={message.tripPlan}
            allItems={allItems}
            createOutfit={createOutfit}
            eventContext={eventContext}
            onAddToEvent={onAddToEvent}
          />
        </View>
      </EditorialEntrance>
    );
  }

  // Advice / wardrobe audit — rich text (allows bullets) plus any referenced
  // wardrobe thumbnails and gap chips. Never an editable outfit card.
  if (!isUser && message.mode === 'advice') {
    return (
      <EditorialEntrance>
        <View style={styles.stylistNote}>
          <View style={styles.sectionEyebrow}>
            <Ionicons name="sparkles" size={13} color={colors.primary} />
            <Text style={styles.sectionEyebrowText}>{message.boardAction === 'theme' ? 'Board direction' : message.boardAction === 'complete' ? 'Board edit' : 'My take'}</Text>
          </View>
          <StylistRichText text={message.text} streaming={message.isStreaming} />
          {!!message.suggestedItemIds?.length && (
            <View style={styles.responseSection}>
              <Text style={styles.responseSectionTitle}>Wear it with</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adviceThumbs}>
                {message.suggestedItemIds
                  .map((id) => allItems.find((i) => i.id === id))
                  .filter((i): i is Item => !!i)
                  .map((item) => {
                    const uri = itemImageUri(item);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.adviceThumb}
                        onPress={() => setDetailItem(item)}
                        activeOpacity={0.8}
                        accessibilityLabel={`View ${item.name} details`}
                      >
                        {uri ? (
                          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode={itemImageContentFit(item)} />
                        ) : (
                          <Ionicons name="shirt-outline" size={18} color={colors.mutedForeground} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </View>
          )}
          {!!message.missingEssentials?.length && (
            <View style={styles.responseSection}>
              <Text style={styles.responseSectionTitle}>Closet gaps</Text>
              {[...message.missingEssentials]
                .sort((a, b) => a.priority - b.priority)
                .map((item, i) => <GapCard key={i} item={item} onPress={onNavigateToShop} />)}
            </View>
          )}
          <ItemDetailSheet item={detailItem} onClose={() => setDetailItem(null)} />
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

  if (!isUser && message.suggestedItemIds?.length) {
    return (
      <EditorialEntrance>
        <View style={styles.editorialResponse}>
          <OutfitSuggestionCard
            messageText={message.text}
            lookName={message.lookName}
            itemIds={message.suggestedItemIds}
            allItems={allItems}
            createOutfit={createOutfit}
            eventContext={eventContext}
            onAddToEvent={onAddToEvent}
            eventPlan={message.eventPlan}
            recId={message.recId}
            isPlaying={isPlaying}
            onToggleAudio={onToggleAudio}
            onNavigateToCloset={onNavigateToCloset}
            onSaveToBoard={onSaveToBoard}
          />
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
            saveLabel={eventContext ? `Save ${message.shopOutfit.recommendationType === 'piece' ? 'piece' : message.shopOutfit.recommendationType === 'list' ? 'list' : 'look'} for ${eventContext.title}` : undefined}
            onSave={async () => {
              // addOutfitToWishlist mints the id client-side and POSTs it; only
              // offer to board the entry once the server has actually stored it,
              // or the board would reference an id the feed omits.
              const entry = await addOutfitToWishlist(message.shopOutfit!, eventContext);
              savedWishlistIdRef.current = entry.id;
              track('outfit_saved_to_wishlist', { forEvent: !!eventContext });
            }}
            onSaved={() => {
              const id = savedWishlistIdRef.current;
              if (id) onSaveToBoard?.({ type: 'wishlist', id });
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
        {message.attachment ? (
          <View style={styles.userAttachment}>
            {message.attachment.uri ? (
              <Image source={{ uri: message.attachment.uri }} style={styles.userAttachmentImage} resizeMode="cover" />
            ) : (
              <View style={styles.userAttachmentFallback}>
                <Ionicons name={message.attachment.type === 'photo' ? 'image-outline' : 'shirt-outline'} size={19} color={colors.primaryForeground} />
              </View>
            )}
            <Text style={styles.userAttachmentLabel} numberOfLines={1}>{message.attachment.label}</Text>
          </View>
        ) : null}
        <Text style={[styles.bubbleText, styles.bubbleTextUser]}>
          {message.text}{message.isStreaming ? '▍' : ''}
        </Text>
      </View>
    </View>
  );
}

function EditorialEntrance({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return <Reanimated.View entering={reduceMotion ? undefined : FadeInUp.duration(240)}>{children}</Reanimated.View>;
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

type OutfitCompleteLookOverviewProps = {
  items: Item[];
  onItemPress: (item: Item) => void;
  onSwapItem: (itemId: number) => void;
  onAddItem: () => void;
};

function categoryLabel(category: Item['category']): string {
  return category ? category.replace(/_/g, ' ') : 'piece';
}

function OutfitCompleteLookOverview({
  items,
  onItemPress,
  onSwapItem,
  onAddItem,
}: OutfitCompleteLookOverviewProps) {
  const overviewItems = useMemo(
    () =>
      items.map((item) => ({
        item,
        uri: itemImageUri(item),
        contentFit: itemImageContentFit(item),
      })),
    [items],
  );

  if (overviewItems.length === 0) return null;

  return (
    <View style={styles.lineSheet}>
      <Text style={[styles.rationaleLabel, styles.lineSheetLabel]}>Complete look</Text>

      {overviewItems.map(({ item, uri, contentFit }) => (
        <Pressable
          key={item.id}
          style={styles.lineSheetRow}
          onPress={() => onItemPress(item)}
          onLongPress={() => onSwapItem(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`View details for ${item.name}`}
        >
          <View style={styles.lineSheetThumb}>
            {uri ? (
              <ExpoImage
                source={{ uri }}
                style={styles.lineSheetThumbImage}
                contentFit={contentFit}
                transition={120}
                cachePolicy="memory-disk"
                recyclingKey={`overview-${item.id}`}
              />
            ) : (
              <Ionicons name="shirt-outline" size={16} color={colors.mutedForeground} />
            )}
          </View>
          <View style={styles.lineSheetCopy}>
            <Text style={styles.lineSheetCategory} numberOfLines={1}>
              {categoryLabel(item.category)}
            </Text>
            <Text style={styles.lineSheetName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <Pressable
            style={styles.lineSheetSwapBtn}
            onPress={() => onSwapItem(item.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Swap ${categoryLabel(item.category)}`}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.mutedForeground} />
          </Pressable>
        </Pressable>
      ))}

      <Pressable
        style={[styles.lineSheetRow, styles.lineSheetAddRow]}
        onPress={onAddItem}
        accessibilityRole="button"
        accessibilityLabel="Add an item from your wardrobe"
      >
        <View style={[styles.lineSheetThumb, styles.lineSheetAddThumb]}>
          <Ionicons name="add" size={18} color={colors.primary} />
        </View>
        <View style={styles.lineSheetCopy}>
          <Text style={styles.lineSheetCategory} numberOfLines={1}>
            Add a piece
          </Text>
          <Text style={styles.lineSheetName} numberOfLines={1}>
            From your wardrobe
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

type OutfitSuggestionCardProps = {
  messageText: string;
  lookName?: string;
  itemIds: number[];
  allItems: Item[];
  createOutfit: ReturnType<typeof useCreateOutfit>;
  eventContext?: EventContext;
  eventPlan?: StylistEventPlanData | null;
  onAddToEvent?: (itemIds: number[], eventPlan?: StylistEventPlanData | null) => Promise<unknown>;
  recId?: number;
  isPlaying?: boolean;
  onToggleAudio?: () => void;
  onNavigateToCloset?: (outfitId: number) => void;
  /** Offered only once the look exists in the closet — boards reference real outfit ids. */
  onSaveToBoard?: (ref: BoardEntryRef) => void;
};

function OutfitSuggestionCard({
  messageText,
  lookName,
  itemIds,
  allItems,
  createOutfit,
  eventContext,
  eventPlan,
  onAddToEvent,
  recId,
  isPlaying,
  onToggleAudio,
  onNavigateToCloset,
  onSaveToBoard,
}: OutfitSuggestionCardProps) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unsaving, setUnsaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savedOutfitId, setSavedOutfitId] = useState<number | null>(null);
  const [activeEventPlan, setActiveEventPlan] = useState<StylistEventPlanData | null>(eventPlan ?? null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  // When the user taps 👎 we reveal reason chips before finalizing — a labeled
  // rejection is a much stronger learning signal than a bare thumbs-down.
  const [choosingReason, setChoosingReason] = useState(false);

  // Local, editable copy of the suggested item set. Edits stay local until the
  // user taps "Save this look", which persists whatever set is current.
  const [editedIds, setEditedIds] = useState<number[]>(itemIds);
  // Reset when the underlying suggestion changes (keyed on a stable join).
  const itemIdsKey = itemIds.join(',');
  useEffect(() => {
    setEditedIds(itemIds);
    setActiveEventPlan(eventPlan ?? null);
    setAdded(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIdsKey, eventPlan]);

  const [picker, setPicker] = useState<'add' | { swapId: number } | null>(null);
  const generateEventPlan = useGenerateEventOutfitPlan();
  const deleteOutfit = useDeleteOutfit();
  const currentMessageText = activeEventPlan?.stylistNotes ?? messageText;
  const currentLookName = activeEventPlan?.outfitName ?? lookName;

  const matchedItems = useMemo(
    () => editedIds.map((id) => allItems.find((i) => i.id === id)).filter((i): i is Item => !!i),
    [editedIds, allItems],
  );
  const lookTitle = currentLookName?.trim() || outfitNameFromItems(matchedItems);

  // Hero collage: card spans the list width, so derive the collage size from the
  // window minus the list and card padding. At that size the collage renders in
  // its editorial matted mode. Category order puts the dominant tile on the top.
  const { width: windowWidth } = useWindowDimensions();
  const collageSize = windowWidth - spacing.md * 2 - spacing.md * 2;
  const collageSlots = useMemo(
    () =>
      [...matchedItems]
        .sort(
          (a, b) =>
            OUTFIT_CATEGORY_ORDER.indexOf(a.category ?? '') - OUTFIT_CATEGORY_ORDER.indexOf(b.category ?? ''),
        )
        .map((item) => ({
          key: String(item.id),
          uri: itemImageUri(item),
          contentFit: itemImageContentFit(item),
        })),
    [matchedItems],
  );
  // Event planning keeps one filled decision CTA; regeneration and saving for
  // later share the quiet utility row beneath it.
  const hasEventCta = !!(onAddToEvent && eventContext);

  // ── Edit handlers (clear the saved/added flags so the refined look can be re-saved) ──
  const swapItem = useCallback((oldId: number, newItem: Item) => {
    setEditedIds((ids) => ids.map((x) => (x === oldId ? newItem.id : x)));
    setSaved(false);
    setAdded(false);
  }, []);
  const addItem = useCallback((newItem: Item) => {
    setEditedIds((ids) => (ids.includes(newItem.id) ? ids : [...ids, newItem.id]));
    setSaved(false);
    setAdded(false);
  }, []);

  // ── Picker candidate pool ────────────────────────────────────────────────
  const swapTarget = picker && picker !== 'add'
    ? allItems.find((i) => i.id === picker.swapId) ?? null
    : null;
  const pickerItems = useMemo(() => {
    if (!picker) return [];
    if (picker === 'add') {
      return allItems.filter((i) => !editedIds.includes(i.id));
    }
    const targetCategory = swapTarget?.category ?? null;
    return allItems.filter(
      (i) => i.category === targetCategory && (i.id === picker.swapId || !editedIds.includes(i.id)),
    );
  }, [picker, allItems, editedIds, swapTarget]);
  const pickerTitle = picker === 'add'
    ? 'Add an item'
    : `Swap ${(swapTarget?.category ?? 'item').replace(/_/g, ' ')}`;

  function handlePickerSelect(item: Item) {
    if (picker === 'add') addItem(item);
    else if (picker) swapItem(picker.swapId, item);
  }

  function recordStylistFeedback(metadata: Omit<StylistFeedbackMetadata, 'itemIds'>) {
    api.post('/api/stylist/feedback', {
      itemIds: editedIds,
      source: 'outfit_card',
      ...(recId ? { recId } : {}),
      ...(eventContext?.id ? { eventId: eventContext.id } : {}),
      ...metadata,
    }).catch(() => {});
  }

  async function handleSave() {
    if (saved || saving || matchedItems.length === 0) return;
    setSaving(true);
    try {
      const input: CreateOutfitInput = {
        name: currentLookName?.trim() || outfitNameFromItems(matchedItems),
        description: currentMessageText.slice(0, 200) || null,
        itemIds: matchedItems.map((i) => ({ id: i.id, category: i.category as string })),
      };
      const outfit = await createOutfit.mutateAsync(input);
      setSavedOutfitId(outfit.id);
      setSaved(true);
      recordStylistFeedback({ rating: 'up', signal: 'saved' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // Error alert handled by the mutation
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveToggle() {
    if (!saved) {
      await handleSave();
      return;
    }
    if (unsaving || savedOutfitId == null) return;

    setUnsaving(true);
    try {
      await deleteOutfit.mutateAsync(savedOutfitId);
      setSaved(false);
      setSavedOutfitId(null);
      Haptics.selectionAsync().catch(() => {});
    } catch {
      // Error alert and optimistic cache rollback are handled by the mutation.
    } finally {
      setUnsaving(false);
    }
  }

  async function handleAddToEvent() {
    if (!onAddToEvent || added || adding || matchedItems.length === 0) return;
    setAdding(true);
    try {
      // Persist the refined set (editedIds), matching what feedback/save use.
      const ids = matchedItems.map((i) => i.id);
      const planIsUnedited = !!activeEventPlan
        && ids.length === activeEventPlan.itemIds.length
        && ids.every((id, index) => id === activeEventPlan.itemIds[index]);
      const result = await onAddToEvent(ids, planIsUnedited ? activeEventPlan : null);
      if (typeof result === 'object' && result !== null && 'outfitId' in result) {
        const outfitId = (result as { outfitId?: unknown }).outfitId;
        if (typeof outfitId === 'number') setSavedOutfitId(outfitId);
      }
      setAdded(true);
      recordStylistFeedback({ rating: 'up', signal: 'accepted_for_event' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // Error alert handled by the mutation
    } finally {
      setAdding(false);
    }
  }

  async function handleTryAnother() {
    if (!eventContext || generateEventPlan.isPending) return;
    try {
      const next = await generateEventPlan.mutateAsync({
        eventId: eventContext.id,
        ...(activeEventPlan?.candidateId ? { previousCandidateId: activeEventPlan.candidateId } : {}),
      });
      setActiveEventPlan(next);
      setEditedIds(next.itemIds);
      setSaved(false);
      setSavedOutfitId(null);
      setAdded(false);
      Haptics.selectionAsync().catch(() => {});
    } catch {
      // The mutation presents its own error alert.
    }
  }

  function handleFeedback(rating: 'up' | 'down') {
    if (feedback) return;
    if (rating === 'down') {
      // Don't finalize yet — let the user say why.
      setChoosingReason(true);
      return;
    }
    setFeedback('up');
    recordStylistFeedback({ rating: 'up', signal: 'up' });
  }

  function submitDownFeedback(reason?: StylistNegativeReason, reasonLabel?: string) {
    if (feedback) return;
    setFeedback('down');
    setChoosingReason(false);
    recordStylistFeedback({
      rating: 'down',
      ...(reason ? { reason } : {}),
      ...(reasonLabel ? { reasonLabel } : {}),
    });
  }

  return (
    <View style={styles.outfitCard}>
      <View style={styles.lookHeader}>
        <View style={styles.lookHeaderTop}>
          <View style={styles.sectionEyebrow}>
            <Ionicons name="sparkles" size={13} color={colors.primary} />
            <Text style={styles.sectionEyebrowText}>Styled for you</Text>
          </View>
          <View style={styles.headerCardActions}>
            {onToggleAudio ? (
              <TouchableOpacity
                style={[styles.headerIconBtn, isPlaying && styles.headerIconBtnActive]}
                onPress={onToggleAudio}
                accessibilityRole="button"
                accessibilityLabel="Read styling notes aloud"
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isPlaying ? 'pause-circle-outline' : 'volume-medium-outline'}
                  size={17}
                  color={isPlaying ? colors.primary : colors.mutedForeground}
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.headerIconBtn, feedback === 'up' && styles.headerIconBtnActive]}
              onPress={() => handleFeedback('up')}
              disabled={!!feedback}
              accessibilityRole="button"
              accessibilityLabel="This outfit works for me"
              activeOpacity={0.7}
            >
              <Ionicons
                name="thumbs-up-outline"
                size={15}
                color={feedback === 'up' ? colors.primary : colors.mutedForeground}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.headerIconBtn,
                (feedback === 'down' || choosingReason) && styles.headerIconBtnActive,
              ]}
              onPress={() => handleFeedback('down')}
              disabled={!!feedback}
              accessibilityRole="button"
              accessibilityLabel="This outfit doesn't work for me"
              activeOpacity={0.7}
            >
              <Ionicons
                name="thumbs-down-outline"
                size={15}
                color={feedback === 'down' || choosingReason ? colors.primary : colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.lookTitle} numberOfLines={2}>{lookTitle}</Text>
        <Text style={styles.lookMeta}>{matchedItems.length} pieces from your wardrobe</Text>
      </View>

      {collageSlots.length > 0 && (
        <ResolvedOutfitCollage
          slots={collageSlots}
          size={collageSize}
          height={Math.round(collageSize * 0.82)}
          borderRadius={radii.lg}
        />
      )}

      <View style={styles.stylistNoteBlock}>
        <Text style={styles.rationaleLabel}>Stylist's note</Text>
        <Text style={styles.outfitCardText}>{currentMessageText}</Text>
      </View>

      {matchedItems.length > 0 && (
        <OutfitCompleteLookOverview
          items={matchedItems}
          onItemPress={setSelectedItem}
          onSwapItem={(itemId) => setPicker({ swapId: itemId })}
          onAddItem={() => setPicker('add')}
        />
      )}

      {onAddToEvent && eventContext && (
        <View style={styles.eventActionGroup}>
          <TouchableOpacity
            style={[
              styles.addEventBtn,
              added && styles.addEventBtnDone,
              matchedItems.length === 0 && styles.saveBtnDisabled,
            ]}
            onPress={handleAddToEvent}
            disabled={added || adding || matchedItems.length === 0}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Add this outfit to ${eventContext.title}`}
          >
            <Ionicons
              name={added ? 'checkmark-circle' : 'calendar-outline'}
              size={16}
              color={colors.primaryForeground}
            />
            <Text style={styles.addEventBtnText} numberOfLines={1}>
              {adding ? 'Adding look…' : added ? 'Look added' : 'Use this look'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.eventActionMeta} numberOfLines={1}>
            {added ? 'On this event · Saved to Closet' : 'Assigns to this event · Saves to Closet'}
          </Text>
        </View>
      )}

      {hasEventCta && eventContext ? (
        <View style={styles.eventUtilityActions}>
          <TouchableOpacity
            style={styles.eventUtilityBtn}
            onPress={handleTryAnother}
            disabled={generateEventPlan.isPending || adding}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Try another outfit for ${eventContext.title}`}
          >
            <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
            <Text style={styles.eventUtilityText} numberOfLines={1}>
              {generateEventPlan.isPending ? 'Styling…' : 'Another look'}
            </Text>
          </TouchableOpacity>

          <View style={styles.eventUtilityDivider} />

          <TouchableOpacity
            style={styles.eventUtilityBtn}
            onPress={handleSaveToggle}
            disabled={added || saving || unsaving || matchedItems.length === 0}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={saved
              ? 'Remove this saved look from Closet'
              : 'Save this look to Closet without adding it to the event'}
            accessibilityState={{ selected: saved, busy: saving || unsaving }}
          >
            <Ionicons
              name={saved || added ? 'checkmark-circle' : 'bookmark-outline'}
              size={15}
              color={colors.primary}
            />
            <Text style={styles.eventUtilityText} numberOfLines={1}>
              {saving ? 'Saving…' : unsaving ? 'Removing…' : saved || added ? 'Saved' : 'Save for later'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.outfitCardActions}>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              (saved || saving) && styles.saveBtnDone,
              matchedItems.length === 0 && styles.saveBtnDisabled,
            ]}
            onPress={handleSaveToggle}
            disabled={saving || unsaving || matchedItems.length === 0}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove this saved outfit from Closet' : 'Save this outfit to Closet'}
            accessibilityState={{ selected: saved, busy: saving || unsaving }}
          >
            <Ionicons
              name={saved ? 'checkmark-circle' : 'bookmark-outline'}
              size={15}
              color={colors.white}
            />
            <Text style={styles.saveBtnText} numberOfLines={1}>
              {saving ? 'Saving…' : unsaving ? 'Removing…' : saved ? 'Saved to Closet → Outfits' : 'Save to Closet'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {savedOutfitId != null ? (
        <View style={styles.savedOutfitActions}>
          <TouchableOpacity
            style={styles.viewClosetBtn}
            onPress={() => onNavigateToCloset?.(savedOutfitId)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="View saved outfit in Closet"
          >
            <Text style={styles.viewClosetText}>View saved outfit</Text>
            <Ionicons name="arrow-forward-outline" size={15} color={colors.primary} />
          </TouchableOpacity>
          {onSaveToBoard && (
            <TouchableOpacity
              style={styles.viewClosetBtn}
              onPress={() => onSaveToBoard({ type: 'outfit', id: savedOutfitId })}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Save this outfit to a board"
            >
              <Ionicons name="albums-outline" size={15} color={colors.primary} />
              <Text style={styles.viewClosetText}>Save to board</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {choosingReason && !feedback && (
        <View style={styles.reasonChips}>
          {STYLIST_NEGATIVE_REASON_CHIPS.map((reason) => (
            <TouchableOpacity
              key={reason.value}
              style={styles.reasonChip}
              onPress={() => submitDownFeedback(reason.value, reason.label)}
              activeOpacity={0.7}
            >
              <Text style={styles.reasonChipText}>{reason.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.reasonChip}
            onPress={() => submitDownFeedback('just_not_it', 'Just not it')}
            activeOpacity={0.7}
          >
            <Text style={styles.reasonChipText}>Just not it</Text>
          </TouchableOpacity>
        </View>
      )}

      <ItemDetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />

      <ItemPickerSheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={pickerTitle}
        items={pickerItems}
        selectedId={picker && picker !== 'add' ? picker.swapId : undefined}
        onSelect={handlePickerSelect}
      />
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
  const imgUri = item ? itemImageUri(item) : null;
  const imageFit = itemImageContentFit(item);

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
                <Image source={{ uri: imgUri }} style={styles.sheetImage} resizeMode={imageFit} />
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

function EmptyState({
  weather,
  tempUnit,
  displayName,
  wardrobeCount,
  onPrompt,
  onWorkflow,
}: {
  weather: CurrentWeather | undefined;
  tempUnit: 'C' | 'F';
  displayName?: string | null;
  wardrobeCount: number;
  onPrompt: (q: string) => void;
  onWorkflow: (kind: StylistWorkflow['kind']) => void;
}) {
  const insets = useSafeAreaInsets();
  const [moreIdeasMounted, setMoreIdeasMounted] = useState(false);
  const moreIdeasSheetProgress = useSharedValue(0);
  const moreIdeasBackdropProgress = useSharedValue(0);
  const moreIdeasDragY = useSharedValue(0);
  const moreIdeasCompletionRef = useRef<(() => void) | undefined>(undefined);
  const firstName = displayName?.trim().split(/\s+/)[0];
  const todayPrompt = buildTodayPrompt(weather, tempUnit);
  const services = buildStylistStarters(wardrobeCount);
  const visibleStarters: Array<StylistStarter | { title: string; subtitle: string; prompt: string }> = [
    { title: 'Style me today', subtitle: todayPrompt, prompt: todayPrompt },
    ...services.slice(0, 2),
  ];
  const secondaryStarters = services.slice(2);

  const completeMoreIdeasDismiss = useCallback(() => {
    setMoreIdeasMounted(false);
    moreIdeasSheetProgress.value = 0;
    moreIdeasBackdropProgress.value = 0;
    moreIdeasDragY.value = 0;
    const afterClose = moreIdeasCompletionRef.current;
    moreIdeasCompletionRef.current = undefined;
    afterClose?.();
  }, [moreIdeasBackdropProgress, moreIdeasDragY, moreIdeasSheetProgress]);

  const dismissMoreIdeas = useCallback((afterClose?: () => void) => {
    moreIdeasCompletionRef.current = afterClose;
    moreIdeasSheetProgress.value = withTiming(0, { duration: 220 }, (finished) => {
      if (finished) runOnJS(completeMoreIdeasDismiss)();
    });
    moreIdeasBackdropProgress.value = withTiming(0, { duration: 180 });
    moreIdeasDragY.value = withTiming(0, { duration: 180 });
  }, [completeMoreIdeasDismiss, moreIdeasBackdropProgress, moreIdeasDragY, moreIdeasSheetProgress]);

  const dismissMoreIdeasByDrag = useCallback(() => {
    moreIdeasCompletionRef.current = undefined;
    moreIdeasDragY.value = withTiming(440, { duration: 220 }, (finished) => {
      if (finished) runOnJS(completeMoreIdeasDismiss)();
    });
    moreIdeasBackdropProgress.value = withTiming(0, { duration: 180 });
  }, [completeMoreIdeasDismiss, moreIdeasBackdropProgress, moreIdeasDragY]);

  const chooseStarter = (starter: StylistStarter | { title: string; subtitle: string; prompt: string }) => {
    Haptics.selectionAsync().catch(() => {});
    const run = () => {
      if ('prompt' in starter) onPrompt(starter.prompt);
      else onWorkflow(starter.workflowKind);
    };
    if (moreIdeasMounted) dismissMoreIdeas(run);
    else run();
  };

  useEffect(() => {
    if (!moreIdeasMounted) return;
    moreIdeasSheetProgress.value = 0;
    moreIdeasBackdropProgress.value = 0;
    moreIdeasDragY.value = 0;
    moreIdeasSheetProgress.value = withTiming(1, { duration: 260 });
    moreIdeasBackdropProgress.value = withTiming(1, { duration: 260 });
  }, [moreIdeasBackdropProgress, moreIdeasDragY, moreIdeasMounted, moreIdeasSheetProgress]);

  const moreIdeasSheetStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(moreIdeasSheetProgress.value, [0, 1], [420, 0]) + moreIdeasDragY.value,
    }],
  }));
  const moreIdeasBackdropStyle = useAnimatedStyle(() => ({ opacity: moreIdeasBackdropProgress.value }));

  const moreIdeasPanGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetY(8)
      .failOffsetX([-24, 24])
      .onUpdate((event) => {
        moreIdeasDragY.value = Math.max(0, event.translationY);
      })
      .onEnd((event) => {
        if (event.translationY > 72 || event.velocityY > 700) {
          runOnJS(dismissMoreIdeasByDrag)();
        } else {
          moreIdeasDragY.value = withSpring(0, { damping: 18, stiffness: 180 });
        }
      }),
    [dismissMoreIdeasByDrag, moreIdeasDragY],
  );

  return (
    <>
      <View style={styles.emptyState}>
        <View style={styles.emptyHero}>
          <Text style={styles.emptyTitle}>
            {firstName ? `What are we dressing for, ${firstName}?` : 'What are we dressing for?'}
          </Text>
          <Text style={styles.emptySubtitle}>
            Personal styling, grounded in your wardrobe and your day.
          </Text>
        </View>

        <View style={styles.promptList}>
          <Text style={styles.promptSectionLabel}>START WITH AN IDEA</Text>
          <View style={styles.starterRows}>
            {visibleStarters.map((starter) => (
              <StarterRow key={starter.title} starter={starter} onPress={() => chooseStarter(starter)} />
            ))}
          </View>
          <TouchableOpacity
            style={styles.moreIdeasButton}
            onPress={() => setMoreIdeasMounted(true)}
            accessibilityRole="button"
            accessibilityLabel="More styling ideas"
          >
            <Text style={styles.moreIdeasText}>More ideas</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={moreIdeasMounted} transparent animationType="none" onRequestClose={() => dismissMoreIdeas()}>
        <GestureHandlerRootView style={StyleSheet.absoluteFill}>
          <View style={styles.moreIdeasModal}>
          <Reanimated.View
            style={[styles.moreIdeasBackdrop, moreIdeasBackdropStyle]}
            pointerEvents="box-none"
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={() => dismissMoreIdeas()} />
          </Reanimated.View>
          <Reanimated.View
            style={[styles.moreIdeasSheet, { paddingBottom: insets.bottom + spacing.xl }, moreIdeasSheetStyle]}
            accessibilityViewIsModal
          >
            <GestureDetector gesture={moreIdeasPanGesture}>
              <Reanimated.View
                style={styles.moreIdeasDragRegion}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Drag down to close More Ideas"
              >
                <View style={styles.sheetGrabber} />
              </Reanimated.View>
            </GestureDetector>
            <Text style={styles.moreIdeasTitle}>More ways to style</Text>
            <Text style={styles.moreIdeasSubtitle}>Start with a broader wardrobe project.</Text>
            <View style={styles.moreIdeasRows}>
              {secondaryStarters.map((starter) => (
                <StarterRow key={starter.title} starter={starter} onPress={() => chooseStarter(starter)} />
              ))}
            </View>
          </Reanimated.View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

function StarterRow({ starter, onPress }: { starter: Pick<StylistStarter, 'title' | 'subtitle'>; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.starterRow}
      activeOpacity={0.65}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${starter.title}. ${starter.subtitle}`}
    >
      <View style={styles.starterCopy}>
        <Text style={styles.starterTitle}>{starter.title}</Text>
        <Text style={styles.starterSubtitle}>{starter.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

type StylistOverlaySheetProps = {
  visible: boolean;
  bottomInset: number;
  onClose: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
};

/**
 * Shared transparent sheet shell for Stylist overlays. The modal owns its
 * gesture root because React Native presents Modal content in a separate
 * native window from the screen that opened it.
 */
function StylistOverlaySheet({
  visible,
  bottomInset,
  onClose,
  children,
  sheetStyle,
}: StylistOverlaySheetProps) {
  const [mounted, setMounted] = useState(visible);
  const sheetProgress = useSharedValue(0);
  const backdropProgress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const closeNotifyRef = useRef(false);

  const finishClose = useCallback(() => {
    setMounted(false);
    sheetProgress.value = 0;
    backdropProgress.value = 0;
    dragY.value = 0;
    if (closeNotifyRef.current) {
      closeNotifyRef.current = false;
      onClose();
    }
  }, [backdropProgress, dragY, onClose, sheetProgress]);

  const animateClose = useCallback((notifyParent: boolean) => {
    closeNotifyRef.current = notifyParent;
    sheetProgress.value = withTiming(0, { duration: 220 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    backdropProgress.value = withTiming(0, { duration: 180 });
    dragY.value = withTiming(0, { duration: 180 });
  }, [backdropProgress, dragY, finishClose, sheetProgress]);

  useEffect(() => {
    if (visible) {
      closeNotifyRef.current = false;
      setMounted(true);
      sheetProgress.value = 0;
      backdropProgress.value = 0;
      dragY.value = 0;
      sheetProgress.value = withTiming(1, { duration: 260 });
      backdropProgress.value = withTiming(1, { duration: 260 });
    } else if (mounted) {
      animateClose(false);
    }
    // The controlled `visible` transition is the only event that should start
    // this animation; the animated values themselves update on the UI thread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismissByDrag = useCallback(() => {
    closeNotifyRef.current = true;
    dragY.value = withTiming(440, { duration: 220 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    backdropProgress.value = withTiming(0, { duration: 180 });
  }, [backdropProgress, dragY, finishClose]);

  const dragGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetY(8)
      .failOffsetX([-24, 24])
      .onUpdate((event) => {
        dragY.value = Math.max(0, event.translationY);
      })
      .onEnd((event) => {
        if (event.translationY > 72 || event.velocityY > 700) runOnJS(dismissByDrag)();
        else dragY.value = withSpring(0, { damping: 18, stiffness: 180 });
      }),
    [dismissByDrag, dragY],
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(sheetProgress.value, [0, 1], [440, 0]) + dragY.value,
    }],
  }));
  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: backdropProgress.value }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => animateClose(true)}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <View style={styles.stylistSheetModal}>
          <Reanimated.View style={[styles.stylistSheetBackdrop, backdropAnimatedStyle]} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFill} onPress={() => animateClose(true)} />
          </Reanimated.View>
          <Reanimated.View
            style={[styles.attachmentSheet, styles.stylistSheet, sheetStyle, { paddingBottom: bottomInset + spacing.lg }, sheetAnimatedStyle]}
          >
            <GestureDetector gesture={dragGesture}>
              <Reanimated.View
                style={styles.stylistSheetDragRegion}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Drag down to close sheet"
              >
                <View style={styles.sheetGrabber} />
              </Reanimated.View>
            </GestureDetector>
            {children}
          </Reanimated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
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

// ── ConversationDrawer ────────────────────────────────────────────────────────

// Bucket threads by the user's *local* day. `updatedAt` is a UTC ISO string, so we
// parse it to an absolute instant and compare against local midnight (setHours on a
// local Date) rather than diffing raw UTC — otherwise an 11pm-local thread can land
// in the wrong bucket.
function groupConversations(list: Conversation[]): { label: string; items: Conversation[] }[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const yesterdayMs = todayMs - 86_400_000;

  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const earlier: Conversation[] = [];
  for (const c of list) {
    const t = new Date(c.updatedAt).getTime();
    if (!Number.isNaN(t) && t >= todayMs) today.push(c);
    else if (!Number.isNaN(t) && t >= yesterdayMs) yesterday.push(c);
    else earlier.push(c);
  }

  const groups: { label: string; items: Conversation[] }[] = [];
  if (today.length) groups.push({ label: 'Today', items: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
  if (earlier.length) groups.push({ label: 'Earlier', items: earlier });
  return groups;
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onRename,
  onDelete,
  registerOpenRow,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: (id: number) => void;
  onRename: (c: Conversation) => void;
  onDelete: (c: Conversation) => void;
  registerOpenRow: (row: SwipeableMethods | null) => void;
}) {
  const swipeRef = useRef<SwipeableMethods>(null);
  const close = () => swipeRef.current?.close();

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={36}
      overshootRight={false}
      onSwipeableWillOpen={() => registerOpenRow(swipeRef.current)}
      renderRightActions={() => (
        <TouchableOpacity
          style={styles.drawerDeleteAction}
          onPress={() => {
            close();
            onDelete(conversation);
          }}
          accessibilityLabel="Delete conversation"
        >
          <Ionicons name="trash-outline" size={18} color={colors.white} />
          <Text style={styles.drawerDeleteText}>Delete</Text>
        </TouchableOpacity>
      )}
    >
      <TouchableOpacity
        style={[styles.drawerRow, active && styles.drawerRowActive]}
        onPress={() => onSelect(conversation.id)}
        onLongPress={() => {
          close();
          Haptics.selectionAsync().catch(() => {});
          onRename(conversation);
        }}
        delayLongPress={300}
      >
        <Ionicons
          name={active ? 'chatbubble-ellipses' : 'chatbubble-outline'}
          size={16}
          color={active ? colors.primary : colors.mutedForeground}
        />
        <View style={styles.drawerRowCopy}>
          <Text style={[styles.drawerRowTitle, active && styles.drawerRowTitleActive]} numberOfLines={1}>
            {conversation.title || 'Conversation'}
          </Text>
          {conversation.preview ? (
            <Text style={styles.drawerRowPreview} numberOfLines={1}>
              {conversation.preview}
            </Text>
          ) : null}
          <Text style={styles.drawerRowMeta}>{timeAgo(conversation.updatedAt)}</Text>
        </View>
      </TouchableOpacity>
    </ReanimatedSwipeable>
  );
}

function ConversationDrawer({
  visible,
  conversations,
  loading,
  activeId,
  onSelect,
  onDelete,
  onRename,
  onNew,
  onClose,
}: {
  visible: boolean;
  conversations: Conversation[];
  loading: boolean;
  activeId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onRename: (id: number, title: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, width * 0.82);
  const translateX = useRef(new Animated.Value(-panelWidth)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  // Track the currently-open swipe row so opening a second one closes the first.
  const openRowRef = useRef<SwipeableMethods | null>(null);
  const registerOpenRow = (row: SwipeableMethods | null) => {
    if (openRowRef.current && openRowRef.current !== row) openRowRef.current.close();
    openRowRef.current = row;
  };

  // Cross-platform rename: Alert.prompt is iOS-only, so use a small Modal + TextInput.
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [renameText, setRenameText] = useState('');
  const beginRename = (c: Conversation) => {
    setRenameText(c.title || '');
    setRenaming(c);
  };
  const commitRename = () => {
    if (renaming && renameText.trim()) onRename(renaming.id, renameText);
    setRenaming(null);
  };

  const confirmDelete = (c: Conversation) => {
    Alert.alert(
      'Delete conversation',
      `Delete "${c.title || 'this conversation'}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(c.id) },
      ],
    );
  };

  const groups = useMemo(() => groupConversations(conversations), [conversations]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -panelWidth, duration: 200, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible, panelWidth, translateX, backdrop]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.drawerBackdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close history" />
        </Animated.View>
        <Animated.View
          style={[
            styles.drawerPanel,
            {
              width: panelWidth,
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + spacing.md,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Conversations</Text>
            <TouchableOpacity style={styles.headerBtn} onPress={onClose} accessibilityLabel="Close history">
              <Ionicons name="close" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.drawerNewBtn} onPress={onNew}>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.drawerNewText}>New conversation</Text>
          </TouchableOpacity>

          {loading && conversations.length === 0 ? (
            <View style={styles.drawerEmpty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.drawerEmpty}>
              <Text style={styles.drawerEmptyText}>No saved conversations yet.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerList}>
              {groups.map((group) => (
                <View key={group.label} style={styles.drawerGroup}>
                  <Text style={styles.drawerGroupLabel}>{group.label}</Text>
                  {group.items.map((c) => (
                    <ConversationRow
                      key={c.id}
                      conversation={c}
                      active={c.id === activeId}
                      onSelect={onSelect}
                      onRename={beginRename}
                      onDelete={confirmDelete}
                      registerOpenRow={registerOpenRow}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </Animated.View>

        <Modal visible={renaming !== null} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
          <KeyboardAvoidingView
            style={styles.renameOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenaming(null)} />
            <View style={styles.renameCard}>
              <Text style={styles.renameTitle}>Rename conversation</Text>
              <TextInput
                style={styles.renameInput}
                value={renameText}
                onChangeText={setRenameText}
                placeholder="Conversation name"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={commitRename}
                maxLength={80}
              />
              <View style={styles.renameActions}>
                <TouchableOpacity style={styles.renameCancelBtn} onPress={() => setRenaming(null)}>
                  <Text style={styles.renameCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.renameSaveBtn, !renameText.trim() && styles.locationChoiceDisabled]}
                  onPress={commitRename}
                  disabled={!renameText.trim()}
                >
                  <Text style={styles.renameSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </GestureHandlerRootView>
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
    minHeight: 66,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontFamily: typography.family.display,
    fontSize: 24,
    lineHeight: 30,
    color: colors.foreground,
  },
  headerIdentity: { flex: 1, alignItems: 'flex-start', gap: spacing.xs },
  headerContextPill: {
    maxWidth: '96%',
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 0,
    borderRadius: radii.full,
    backgroundColor: 'transparent',
  },
  headerSubtitle: { flexShrink: 1, fontSize: 12, color: colors.mutedForeground },
  headerWeather: { fontSize: 12, color: colors.primary, fontWeight: typography.weight.semibold },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  doneBtn: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm },
  doneBtnText: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  // Conversation drawer
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.md,
    ...shadows.lg,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  drawerTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  drawerNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSelected,
    marginBottom: spacing.sm,
  },
  drawerNewText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
  drawerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  drawerEmptyText: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  drawerList: {
    paddingBottom: spacing.lg,
  },
  drawerGroup: {
    marginTop: spacing.sm,
  },
  drawerGroupLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    // Opaque so the swipe-revealed Delete action doesn't show through.
    backgroundColor: colors.background,
  },
  drawerRowActive: {
    backgroundColor: colors.surfaceSelected,
  },
  drawerRowCopy: { flex: 1 },
  drawerRowTitle: {
    fontSize: typography.size.sm,
    color: colors.foreground,
  },
  drawerRowTitleActive: {
    fontWeight: typography.weight.semibold,
  },
  drawerRowPreview: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  drawerRowMeta: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  drawerDeleteAction: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: colors.error,
    borderRadius: radii.md,
    marginLeft: spacing.xs,
  },
  drawerDeleteText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  confirmOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  confirmCard: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.lg,
  },
  confirmTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    letterSpacing: 0,
  },
  confirmBody: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  confirmCancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  confirmCancelText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  confirmPrimaryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  confirmPrimaryText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  renameOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  renameCard: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.lg,
  },
  renameTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  renameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.md,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  renameCancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  renameCancelText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  renameSaveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  renameSaveText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  // Messages
  messageList: { flex: 1 },
  messageListContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  messageListEmpty: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: spacing.xl,
  },
  // Bottom dock — backgroundColor intentionally omitted; BlurView owns the surface.
  bottomDock: {
    paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    overflow: 'hidden',
  },
  // Follow-up chips
  chipsShell: {
    paddingTop: spacing.xs,
    paddingBottom: 2,
  },
  chipsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingRight: spacing.xl,
    gap: spacing.xs,
  },
  chip: {
    minHeight: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  chipText: {
    fontSize: typography.size.xs,
    color: colors.secondaryForeground,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
  },
  moreChip: {
    width: 31,
    height: 31,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
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
  userAttachment: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  userAttachmentImage: { width: 52, height: 58, borderRadius: radii.md },
  userAttachmentFallback: { width: 38, height: 38, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  userAttachmentLabel: { flexShrink: 1, color: colors.primaryForeground, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  lookHeader: { gap: 3, paddingHorizontal: spacing.xs },
  lookHeaderTop: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerIconBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtnActive: {
    backgroundColor: colors.surfaceSelected,
  },
  lookTitle: {
    fontFamily: typography.family.display,
    fontSize: 26,
    color: colors.foreground,
    lineHeight: 32,
    letterSpacing: 0,
  },
  lookMeta: { fontSize: typography.size.xs, color: colors.mutedForeground },
  lineSheet: {
    paddingHorizontal: spacing.xs,
  },
  lineSheetLabel: {
    marginBottom: spacing.xs,
  },
  lineSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  lineSheetAddRow: {
    borderBottomWidth: 0,
  },
  lineSheetThumb: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineSheetAddThumb: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.primary}40`,
    borderStyle: 'dashed',
    backgroundColor: `${colors.primary}08`,
  },
  lineSheetThumbImage: {
    width: '100%',
    height: '100%',
  },
  lineSheetCopy: {
    flex: 1,
    gap: 1,
  },
  lineSheetCategory: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lineSheetName: {
    fontSize: typography.size.sm,
    color: colors.foreground,
    lineHeight: typography.size.sm * 1.3,
    fontWeight: typography.weight.medium,
  },
  lineSheetSwapBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rationaleLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  stylistNoteBlock: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  outfitCardText: {
    fontSize: typography.size.sm,
    color: colors.foreground,
    lineHeight: typography.size.sm * 1.6,
  },
  addEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: spacing.sm + 3,
    paddingHorizontal: spacing.lg,
  },
  addEventBtnDone: {
    backgroundColor: colors.primary,
  },
  addEventBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
    flexShrink: 1,
  },
  eventActionGroup: {
    gap: spacing.xs,
  },
  eventActionMeta: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    lineHeight: typography.size.xs * 1.45,
    textAlign: 'center',
  },
  eventUtilityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  eventUtilityBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  eventUtilityDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: colors.hairline,
  },
  eventUtilityText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  saveBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  saveBtnDone: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    flexShrink: 1,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  savedOutfitActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  viewClosetBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  viewClosetText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  outfitCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  reasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  reasonChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  reasonChipText: {
    fontSize: typography.size.xs,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
  },
  gapList: { gap: spacing.xs },
  adviceThumbs: { gap: spacing.sm, paddingVertical: spacing.xs },
  responseSection: { gap: spacing.sm, marginTop: spacing.sm },
  responseSectionTitle: { color: colors.foreground, fontFamily: typography.family.display, fontSize: typography.size.lg },
  adviceThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
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
  inlineError: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: '#FFF5F3',
  },
  inlineErrorCopy: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  inlineErrorTitle: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  inlineErrorText: { color: colors.mutedForeground, fontSize: typography.size.xs, lineHeight: 17 },
  retryBtn: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: colors.foreground },
  retryBtnText: { color: colors.primaryForeground, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  stylistSheetModal: { flex: 1, justifyContent: 'flex-end' },
  stylistSheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(40,35,31,0.28)',
  },
  stylistSheet: {
    overflow: 'hidden',
  },
  stylistSheetDragRegion: {
    width: '100%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.xs,
  },
  attachmentSheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.surfaceElevated,
  },
  sheetGrabber: { width: 38, height: 5, alignSelf: 'center', marginBottom: spacing.lg, borderRadius: radii.full, backgroundColor: colors.border },
  attachmentSheetTitle: { color: colors.foreground, fontFamily: typography.family.display, fontSize: 24 },
  attachmentSheetSubtitle: { marginTop: spacing.xs, color: colors.mutedForeground, fontSize: typography.size.sm, lineHeight: 20 },
  attachmentChoices: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  attachmentChoice: { flex: 1, minHeight: 104, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surfaceSubtle },
  attachmentChoiceIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, backgroundColor: colors.surfaceSelected },
  attachmentChoiceLabel: { color: colors.foreground, fontSize: typography.size.xs, fontWeight: typography.weight.semibold, textAlign: 'center' },
  followUpList: { gap: spacing.xs, marginTop: spacing.lg },
  followUpRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceSubtle },
  followUpText: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  // Empty state
  emptyState: {
    paddingHorizontal: spacing.sm,
    gap: spacing.xxxl,
  },
  emptyHero: {
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  emptyTitle: {
    fontFamily: typography.family.display,
    fontSize: 34,
    color: colors.foreground,
    lineHeight: 40,
    letterSpacing: 0,
  },
  emptySubtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    lineHeight: 21,
    maxWidth: 310,
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
  promptList: { width: '100%', gap: spacing.md },
  promptSectionLabel: {
    paddingHorizontal: spacing.xs,
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    letterSpacing: 1.2,
  },
  starterRows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  starterRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  starterCopy: { flex: 1, gap: spacing.xs },
  starterTitle: {
    fontSize: typography.size.md,
    color: colors.foreground,
    fontWeight: typography.weight.semibold,
  },
  starterSubtitle: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    lineHeight: 17,
  },
  moreIdeasButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  moreIdeasText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  moreIdeasSheet: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.surfaceElevated,
  },
  moreIdeasDragRegion: {
    width: '100%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.xs,
  },
  moreIdeasModal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  moreIdeasBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(40,35,31,0.28)',
  },
  moreIdeasTitle: {
    fontFamily: typography.family.display,
    fontSize: 26,
    lineHeight: 32,
    color: colors.foreground,
  },
  moreIdeasSubtitle: {
    marginTop: spacing.xs,
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  moreIdeasRows: { marginTop: spacing.lg },
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
    letterSpacing: 0,
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
