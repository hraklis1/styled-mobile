import { appendStylistAttachment } from '../../features/stylist/attachments';
import { useStylistPhotoAttachment } from './composer/useStylistPhotoAttachment';
import { useReduceTransparency } from '../../hooks/useReduceTransparency';
import { confirmSheet } from '../primitives/ConfirmSheet';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { StylistCardStateContext, type StylistCardState } from './StylistCardState';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Haptics from '../../lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as onDeviceSpeech from '../../lib/speech';
import { api } from '../../lib/api';
import { track } from '../../lib/analytics';
import { prepareStylistPhoto } from '../../lib/prepareStylistPhoto';
import { itemCoverPresentation, itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { useStylingWeatherToday } from '../../hooks/useWeather';
import { useItems } from '../../hooks/useItems';
import { useProfile } from '../../hooks/useProfile';
import { useActiveStylingLocation } from '../../hooks/useActiveStylingLocation';
import { conversationLocation, type StylingLocationContext } from '../../lib/stylingLocation';
import { formatTemp, resolveTempUnit } from '../../lib/temperature';
import { sanitizeStylistResponseText } from '../../lib/stylistResponseText';
import { buildStylistHistory } from '../../features/stylist/history';
import { resolveShoppingAlternativeMode } from '../../features/stylist/shoppingIntent';
import { useAcceptEventOutfitPlan, useCreateOutfit } from '../../hooks/useOutfits';
import { useAssignEventItems } from '../../hooks/useEvents';
import { StylistComposer } from './composer/StylistComposer';
import { ItemPickerSheet } from '../outfits/ItemPickerSheet';
import { BoardPickerModal } from '../boards/BoardPickerModal';
import type { BoardEntryRef } from '../../hooks/useBoards';
import { OpenItemContext } from './stylistItemContext';
import { StylistIntakeSheet } from './StylistIntakeSheet';
import { colors, spacing, typography } from '../../theme';
import { useStylistTransport } from '../../features/stylist/hooks/useStylistTransport';
import { buildInitialStylistSendOptions } from '../../features/stylist/initialPrompt';
import { attachmentItemIds, responseBlockItemIds } from '../../features/stylist/responseBlocks';
import type { StylistProgressStage, StylistAskRequest, StylistEntryContext, StylistEventPlanData, StylistMissingEssential, StylistMode, StylistWorkflow } from '../../features/stylist/types';
import { dayDividers } from '../../features/stylist/dayDivider';
import { deviceTimeContext, summarizeStylistWorkflow } from '../../features/stylist/workflows';
import { BUDGET_OPTIONS, OCCASION_OPTIONS, STYLE_OPTIONS } from '../../lib/profileOptions';
import type { Item } from '../../types/item';
import { ConversationDrawer } from './ChatConversationDrawer';
import { EmptyState, GuideContextCard, GuideEmptyState, guidePlaceholder } from './ChatEmptyStates';
import { MessageBubble } from './ChatMessageBubble';
import { ACTIVE_THREAD_KEY, ChatMessage, EventContext, ComposerAttachment, Conversation, LEGACY_SESSION_KEY, MissingEssential, SendOptions, ServerMessage, detectOccasionHint, guideQuestionMode, isProseMode, isRichAssistantMessage, makeId, mapServerMessages, normalizeChatMessage, responseExtras, threadKey, useContextualChips } from './ChatModel';
import { ConversationLocationPicker, StylistOverlaySheet } from './ChatOverlaySheet';
import { TypingIndicator } from './ChatProgress';
import { markMessageFresh } from './freshMessages';
import { styles } from './ChatStyles';

// ── Main Component ───────────────────────────────────────────────────────────


/** In-memory snapshot survives native modal dismissal while visiting saved content. */
export type StylistSessionSnapshot = {
  cards: Record<string, StylistCardState>;
  messages: ChatMessage[];
  inputText: string;
  conversationId: number | null;
  location: StylingLocationContext | null;
  scrollY: number;
  openRequestId: number;
  promptRequestId: number;
  composerAttachment: ComposerAttachment | null;
  composerPhotoData: string | null;
};

type Props = {
  sessionRef?: MutableRefObject<StylistSessionSnapshot | null>;
  initialQuery?: string;
  initialAttachment?: ComposerAttachment;
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
  onViewSaved?: (id: string) => void;
  onNavigateToShop?: (gap?: StylistMissingEssential) => void;
  onNavigateToCloset?: (outfitId: number) => void;
  /** Opens the full Closet item screen from an item sheet inside the chat. */
  onOpenItem?: (itemId: number) => void;
};

// Lets every ItemDetailSheet in the thread reach the full item screen without
// threading a callback through each card.

export function StylistChatView({
  sessionRef,
  initialQuery,
  initialAttachment,
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
  onViewSaved,
  onNavigateToShop,
  onNavigateToCloset,
  onOpenItem,
}: Props) {
  const restored = useRef(sessionRef?.current?.openRequestId === openRequestId ? sessionRef.current : null).current;
  const restoreScroll = useRef(restored?.scrollY ?? null);
  const scrollY = useRef(restored?.scrollY ?? 0);
  const cardStates = useRef<Record<string, StylistCardState>>(restored?.cards ?? {});
  const skipRestoredAutoScroll = useRef(!!restored);
  const skipRestoredLocation = useRef(!!restored);
  const insets = useSafeAreaInsets();
  // Header and dock float over the thread so the look scrolls under the blur;
  // their measured heights pad the scroll content instead of taking layout space.
  const reduceTransparency = useReduceTransparency();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [dockHeight, setDockHeight] = useState(0);
  const headerHeightRef = useRef(0);
  headerHeightRef.current = headerHeight;
  const { data: allItems = [] } = useItems();
  const { data: profile } = useProfile();
  const tempUnit = resolveTempUnit(profile?.tempUnit, profile?.location);
  const stylingLocation = useActiveStylingLocation();
  const [conversationLocationContext, setConversationLocationContext] = useState<StylingLocationContext | null>(
    restored?.location ?? (initialDestination ? conversationLocation(initialDestination) : null),
  );
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const activeLocation = conversationLocationContext ?? stylingLocation.activeLocation;
  const weather = useStylingWeatherToday(activeLocation);
  const createOutfit = useCreateOutfit();
  const assignEventItems = useAssignEventItems();
  const acceptEventPlan = useAcceptEventOutfitPlan();
  // When the chat was launched from a calendar event, suggested looks can be
  // assigned straight back onto that event (in addition to "Save outfit").
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

  const [messages, setMessages] = useState<ChatMessage[]>(restored?.messages ?? []);
  const [inputText, updateInputText] = useState(restored?.inputText ?? '');
  const draftTextRef = useRef(restored?.inputText ?? '');
  const draftKeyRef = useRef(`stylist_draft_${restored?.conversationId ?? 'new'}`);
  const draftRevisionRef = useRef(restored ? 1 : 0);
  const draftWritesRef = useRef(Promise.resolve());
  const setInputText = useCallback((value: string | ((previous: string) => string)) => {
    const next = typeof value === 'function' ? value(draftTextRef.current) : value;
    draftTextRef.current = next;
    draftRevisionRef.current += 1;
    updateInputText(next);
    const key = draftKeyRef.current;
    // Serialize writes so clearing a sent draft cannot race an older keystroke.
    draftWritesRef.current = draftWritesRef.current.then(() => next
      ? AsyncStorage.setItem(key, next)
      : AsyncStorage.removeItem(key)).catch(() => {});
  }, []);
  const restoreDraft = useCallback((id: number | null) => {
    const key = `stylist_draft_${id ?? 'new'}`;
    if (key === draftKeyRef.current && draftRevisionRef.current > 0) return;
    draftKeyRef.current = key;
    const revision = ++draftRevisionRef.current;
    draftTextRef.current = '';
    updateInputText('');
    void draftWritesRef.current.then(() => AsyncStorage.getItem(key)).then((text) => {
      if (draftKeyRef.current !== key || draftRevisionRef.current !== revision) return;
      draftTextRef.current = text ?? '';
      updateInputText(text ?? '');
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!restored) restoreDraft(null);
  }, [restored, restoreDraft]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  // Active server thread. null means "unsaved draft" — the next send lazily
  // creates a thread server-side and returns its id in the `done` event.
  const [conversationId, setConversationId] = useState<number | null>(restored?.conversationId ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [wardrobePickerVisible, setWardrobePickerVisible] = useState(false);
  const [boardTarget, setBoardTarget] = useState<BoardEntryRef | null>(null);
  const [composerAttachment, setComposerAttachment] = useState<ComposerAttachment | null>(restored?.composerAttachment ?? null);
  const [composerPhotoData, setComposerPhotoData] = useState<string | null>(restored?.composerPhotoData ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedRequest, setFailedRequest] = useState<SendOptions | null>(null);
  const [followUpsOpen, setFollowUpsOpen] = useState(false);
  const [intakeKind, setIntakeKind] = useState<Exclude<StylistWorkflow['kind'], 'wardrobe_audit'> | null>(null);
  const [intakeInitialItemId, setIntakeInitialItemId] = useState<number | null>(null);

  const composerInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const messageLayoutsRef = useRef<Record<string, number>>({});
  const pendingFocusMessageIdRef = useRef<string | null>(null);
  const focusedRichMessageIdRef = useRef<string | null>(null);
  const speechRequestRef = useRef(0);
  const lastPromptRequestIdRef = useRef(restored?.promptRequestId ?? 0);
  const lastOpenRequestIdRef = useRef(restored?.openRequestId ?? 0);
  // Mirror of `messages` so sendMessage can read the latest history without being
  // re-created on every message, and so a thread reset takes effect synchronously.
  const messagesRef = useRef<ChatMessage[]>(restored?.messages ?? []);
  // Mirror of `conversationId` for synchronous reads: a topical "new" open resets
  // the thread and immediately fires the initial query, so the send must see the
  // cleared id rather than the previous render's value.
  const conversationIdRef = useRef<number | null>(restored?.conversationId ?? null);
  const transportRequestMetaRef = useRef<Record<string, { userMessageId: string; originalOptions: SendOptions }>>({});

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

  useEffect(() => {
    if (sessionRef) sessionRef.current = {
      cards: cardStates.current, messages, inputText, conversationId, location: conversationLocationContext,
      scrollY: scrollY.current, openRequestId: lastOpenRequestIdRef.current,
      promptRequestId: lastPromptRequestIdRef.current, composerAttachment, composerPhotoData,
    };
  });

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

  // Keep the history mirror in sync with rendered messages.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToMessageStart = useCallback((messageId: string, animated = true) => {
    const y = messageLayoutsRef.current[messageId];
    if (typeof y !== 'number') return false;
    scrollRef.current?.scrollTo({ y: Math.max(y - headerHeightRef.current - spacing.md, 0), animated });
    return true;
  }, []);

  function stopCurrentAudio() {
    speechRequestRef.current += 1;
    onDeviceSpeech.stop();
    setPlayingId(null);
  }

  async function playTts(messageId: string, text: string) {
    stopCurrentAudio();
    const request = speechRequestRef.current;
    const available = await onDeviceSpeech.isAvailable();
    if (request !== speechRequestRef.current) return;
    if (!available) {
      confirmSheet({ title: 'Read aloud unavailable', message: 'Update Styled to use your device’s voice. You can still read the stylist’s reply here.', confirmLabel: 'OK', cancelLabel: null, onConfirm: () => {} });
      return;
    }
    setPlayingId(messageId);
    onDeviceSpeech.speak(text, {
      onDone: () => { if (request === speechRequestRef.current) setPlayingId(null); },
      onError: () => { if (request === speechRequestRef.current) setPlayingId(null); },
    });
  }

  const [progressStage, setProgressStage] = useState<StylistProgressStage | null>(null);
  const {
    isLoading,
    sendMessage: sendTransportMessage,
    abortCurrent: abortTransport,
  } = useStylistTransport({
    onProgress: setProgressStage,
    onAssistantStart: (assistantId) => {
      markMessageFresh(assistantId);
      setProgressStage(null);
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
    onBlock: (assistantId, index, block) => {
      setMessages(prev => prev.map(message => {
        if (message.id !== assistantId || message.role !== 'assistant') return message;
        const blocks = [...(message.blocks ?? [])];
        blocks[index] = block;
        return { ...message, responseVersion: 3, blocks, text: blocks.map(part => part?.text ?? '').filter(Boolean).join('\n\n') };
      }));
    },
    onAssistantDone: (assistantId, event) => {
      const {
        responseText,
        itemIds,
        lookName,
        eventPlan,
        missingEssentials: mes,
        missingEssential: legacyMe,
        readinessStatus,
        foundationItemIds,
        clarification,
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

      markMessageFresh(assistantId);
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
            : isProseMode(respMode)
              ? 'advice'
              : itemIds?.length
                ? 'closet_outfit'
                : 'text',
        text: sanitizeStylistResponseText(responseText ?? ''),
        ...((event.responseVersion === 2 || event.responseVersion === 3) && event.blocks ? { responseVersion: event.responseVersion, blocks: event.blocks } : {}),
        isStreaming: false,
        deliveryStatus: event.deliveryStatus,
        failureCode: event.failureCode,
        ...(readinessStatus ? { readinessStatus } : {}),
        ...(foundationItemIds?.length ? { foundationItemIds } : {}),
        ...(clarification ? { clarification } : {}),
        ...(respMode ? { mode: respMode } : {}),
        ...(shopOutfit ? { shopOutfit } : {}),
        ...(tripPlan ? { tripPlan: { ...tripPlan, pending: false } } : {}),
        ...(wardrobeAudit ? { wardrobeAudit } : {}),
        ...(eventPlan ? { eventPlan } : {}),
        ...(readinessStatus === 'ready' && itemIds?.length && boardAction !== 'complete' && boardAction !== 'theme' ? { suggestedItemIds: itemIds } : {}),
        ...(lookName ? { lookName } : {}),
        ...(hydratedEssentials.length ? { missingEssentials: hydratedEssentials } : {}),
        ...(typeof recId === 'number' ? { recId } : {}),
        ...(boardAction ? { boardAction } : {}),
        ...responseExtras({ critique: event.critique ?? undefined, pieceNotes: event.pieceNotes, stylingMoves: event.stylingMoves, followUps: event.followUps }),
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

      if (event.deliveryStatus === 'failed' || event.deliveryStatus === 'partial' && event.failureCode) {
        setErrorMessage(event.deliveryStatus === 'failed' ? 'The stylist couldn’t finish this request.' : 'Part of this recommendation could not be completed.');
        setFailedRequest(transportRequestMetaRef.current[assistantId]?.originalOptions ?? null);
      }
      delete transportRequestMetaRef.current[assistantId];
    },
    onConversationResolved: (resolvedConversationId) => {
      if (resolvedConversationId !== conversationIdRef.current) {
        const previousKey = draftKeyRef.current;
        draftKeyRef.current = `stylist_draft_${resolvedConversationId}`;
        setInputText(draftTextRef.current);
        draftWritesRef.current = draftWritesRef.current.then(() => AsyncStorage.removeItem(previousKey)).catch(() => {});
        setActiveConversationId(resolvedConversationId);
      }
    },
    onError: ({ message, request }) => {
      setErrorMessage(message);
      setFailedRequest(request.originalOptions ?? null);
      setMessages((prev) => {
        const partial = prev.find(m => m.id === request.assistantMessageId);
        if (partial?.role === 'assistant' && partial.blocks?.length) {
          return prev.map(m => m.id === partial.id ? { ...m, isStreaming: false } : m);
        }
        return prev.filter(m => m.id !== request.userMessageId && m.id !== request.assistantMessageId);
      });
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
      transportRequestMetaRef.current[assistantId] = { userMessageId: userMsg.id, originalOptions: opts };

      const history = buildStylistHistory(messagesRef.current);
      const lastAssistant = [...messagesRef.current]
        .reverse()
        .find((message): message is Extract<ChatMessage, { role: 'assistant' }> => message.role === 'assistant');
      const requestMode = !workflow && (!mode || mode === 'advice')
        ? resolveShoppingAlternativeMode(text) ?? mode
        : mode;
      const continuationMode = !workflow && !requestMode ? lastAssistant?.mode : undefined;
      const continuationItemIds = lastAssistant
        ? Array.from(new Set([
            ...(lastAssistant.suggestedItemIds ?? []),
            ...responseBlockItemIds(lastAssistant.blocks),
            ...(lastAssistant.tripPlan?.outfits.flatMap((outfit) => outfit.itemIds) ?? []),
            ...(lastAssistant.wardrobeAudit?.workhorses.map((entry) => entry.itemId) ?? []),
            ...(lastAssistant.wardrobeAudit?.underused.map((entry) => entry.itemId) ?? []),
          ])).slice(0, 12)
        : [];

      let weatherSummary: string | undefined;
      if (weather.data) {
        weatherSummary = `${weather.data.current.summary} ${formatTemp(weather.data.current, tempUnit)}`;
      }

      const occasionHint = text ? detectOccasionHint(text) : undefined;
      // Keep attached pieces available to follow-up questions after the tray clears.
      // A later photo or single-piece attachment replaces that selection context.
      const latestAttachment = attachment ?? [...messagesRef.current].reverse()
        .find((message): message is Extract<ChatMessage, { role: 'user' }> => message.role === 'user' && !!message.attachment)?.attachment;
      const selectedIds = attachmentItemIds(latestAttachment);
      const selectionContext: StylistEntryContext | undefined = selectedIds.length && latestAttachment
        ? { kind: 'closet_selection', itemIds: selectedIds, label: latestAttachment.label }
        : undefined;
      const requestContext = context ?? selectionContext ?? entryContext;
      // Only a newly selected piece is mandatory. Prior attachments remain evidence,
      // allowing the model to release them when the user changes topic.
      const freshIds = attachment ? attachmentItemIds(attachment)
        : context?.kind === 'item' ? [context.itemId]
        : context?.kind === 'closet_selection' ? context.itemIds : [];
      const anchorItemId = freshIds?.length === 1 ? freshIds[0] : undefined;
      const locationSource = activeLocation.source === 'destination' ? 'conversation' : activeLocation.source;
      const request: StylistAskRequest = {
        ...(text ? { text } : {}),
        ...(anchorItemId ? { anchorItemId } : {}),
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
        ...(requestMode ? { mode: requestMode } : {}),
        ...(!conversationIdRef.current ? { history } : {}),
      };

      setProgressStage(null);
      void sendTransportMessage({
        request,
        assistantMessageId: assistantId,
        userMessageId: userMsg.id,
        originalOptions: opts,
      });
    },
    [activeLocation, entryContext, isLoading, tempUnit, sendTransportMessage, source, weather.data, setInputText],
  );

  // ── Thread lifecycle ─────────────────────────────────────────────────────────

  function startFreshThread() {
    stopCurrentAudio();
    abortTransport();
    messagesRef.current = [];
    transportRequestMetaRef.current = {};
    setMessages([]);
    setActiveConversationId(null);
    draftKeyRef.current = 'stylist_draft_new';
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
    restoreDraft(id);
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
      restoreDraft(id);
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
    // Resume can set the active id before its transcript lands (or after a failed
    // load), leaving the empty state up; only skip when the thread is on screen.
    if (id === conversationIdRef.current && messagesRef.current.length > 0) return;
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
    if (skipRestoredLocation.current) { skipRestoredLocation.current = false; return; }
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
      setComposerAttachment(initialAttachment ?? null);
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
      if (skipRestoredAutoScroll.current) { skipRestoredAutoScroll.current = false; return; }
      if (restoreScroll.current !== null) return;
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

  function appendAttachment(added: ComposerAttachment) {
    setComposerAttachment(current => appendStylistAttachment(
      current?.type === 'photo' && current.uri && composerPhotoData
        ? { ...current, photos: [{ uri: current.uri, dataUrl: composerPhotoData }] }
        : current,
      added,
    ));
    setComposerPhotoData(null);
  }

  const photoPicker = useStylistPhotoAttachment({
    photoCount: (composerAttachment?.photos?.length ?? 0) + (composerPhotoData ? 1 : 0),
    closeSheet: () => setAttachmentSheetVisible(false),
    onPhoto: ({ uri, dataUrl }) => {
      appendAttachment({ type: 'photo', label: 'Photo', photos: [{ uri, dataUrl }] });
    },
    onChooseCloset: () => setWardrobePickerVisible(true),
  });

  function handleSendText(question?: string) {
    const trimmed = (question ?? inputText).trim();
    if (!trimmed && !composerAttachment) return;
    if (isLoading) return;
    const attachmentText = composerAttachment?.type === 'items'
      ? trimmed || 'How would you style these pieces?'
      : composerAttachment?.type === 'item'
      ? `@${composerAttachment.label}${trimmed ? ` ${trimmed}` : ''}`
      : trimmed || 'What do you think of this look?';
    sendMessage({
      text: attachmentText,
      ...(entryContext?.kind === 'shopping_brief_edit' ? guideQuestionMode(attachmentText) : {}),
      ...(composerAttachment?.items?.length ? { context: { kind: 'closet_selection' as const, itemIds: composerAttachment.items.map((item) => item.itemId), label: composerAttachment.label } } : {}),
      displayText: trimmed || (composerAttachment?.type === 'items' ? 'How would you style these pieces?' : composerAttachment?.type === 'photo' ? 'What do you think of this look?' : 'How would you style this?'),
      ...(composerAttachment?.photos?.length ? { photoData: [...(composerPhotoData ? [composerPhotoData] : []), ...composerAttachment.photos.map(photo => photo.dataUrl)] } : composerPhotoData ? { photoData: composerPhotoData } : {}),
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

  function stageSuggestion(text: string) {
    // Never overwrite an unfinished question when exploring suggestions, and
    // don't stack the same suggestion twice (a double tap, or a tap that lags).
    setInputText((draft) => draft.includes(text.trim()) ? draft
      : draft.trim() ? `${draft.trimEnd()}\n${text}`.slice(0, 2000) : text.slice(0, 2000));
    setMentionQuery(null);
    composerInputRef.current?.focus();
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
    appendAttachment({ type: 'item', label: item.name, uri, itemId: item.id });
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
    confirmSheet({
      title: 'Start a new styling session?',
      message: 'Your current conversation stays saved in History.',
      confirmLabel: 'Start new session',
      onConfirm: startNewConversation,
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isEmpty = messages.length === 0 && !isLoading && !errorMessage;
  // The most-worn top, bottom and shoes: the user's own staples. Catalog-style
  // covers first, so a selfie in the piece doesn't sit in a still-life strip.
  const emptyPreviewItems = useMemo(() => (['top', 'bottom', 'shoes'] as const)
    .map((category) => allItems
      .filter((item) => item.category === category && itemCoverPresentation(item).uri)
      .sort((a, b) => Number(itemCoverPresentation(b).isCatalogStyle) - Number(itemCoverPresentation(a).isCatalogStyle)
        || (b.wearCount ?? 0) - (a.wearCount ?? 0))[0])
    .filter((item): item is Item => !!item), [allItems]);
  // Recomputed per render rather than per minute: a thread only crosses midnight
  // while open in the rarest case, and the transcript rerenders on every turn.
  const dividers = useMemo(() => dayDividers(messages), [messages]);
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const contextualChips = useContextualChips(lastAssistantMsg, entryContext);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.bottom}
    >
      <BlurView
        intensity={reduceTransparency ? 0 : 35}
        tint="systemThinMaterialLight"
        style={[styles.header, reduceTransparency && styles.chromeSolid, { paddingTop: insets.top + spacing.xs }]}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        {...(Platform.OS === 'android' && { blurMethod: 'dimezisBlurViewSdk31Plus' })}
      >
        {/* One compact masthead everywhere: the page's own headline (or the look)
            gets the room, and the styling location rides along as its subtitle. */}
        <TouchableOpacity
          style={styles.headerIdentityCompact}
          onPress={() => setLocationPickerVisible(true)}
          activeOpacity={0.75}
          accessibilityRole="header"
          accessibilityLabel={`Your stylist. Styling location: ${activeLocation.label || 'not set'}`}
          accessibilityHint="Changes the styling location"
        >
          <Text style={styles.headerTitleCompact} numberOfLines={1}>Your stylist</Text>
          <View style={styles.headerCompactMeta}>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{activeLocation.label || 'Set location'}</Text>
            {weather.data?.current ? (
              <Text style={styles.headerWeather}>{` · ${formatTemp(weather.data.current, tempUnit)}`}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
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
        items={allItems}
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
          { paddingTop: headerHeight + spacing.xl, paddingBottom: dockHeight + spacing.xxl },
        ]}
        scrollIndicatorInsets={{ top: headerHeight, bottom: dockHeight }}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
          if (sessionRef?.current) sessionRef.current.scrollY = scrollY.current;
        }}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          if (restoreScroll.current === null) return;
          const y = restoreScroll.current;
          restoreScroll.current = null;
          scrollRef.current?.scrollTo({ y, animated: false });
          focusedRichMessageIdRef.current = messages[messages.length - 1]?.id ?? null;
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {isEmpty && composerAttachment?.type === 'items' ? (
          <View style={styles.attachedEmpty}>
            <Text style={styles.attachedEyebrow}>Your pieces</Text>
            <Text style={styles.attachedTitle}>A fresh perspective on what you own</Text>
            <Text style={styles.attachedBody}>Ask about pairing, fit, colour, or how to wear them. Your selected pieces are attached below.</Text>
            <View style={styles.attachedList}>
              {['How can I style these pieces together?', 'Which of these pieces work best together?', 'What would complete these looks?'].map((question) => (
                <TouchableOpacity key={question} onPress={() => stageSuggestion(question)} accessibilityRole="button" style={styles.attachedRow}>
                  <Text style={styles.attachedRowText}>{question}</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : isEmpty && entryContext?.kind === 'shopping_brief_edit' ? (
          <GuideEmptyState context={entryContext} onPrompt={stageSuggestion} />
        ) : isEmpty ? (
          <EmptyState
            weather={weather.data?.current}
            tempUnit={tempUnit}
            displayName={profile?.displayName}
            wardrobeCount={allItems.length}
            previewItems={emptyPreviewItems}
            onPrompt={stageSuggestion}
            onWorkflow={openStarterWorkflow}
          />
        ) : (
          <>
            {entryContext?.kind === 'shopping_brief_edit' ? (
              <View style={styles.guideContextPinned}><GuideContextCard context={entryContext} /></View>
            ) : null}
            {messages.map((msg) => (
              <Fragment key={msg.id}>
                {dividers.has(msg.id) ? (
                  <View style={styles.dayDivider} accessibilityRole="header">
                    <View style={styles.dayDividerRule} />
                    <Text style={styles.dayDividerLabel}>{dividers.get(msg.id)}</Text>
                    <View style={styles.dayDividerRule} />
                  </View>
                ) : null}
                <View
                  onLayout={(event) => {
                    messageLayoutsRef.current[msg.id] = event.nativeEvent.layout.y;
                    if (pendingFocusMessageIdRef.current === msg.id && scrollToMessageStart(msg.id)) {
                      pendingFocusMessageIdRef.current = null;
                    }
                  }}
                >
                  <StylistCardStateContext.Provider value={cardStates.current[msg.id] ?? (cardStates.current[msg.id] = {})}>
                  <OpenItemContext.Provider value={onOpenItem}>
                  <MessageBubble
                    message={msg}
                    allItems={allItems}
                    isPlaying={playingId === msg.id}
                    createOutfit={createOutfit}
                    eventContext={eventContext}
                    entryContext={entryContext}
                    onAddToEvent={onAddToEvent}
                    onNavigateToShop={onNavigateToShop}
                    onClarificationSelect={(value) => sendMessage({ text: value, mode: 'from_closet' })}
                    onNavigateToCloset={onNavigateToCloset}
                    onStyleAuditItem={openAuditItemStyling}
                    onSaveToBoard={setBoardTarget}
                    onViewSaved={onViewSaved}
                    onToggleAudio={
                      msg.role === 'assistant' && !msg.isStreaming && (msg.id === lastAssistantMsg?.id || playingId === msg.id)
                        ? () =>
                            playingId === msg.id
                              ? stopCurrentAudio()
                              : playTts(msg.id, msg.text)
                        : undefined
                    }
                  />
                  </OpenItemContext.Provider>
                  </StylistCardStateContext.Provider>
                </View>
              </Fragment>
            ))}
            {isLoading && !messages.some((m) => m.isStreaming) && <TypingIndicator stage={progressStage} />}
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
        intensity={reduceTransparency ? 0 : 42}
        tint="systemThinMaterialLight"
        style={[styles.bottomDock, reduceTransparency && styles.chromeSolid, { paddingBottom: embedded ? spacing.sm : insets.bottom + spacing.sm }]}
        onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}
        {...(Platform.OS === 'android' && { blurMethod: 'dimezisBlurViewSdk31Plus' })}
      >
        {/* Follow-up chips */}
        {messages.length > 0 && !isLoading && contextualChips.length > 0 && (
          <View style={styles.chipsShell}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContent}
              keyboardShouldPersistTaps="handled"
            >
              {contextualChips.slice(0, 2).map((chip) => (
                <TouchableOpacity
                  key={chip.label}
                  style={styles.chip}
                  onPress={() => stageSuggestion(chip.prompt)}
                  disabled={isLoading}
                  accessibilityHint="Adds an editable suggestion to your draft. Review it before sending."
                >
                  <Text style={styles.chipText}>{chip.label}</Text>
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
        {mentionQuery !== null && (
          <View style={styles.mentionMenu}>
            {!mentionItems.length ? <Text style={{ ...typography.text.bodySmall, color: colors.mutedForeground, padding: spacing.md }} accessibilityLiveRegion="polite">{allItems.length ? 'No matching pieces. Try another name or choose from your closet.' : 'Your closet is empty. Add a piece to reference it here.'}</Text> : null}
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
          onStartDictation={stopCurrentAudio}
          vocabulary={allItems.flatMap(item => [item.name, item.brand ?? ''])}
          inputRef={composerInputRef}
          value={inputText}
          onChangeText={handleTextChange}
          onDictatedText={setInputText}
          onSend={() => handleSendText()}
          onStopGeneration={stopGeneration}
          isLoading={isLoading}
          attachment={composerAttachment}
          onRemoveItem={(itemId) => setComposerAttachment((current) => {
            const items = current?.items?.filter((item) => item.itemId !== itemId);
            return items?.length || current?.photos?.length ? { ...current!, items, label: `${(items?.length ?? 0) + (current?.photos?.length ?? 0)} attachments` } : null;
          })}
          onRemovePhoto={(uri) => setComposerAttachment(current => {
            const photos = current?.photos?.filter(photo => photo.uri !== uri);
            return photos?.length || current?.items?.length ? { ...current!, photos, label: `${(photos?.length ?? 0) + (current?.items?.length ?? 0)} attachments` } : null;
          })}
          onRemoveAttachment={() => { setComposerAttachment(null); setComposerPhotoData(null); }}
          onOpenAttachmentSheet={() => { if (!photoPicker.busy) setAttachmentSheetVisible(true); }}
          placeholder={composerAttachment?.type === 'items' ? 'How would you like to wear these?' : entryContext?.kind === 'shopping_brief_edit' ? guidePlaceholder(entryContext) : messages.length ? 'Ask a follow-up…' : undefined}
        />
      </BlurView>

      <StylistOverlaySheet
        visible={attachmentSheetVisible}
        onDismiss={photoPicker.afterDismiss}
        bottomInset={insets.bottom}
        onClose={() => setAttachmentSheetVisible(false)}
      >
        <Text style={styles.attachmentSheetTitle}>Add to your question</Text>
        <Text style={styles.attachmentSheetSubtitle}>Give your stylist something visual to work with.</Text>
        <View style={styles.attachmentChoices}>
          <AttachmentChoice icon="camera-outline" label="Camera" onPress={() => photoPicker.choosePhoto('camera')} />
          <AttachmentChoice icon="images-outline" label="Photo library" onPress={() => photoPicker.choosePhoto('library')} />
          <AttachmentChoice
            icon="shirt-outline"
            label="From closet"
            onPress={photoPicker.chooseCloset}
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
        title="Choose wardrobe pieces"
        multiple
        selectedIds={attachmentItemIds(composerAttachment ?? undefined)}
        items={allItems}
        selectedId={composerAttachment?.type === 'item' ? composerAttachment.itemId : undefined}
        onSelect={(item) => {
          if (attachmentItemIds(composerAttachment ?? undefined).includes(item.id)) {
            setComposerAttachment(current => {
              const items = current?.items?.filter(piece => piece.itemId !== item.id) ?? [];
              return items.length || current?.photos?.length ? { ...current!, items, label: `${items.length + (current?.photos?.length ?? 0)} attachments` } : null;
            });
          } else {
            appendAttachment({ type: 'item', label: item.name, itemId: item.id, uri: itemImageUri(item) });
          }
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
            <TouchableOpacity key={chip.label} style={styles.followUpRow} onPress={() => { setFollowUpsOpen(false); stageSuggestion(chip.prompt); }}>
              <Text style={styles.followUpText}>{chip.prompt}</Text>
              <Ionicons name="arrow-forward" size={17} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      </StylistOverlaySheet>

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
