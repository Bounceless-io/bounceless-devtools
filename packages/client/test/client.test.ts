import { describe, expect, it } from 'vitest';
import { BouncelessClient } from '../src/index.js';
describe('client', () => {
  it('defaults to the public API and authenticates only with the API key', async () => {
    let input = ''; let init: RequestInit | undefined;
    const client = new BouncelessClient({ apiKey: 'synthetic-key', fetchImpl: async (i, x) => { input=i; init=x; return new Response('{"ok":true}'); } });
    await client.verifyEmail('person@example.test');
    expect(input).toBe('https://api.bounceless.io/v1/verify');
    expect((init?.headers as Record<string,string>).Authorization).toBe('Bearer synthetic-key');
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
});
