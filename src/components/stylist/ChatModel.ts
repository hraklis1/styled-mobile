import { useMemo } from 'react';
import { sanitizeStylistResponseText } from '../../lib/stylistResponseText';
import { isGuideListingQuestion, styleAskQuestions } from '../../lib/shoppingEditorial';
import { editorial } from '../../theme';
import type { StylistResponseBlock, StylistComposerAttachment, StylistEntryContext, StylistEventPlanData, StylistMessage, StylistMissingEssential, StylistClarification, StylistReadinessStatus, StylistMode, StylistRenderType, StylistSendOptions, StylistTripPlanData, StylistWardrobeAuditData, StylistCritique, StylistPieceNote, StylistFollowUp } from '../../features/stylist/types';
import type { ShopOutfit } from '../../types/shop';

// "Wear it with" thumbnails are the same 3:4 plate as a closet card, scaled down.
export const ADVICE_THUMB_WIDTH = 104;
export const ADVICE_THUMB_HEIGHT = Math.round(ADVICE_THUMB_WIDTH / editorial.garmentAspectRatio);

// ── Types ────────────────────────────────────────────────────────────────────

type Role = StylistMessage['role'];
export type MissingEssential = StylistMissingEssential;
export type ChatMessage = StylistMessage;
export type ComposerAttachment = StylistComposerAttachment;
export type SendOptions = StylistSendOptions;

