import { describe, expect, it } from 'vitest';
import { BouncelessApiError, BouncelessClient } from '../src/index.js';
describe('client', () => {
  it('defaults to the public API and authenticates only with the API key', async () => {
    let input = ''; let init: RequestInit | undefined;
    const client = new BouncelessClient({ apiKey: 'synthetic-key', fetchImpl: async (i, x) => { input=i; init=x; return new Response('{"ok":true}'); } });
    await client.verifyEmail('person@example.test');
    expect(input).toBe('https://api.bounceless.io/v1/verify');
    expect((init?.headers as Record<string,string>)['X-Api-Key']).toBe('synthetic-key');
    expect((init?.headers as Record<string,string>).Authorization).toBeUndefined();
  });
  it('follows every results cursor instead of silently returning the first page', async () => {
    const urls: string[] = [];
    const client = new BouncelessClient({ apiKey: 'synthetic-key', fetchImpl: async input => {
      urls.push(input);
      return new Response(urls.length === 1
        ? '{"results":[{"email":"one@example.test"}],"nextCursor":"page-2"}'
        : '{"results":[{"email":"two@example.test"}],"nextCursor":null}');
    } });
    const response = await client.getResults('request/with slash');
    expect(response.results).toEqual([{ email: 'one@example.test' }, { email: 'two@example.test' }]);
    expect(urls).toEqual([
      'https://api.bounceless.io/v1/requests/request%2Fwith%20slash/results?limit=200',
      'https://api.bounceless.io/v1/requests/request%2Fwith%20slash/results?limit=200&cursor=page-2',
    ]);
  });
  it('supports offset compatibility for 201 results', async () => {
    const urls: string[] = [];
    const client = new BouncelessClient({ apiKey: 'synthetic-key', fetchImpl: async input => {
      urls.push(input);
      const count = urls.length === 1 ? 200 : 1;
      return new Response(JSON.stringify({ jobId: 'request-201', results: Array.from({ length: count }, (_, index) => ({ index: (urls.length - 1) * 200 + index })), limit: count, offset: (urls.length - 1) * 200, partial: urls.length === 1, finalized: urls.length === 2, requestId: `page-${urls.length}` }));
    } });
    const response = await client.getResults('request-201');
    expect((response.results as unknown[])).toHaveLength(201);
    expect(urls[1]).toContain('offset=200');
    expect(response).toMatchObject({ limit: 1, offset: 200, partial: false, finalized: true, requestId: 'page-2' });
    expect(response).not.toHaveProperty('nextCursor');
  });
  it('bounds 429 Retry-After delays and retry attempts', async () => {
    const delays: number[] = []; let attempts = 0;
    const client = new BouncelessClient({ apiKey: 'synthetic-key', maxRetries: 2, maxRetryDelayMs: 25, sleepImpl: async delay => { delays.push(delay); }, fetchImpl: async () => {
      attempts += 1;
      return attempts < 3 ? new Response('{"error":{"code":"limited","message":"wait"}}', { status: 429, headers: { 'Retry-After': '99' } }) : new Response('{"ok":true}');
    } });
    expect(await client.getJob('request-1')).toEqual({ ok: true });
    expect(attempts).toBe(3);
    expect(delays).toEqual([25, 25]);
  });
  it('uses exponential backoff when Retry-After is absent', async () => {
    const delays: number[] = []; let attempts = 0;
    const client = new BouncelessClient({ apiKey: 'synthetic-key', maxRetries: 2, sleepImpl: async delay => { delays.push(delay); }, fetchImpl: async () => {
      attempts += 1;
      return attempts < 3 ? new Response('{}', { status: 503 }) : new Response('{"ok":true}');
    } });
    expect(await client.getJob('request-1')).toEqual({ ok: true });
    expect(delays).toEqual([100, 200]);
  });
  it.each([
    ['truncated JSON', '{"results":['],
    ['an unexpected results shape', '{"finalized":false,"nextCursor":"page-3"}'],
  ])('rejects %s after a valid first page', async (_name, secondBody) => {
    let calls = 0;
    const client = new BouncelessClient({ apiKey: 'synthetic-key', fetchImpl: async () => new Response(++calls === 1
      ? '{"results":[{"index":1}],"finalized":false,"nextCursor":"page-2"}'
      : secondBody) });
    await expect(client.getResults('request-bad')).rejects.toBeInstanceOf(BouncelessApiError);
  });
  it('rejects a repeated cursor instead of treating it as EOF', async () => {
    let calls = 0;
    const client = new BouncelessClient({ apiKey: 'synthetic-key', fetchImpl: async () => new Response(++calls === 1
      ? '{"results":[{"index":1}],"nextCursor":"same"}'
      : '{"results":[{"index":2}],"nextCursor":"same"}') });
    await expect(client.getResults('request-loop')).rejects.toMatchObject({ code: 'pagination_loop' });
  });
});
