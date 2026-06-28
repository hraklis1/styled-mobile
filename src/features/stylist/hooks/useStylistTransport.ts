import { useCallback, useEffect, useRef, useState } from 'react';

import { API_BASE_URL, getAccessToken } from '../../../lib/api';
import type {
  StylistAskDoneEvent,
  StylistTransportCallbacks,
  StylistTransportSendInput,
  StylistTripOutfit,
  StylistTtsReadyEvent,
} from '../types';

const STYLIST_ERROR_MESSAGE = 'Could not reach the stylist. Please try again.';
const TOKEN_FLUSH_MS = 32;

function errorMessageFromUnknown(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return STYLIST_ERROR_MESSAGE;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError'
  ) || (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function parseSseJson(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line);
    return typeof parsed === 'object' && parsed !== null
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function useStylistTransport(callbacks: StylistTransportCallbacks = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const callbacksRef = useRef(callbacks);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const abortCurrent = useCallback(() => {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const sendMessage = useCallback(async (input: StylistTransportSendInput) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);

    let pendingText = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let assistantStarted = false;
    let finalResponseText = '';
    let ttsReceivedFromStream = false;

    const isCurrentRequest = () => requestIdRef.current === requestId;

    const clearFlushTimer = () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    };

    const flushPending = () => {
      const token = pendingText;
      pendingText = '';
      flushTimer = null;
      if (!token || !isCurrentRequest()) return;
      callbacksRef.current.onAssistantToken?.(input.assistantMessageId, token);
    };

    const scheduleFlush = () => {
      if (!flushTimer) {
        flushTimer = setTimeout(flushPending, TOKEN_FLUSH_MS);
      }
    };

    const handleToken = (token: string) => {
      if (!assistantStarted) {
        assistantStarted = true;
        callbacksRef.current.onAssistantStart?.(input.assistantMessageId);
      }
      pendingText += token;
      scheduleFlush();
    };

    const handleDone = (event: StylistAskDoneEvent) => {
      clearFlushTimer();
      flushPending();
      finalResponseText = event.responseText ?? '';
      const conversationId = event.conversationId;
      if (typeof conversationId === 'number') {
        callbacksRef.current.onConversationResolved?.(conversationId);
      }
      callbacksRef.current.onAssistantDone?.(input.assistantMessageId, event);
    };

    const processSseLine = (rawLine: string, currentEventRef: { current: string }) => {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      if (!line || line.startsWith(':')) return;

      if (line.startsWith('event:')) {
        currentEventRef.current = line.slice(6).trim();
        return;
      }

      if (!line.startsWith('data:')) return;

      const parsed = parseSseJson(line.slice(5).trim());
      if (!parsed) {
        currentEventRef.current = '';
        return;
      }

      if (currentEventRef.current === 'error') {
        throw new Error(typeof parsed.message === 'string' ? parsed.message : STYLIST_ERROR_MESSAGE);
      }

      if (currentEventRef.current === 'done') {
        handleDone(parsed as StylistAskDoneEvent);
      } else if (currentEventRef.current === 'trip_outfit') {
        callbacksRef.current.onTripOutfit?.(
          input.assistantMessageId,
          parsed as unknown as StylistTripOutfit,
        );
      } else if (currentEventRef.current === 'tts_ready') {
        ttsReceivedFromStream = true;
        callbacksRef.current.onTtsReady?.(
          input.assistantMessageId,
          parsed as StylistTtsReadyEvent,
        );
      } else if (typeof parsed.t === 'string') {
        handleToken(parsed.t);
      }

      currentEventRef.current = '';
    };

    try {
      const token = getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/stylist/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...input.request, _stream: true }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(errData.message ?? STYLIST_ERROR_MESSAGE);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let sseBuffer = '';
      const currentEventRef = { current: '' };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (!isCurrentRequest()) {
          reader.cancel().catch(() => {});
          break;
        }

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!isCurrentRequest()) break;
          processSseLine(line, currentEventRef);
        }
      }

      sseBuffer += decoder.decode();
      if (isCurrentRequest() && sseBuffer.trim()) {
        processSseLine(sseBuffer, currentEventRef);
      }

      if (
        isCurrentRequest() &&
        input.shouldFetchTtsFallback &&
        !ttsReceivedFromStream &&
        finalResponseText
      ) {
        callbacksRef.current.onTtsFallbackNeeded?.(input.assistantMessageId, finalResponseText);
      }
    } catch (error) {
      clearFlushTimer();
      if (!isCurrentRequest() || isAbortError(error)) return;
      callbacksRef.current.onError?.({
        message: errorMessageFromUnknown(error),
        request: input,
        error,
      });
    } finally {
      clearFlushTimer();
      if (isCurrentRequest()) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, []);

  return {
    isLoading,
    sendMessage,
    abortCurrent,
  };
}
