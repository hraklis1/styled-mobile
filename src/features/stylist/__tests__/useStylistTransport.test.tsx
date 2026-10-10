import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useEffect } from 'react';
import { useStylistTransport } from '../hooks/useStylistTransport';
import type { StylistTransportCallbacks } from '../types';
import { fetch } from 'expo/fetch';
const { TextDecoder, TextEncoder } = jest.requireActual('node:util');
Object.assign(globalThis, { TextDecoder, TextEncoder });

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../../../lib/api', () => ({ API_BASE_URL: 'http://test', getAccessToken: () => 'token' }));
jest.mock('../../profilePrompts/signals', () => ({ recordPromptSignal: jest.fn() }));

let transport: ReturnType<typeof useStylistTransport>;
function Host({ callbacks }: { callbacks: StylistTransportCallbacks }) {
  const current = useStylistTransport(callbacks);
  useEffect(() => { transport = current; }, [current]);
  return null;
}
function stream(frames: string[]) {
  let index = 0;
  return { ok: true, body: { getReader: () => ({ read: async () => index < frames.length ? { value: new TextEncoder().encode(frames[index++]), done: false } : { done: true }, cancel: jest.fn() }) } };
}

test('negotiates v2 and delivers split SSE blocks in order before done', async () => {
  const events: string[] = [];
  const callbacks = { onAssistantStart: () => events.push('start'), onBlock: (_: string, index: number) => events.push(`block:${index}`), onAssistantDone: () => events.push('done'), onError: jest.fn() };
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<Host callbacks={callbacks} />); });
  (fetch as jest.Mock).mockResolvedValue(stream([
    'event: blo',
    'ck\ndata: {"responseVersion":2,"index":0,"block":{"type":"text","text":"First"}}\n\nevent: block\ndata: {"responseVersion":2,"index":1,"block":{"type":"card","text":"Next","payload":{"mode":"advice","itemIds":[1]}}}\n\n',
    'event: done\ndata: {"responseVersion":2,"blocks":[],"transcript":"hello","responseText":"First"}\n\n',
  ]));
  await act(async () => { await transport.sendMessage({ assistantMessageId: 'a', request: { text: 'hello' } }); });
  expect(events).toEqual(['start', 'block:0', 'block:1', 'done']);
  expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).capabilities).toEqual(['stylist_blocks_v2']);
  expect(callbacks.onError).not.toHaveBeenCalled();
  await act(async () => renderer.unmount());
});

test('legacy token events still work; interrupted streams report an error', async () => {
  const callbacks = { onAssistantToken: jest.fn(), onAssistantDone: jest.fn(), onError: jest.fn() };
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<Host callbacks={callbacks} />); });
  (fetch as jest.Mock).mockResolvedValue(stream(['event: token\ndata: {"t":"Hi"}\n\nevent: done\ndata: {"transcript":"hello","responseText":"Hi"}\n\n']));
  await act(async () => { await transport.sendMessage({ assistantMessageId: 'a', request: { text: 'hello' } }); });
  expect(callbacks.onAssistantToken).toHaveBeenCalledWith('a', 'Hi');
  expect(callbacks.onAssistantDone).toHaveBeenCalledTimes(1);
  (fetch as jest.Mock).mockResolvedValue(stream(['event: block\ndata: {"responseVersion":2,"index":0,"block":{"type":"text","text":"partial"}}\n\n']));
  await act(async () => { await transport.sendMessage({ assistantMessageId: 'b', request: { text: 'hello' } }); });
  expect(callbacks.onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('interrupted') }));
  await act(async () => renderer.unmount());
});
