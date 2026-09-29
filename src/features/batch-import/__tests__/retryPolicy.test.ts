import { backoffDelay, classifyError, MAX_AUTO_ATTEMPTS } from '../retryPolicy';

const httpError = (status: number, data: Record<string, unknown> = {}, headers: Record<string, string> = {}) => ({
  isAxiosError: true,
  response: { status, data, headers },
});
const networkError = { isAxiosError: true, message: 'Network Error' };
const noJitter = () => 0.5;

describe('classifyError', () => {
  it('retries a dropped connection with growing backoff, then gives up', () => {
    const first = classifyError(networkError, 1, noJitter);
    const second = classifyError(networkError, 2, noJitter);
    expect(first).toEqual({ kind: 'retry', delayMs: 2000, countsAttempt: true });
    expect(second).toEqual({ kind: 'retry', delayMs: 4000, countsAttempt: true });
    expect(classifyError(networkError, MAX_AUTO_ATTEMPTS, noJitter)).toMatchObject({ kind: 'fail' });
  });

  it('treats 5xx and the budget breaker 503 as transient', () => {
    expect(classifyError(httpError(500), 1, noJitter).kind).toBe('retry');
    expect(classifyError(httpError(503, { code: 'CAPACITY' }), 1, noJitter).kind).toBe('retry');
    expect(classifyError(httpError(408), 1, noJitter).kind).toBe('retry');
  });

  it('waits out a 429 for as long as the server asks, without spending an attempt', () => {
    const decision = classifyError(httpError(429, {}, { 'retry-after': '7' }), 3, noJitter);
    expect(decision).toEqual({ kind: 'retry', delayMs: 7000, countsAttempt: false });
  });

  it('falls back to the body retryAfterMs, then a default, for a 429', () => {
    expect(classifyError(httpError(429, { meta: { retryAfterMs: 1200 } }), 1)).toMatchObject({ delayMs: 1200 });
    expect(classifyError(httpError(429), 1)).toMatchObject({ kind: 'retry', delayMs: 5000 });
  });

  it('blocks the whole queue when credits run out, instead of retrying', () => {
    expect(classifyError(httpError(402, { code: 'INSUFFICIENT_CREDITS', message: 'Out' }), 1)).toEqual({
      kind: 'block',
      reason: 'credits',
      message: 'Out',
    });
    expect(classifyError(httpError(402, { code: 'FREE_LIMIT_REACHED' }), 1)).toMatchObject({
      kind: 'block',
      reason: 'free_limit',
    });
  });

  it('fails other 4xx immediately — resending the same request changes nothing', () => {
    expect(classifyError(httpError(400, { message: 'imageBase64 required' }), 1)).toEqual({
      kind: 'fail',
      message: 'imageBase64 required',
    });
  });

  it('reads the status a native upload attaches to its error', () => {
    const uploadError = Object.assign(new Error('R2 upload failed: 403'), { status: 403 });
    expect(classifyError(uploadError, 1).kind).toBe('fail');
    const flaky = Object.assign(new Error('R2 upload failed: 502'), { status: 502 });
    expect(classifyError(flaky, 1).kind).toBe('retry');
  });
});

describe('backoffDelay', () => {
  it('caps the delay and jitters within ±25%', () => {
    expect(backoffDelay(10, noJitter)).toBe(15000);
    expect(backoffDelay(1, () => 0)).toBe(1500);
    expect(backoffDelay(1, () => 1)).toBe(2500);
  });
});