// A persisted stylist thread, as summarized by GET /api/stylist/conversations.
export type Conversation = {
  id: number;
  title: string;
  source?: string | null;
  updatedAt: string;
  preview?: string | null;
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

// Advice and knowledge both render as prose. Knowledge answers a clothing
// question (care, sizing, dress codes) with no wardrobe attached; advice answers
// one about the wardrobe. Neither is an editable outfit card, so they share a
// render path — this predicate keeps the four dispatch sites in agreement.
export function isProseMode(mode: StylistMode | undefined): boolean {
  return mode === 'advice' || mode === 'knowledge';
}

const CHIPS_KNOWLEDGE = [
  'How should I store it?',
  'Is it worth repairing?',
  'Build an outfit around it',
  "What's missing from my closet?",
];

export type GuideContext = Extract<StylistEntryContext, { kind: 'shopping_brief_edit' }>;
export function guideFocus(context: GuideContext) {
  return context.focusTargetKey ? context.targets.find(target => target.key === context.focusTargetKey) : undefined;
}

// Guide questions that want products go unmoded so the server routes them to a
// shop list; the rest stay advice (styling the target, comparing styles).
export function guideQuestionMode(question: string): { mode?: StylistMode } {
  return isGuideListingQuestion(question) ? {} : { mode: 'advice' };
}

type ChipSpec = { label: string; prompt: string };
const asChips = (prompts: readonly string[]): ChipSpec[] => prompts.map((prompt) => ({ label: prompt, prompt }));

// Server follow-ups are specific to the answer, so they lead; the mode's fixed
// set fills the "More" list behind them.
export function useContextualChips(lastMessage: ChatMessage | undefined, entryContext?: StylistEntryContext): ChipSpec[] {
  const base = useBaseChips(lastMessage, entryContext);
  return useMemo(() => {
    const server = entryContext?.kind !== 'shopping_brief_edit' && lastMessage?.role === 'assistant' ? lastMessage.followUps ?? [] : [];
    if (lastMessage?.role === 'assistant' && (lastMessage.responseVersion === 2 || lastMessage.responseVersion === 3)) return server;
    if (!server.length) return asChips(base);
    const seen = new Set(server.map((f) => f.prompt.toLowerCase()));
    return [...server, ...asChips(base.filter((prompt) => !seen.has(prompt.toLowerCase())))];
  }, [base, entryContext, lastMessage]);
}

function useBaseChips(lastMessage: ChatMessage | undefined, entryContext?: StylistEntryContext): string[] {
  return useMemo(() => {
    if (entryContext?.kind === 'shopping_brief_edit') {
      const focus = guideFocus(entryContext);
      return focus ? [...styleAskQuestions(focus), 'Make it more polished.'] : ['Which option is most versatile?', 'Make these more polished.', 'Keep this within my budget.'];
    }
    if (!lastMessage || lastMessage.role !== 'assistant') return CHIPS_DEFAULT;
    if (lastMessage.wardrobeAudit || lastMessage.mode === 'wardrobe_audit') return CHIPS_AUDIT;
    if (lastMessage.tripPlan || lastMessage.mode === 'trip') return CHIPS_TRIP;
    if (lastMessage.mode === 'knowledge') return CHIPS_KNOWLEDGE;
    if (lastMessage.mode === 'advice') return CHIPS_ADVICE;
    if (lastMessage.shopOutfit) return CHIPS_SHOP;
    if (lastMessage.suggestedItemIds?.length) return CHIPS_CLOSET;
    return CHIPS_DEFAULT;
  }, [entryContext, lastMessage]);
}

export function makeId() {
  return Math.random().toString(36).slice(2);
}

// ── Conversation persistence keys ──────────────────────────────────────────────
// The server is the source of truth for threads; these AsyncStorage entries are a
// thin cache so the active thread resumes instantly and reads while offline.
export const ACTIVE_THREAD_KEY = 'stylist_active_thread_id';
export const LEGACY_SESSION_KEY = 'stylist_last_session';
export const threadKey = (id: number) => `stylist_thread_${id}`;

// Structured render data the server stores alongside an assistant turn, so a
// reloaded thread redraws outfit cards, shop edits, and trip carousels instead
// of degrading them to plain notes. Mirrors the /ask `done` event's rich fields.
type ServerMessagePayload = {
  deliveryStatus?: 'complete' | 'partial' | 'failed';
  failureCode?: 'malformed_output' | 'truncated_output' | 'evidence_unavailable' | 'provider_failure' | 'budget_exhausted' | 'validation_failed';
  responseVersion?: 2 | 3;
  blocks?: StylistResponseBlock[];
  readinessStatus?: StylistReadinessStatus;
  foundationItemIds?: number[];
  clarification?: StylistClarification;
  mode?: StylistMode;
  itemIds?: number[];
  eventPlan?: StylistEventPlanData | null;
  lookName?: string;
  missingEssentials?: MissingEssential[];
  shopOutfit?: ShopOutfit;
  tripPlan?: StylistTripPlanData;
  wardrobeAudit?: StylistWardrobeAuditData;
  boardAction?: 'outfit' | 'complete' | 'capsule' | 'theme' | 'ask';
  critique?: StylistCritique;
  pieceNotes?: StylistPieceNote[];
  stylingMoves?: string[];
  followUps?: StylistFollowUp[];
};

export type ServerMessage = { id: number; role: Role; text: string; recId?: number | null; payload?: ServerMessagePayload | null; createdAt?: string };

function renderTypeForAssistantPayload(payload?: ServerMessagePayload | null): StylistRenderType {
  if (payload?.wardrobeAudit) return 'wardrobe_audit';
  if (payload?.tripPlan) return 'trip_plan';
  if (payload?.shopOutfit) return 'shopping_outfit';
  if (isProseMode(payload?.mode)) return 'advice';
  if (payload?.itemIds?.length || payload?.eventPlan || payload?.readinessStatus === 'incomplete' || payload?.readinessStatus === 'needs_clarification') return 'closet_outfit';
  return 'text';
}

function renderTypeForAssistantMessage(message: {
  tripPlan?: StylistTripPlanData;
  shopOutfit?: ShopOutfit;
  mode?: StylistMode;
  suggestedItemIds?: number[];
  wardrobeAudit?: StylistWardrobeAuditData;
  readinessStatus?: StylistReadinessStatus;
}): StylistRenderType {
  if (message.wardrobeAudit) return 'wardrobe_audit';
  if (message.tripPlan) return 'trip_plan';
  if (message.shopOutfit) return 'shopping_outfit';
  if (isProseMode(message.mode)) return 'advice';
  if (message.suggestedItemIds?.length || message.readinessStatus === 'incomplete' || message.readinessStatus === 'needs_clarification') return 'closet_outfit';
  return 'text';
}

export function normalizeChatMessage(message: ChatMessage): ChatMessage {
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

export function isRichAssistantMessage(message: ChatMessage | undefined): message is Extract<ChatMessage, { role: 'assistant' }> {
  return !!message
    && message.role === 'assistant'
    && !message.isStreaming
    && (
      message.renderType === 'closet_outfit'
      || message.renderType === 'shopping_outfit'
      || message.renderType === 'trip_plan'
      || message.renderType === 'wardrobe_audit'
      || !!message.suggestedItemIds?.length
      || message.readinessStatus === 'incomplete'
      || message.readinessStatus === 'needs_clarification'
      || !!message.shopOutfit
      || !!message.tripPlan
      || !!message.wardrobeAudit
      || !!message.blocks?.some(block => block.type === 'card')
    );
}

// Map a server-stored thread into chat messages. The recId is preserved so
// feedback still links; the payload (when present) rehydrates rich replies —
// without it, an assistant turn falls back to a plain stylist note.
// Critique + v13 extras, shared by the live done event and reloaded threads.
export function responseExtras(p: Pick<ServerMessagePayload, 'critique' | 'pieceNotes' | 'stylingMoves' | 'followUps'> | null | undefined) {
  return {
    ...(p?.critique?.verdict ? { critique: p.critique } : {}),
    ...(p?.pieceNotes?.length ? { pieceNotes: p.pieceNotes } : {}),
    ...(p?.stylingMoves?.length ? { stylingMoves: p.stylingMoves } : {}),
    ...(p?.followUps?.length ? { followUps: p.followUps } : {}),
  };
}

export function mapServerMessages(rows: ServerMessage[]): ChatMessage[] {
  return rows.map((m) => {
    const p = m.payload ?? undefined;
    if (m.role === 'user') {
      return {
        id: `srv_${m.id}`,
        role: 'user',
        kind: 'user',
        renderType: 'text',
        text: m.text,
        ...(p?.itemIds?.length ? { attachment: { type: 'items' as const, label: 'Closet selection', items: p.itemIds.map(itemId => ({ itemId, label: 'Closet piece' })) } } : {}),
        ...(m.createdAt ? { createdAt: new Date(m.createdAt).getTime() } : {}),
      };
    }
    return {
      id: `srv_${m.id}`,
      role: 'assistant',
      kind: 'assistant',
      renderType: renderTypeForAssistantPayload(p),
      text: sanitizeStylistResponseText(m.text),
      ...((p?.responseVersion === 2 || p?.responseVersion === 3) && p.blocks ? { responseVersion: p.responseVersion, blocks: p.blocks } : {}),
      ...(typeof m.recId === 'number' ? { recId: m.recId } : {}),
      ...(p?.mode ? { mode: p.mode } : {}),
      deliveryStatus: p?.deliveryStatus, failureCode: p?.failureCode,
      ...(p?.readinessStatus ? { readinessStatus: p.readinessStatus } : {}),
      ...(p?.foundationItemIds?.length ? { foundationItemIds: p.foundationItemIds } : {}),
      ...(p?.clarification ? { clarification: p.clarification } : {}),
      ...(p?.readinessStatus !== 'incomplete' && p?.readinessStatus !== 'needs_clarification' && p?.itemIds?.length && p.boardAction !== 'complete' && p.boardAction !== 'theme' ? { suggestedItemIds: p.itemIds } : {}),
      ...(p?.eventPlan ? { eventPlan: p.eventPlan } : {}),
      ...(p?.lookName ? { lookName: p.lookName } : {}),
      ...(p?.missingEssentials?.length ? { missingEssentials: p.missingEssentials } : {}),
      ...(p?.shopOutfit ? { shopOutfit: p.shopOutfit } : {}),
      // Reloaded trip plans are complete, never mid-stream — clear the pending flag.
      ...(p?.tripPlan ? { tripPlan: { ...p.tripPlan, pending: false } } : {}),
      ...(p?.wardrobeAudit ? { wardrobeAudit: p.wardrobeAudit } : {}),
      ...(p?.boardAction ? { boardAction: p.boardAction } : {}),
      ...responseExtras(p),
      ...(m.createdAt ? { createdAt: new Date(m.createdAt).getTime() } : {}),
    };
  });
}

export function timeAgo(iso: string): string {
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

export function detectOccasionHint(text: string): OccasionHint | undefined {
  for (const { hint, pattern } of OCCASION_PATTERNS) {
    if (pattern.test(text)) return hint;
  }
  return undefined;
}

export type EventContext = { id: number; title: string };
