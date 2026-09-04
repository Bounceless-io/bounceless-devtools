import { randomUUID } from 'node:crypto';

export type JsonObject = Record<string, unknown>;
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class BouncelessApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly requestId: string | null) {
    super(message); this.name = 'BouncelessApiError';
  }
  get retryable(): boolean { return this.status === 0 || this.status === 429 || this.status >= 500; }
}

export interface BouncelessClientOptions { apiKey: string; baseUrl?: string; fetchImpl?: FetchLike }

export class BouncelessClient {
  readonly #apiKey: string; readonly #baseUrl: string; readonly #fetch: FetchLike;
  constructor(options: BouncelessClientOptions) {
    if (!options.apiKey.trim()) throw new Error('BOUNCELESS_API_KEY is required');
    this.#apiKey = options.apiKey; this.#baseUrl = (options.baseUrl ?? 'https://api.bounceless.io').replace(/\/$/, '');
    this.#fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }
  verifyEmail(email: string): Promise<JsonObject> { return this.#request('POST', '/v1/verify', { email }); }
  verifyBatch(emails: string[]): Promise<JsonObject> { return this.#request('POST', '/v1/requests', { emails }); }
  getJob(id: string): Promise<JsonObject> { return this.#request('GET', `/v1/requests/${encodeURIComponent(id)}`); }
  async getResults(id: string): Promise<JsonObject> {
    const path = `/v1/requests/${encodeURIComponent(id)}/results`;
    const first = await this.#request('GET', path, undefined, { limit: '200' });
    const results = Array.isArray(first.results) ? [...first.results] : [];
    let cursor = typeof first.nextCursor === 'string' ? first.nextCursor : null;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const page = await this.#request('GET', path, undefined, { limit: '200', cursor });
      if (Array.isArray(page.results)) results.push(...page.results);
      cursor = typeof page.nextCursor === 'string' ? page.nextCursor : null;
    }
    return { ...first, results, limit: results.length, nextCursor: cursor };
  }
  async #request(method: string, path: string, body?: JsonObject, query?: Record<string, string>): Promise<JsonObject> {
    const headers: Record<string,string> = { Authorization: `Bearer ${this.#apiKey}`, Accept: 'application/json' };
    const init: RequestInit = { method, headers };
    if (body) { headers['Content-Type'] = 'application/json'; headers['Idempotency-Key'] = randomUUID(); init.body = JSON.stringify(body); }
    let response: Response;
    const suffix = query ? `?${new URLSearchParams(query).toString()}` : '';
    try { response = await this.#fetch(this.#baseUrl + path + suffix, init); }
    catch (cause) { throw new BouncelessApiError(0, 'network_error', cause instanceof Error ? cause.message : String(cause), null); }
    const text = await response.text(); let data: JsonObject = {};
    try { data = text ? JSON.parse(text) as JsonObject : {}; } catch { data = {}; }
    if (!response.ok) {
      const error = typeof data.error === 'object' && data.error ? data.error as JsonObject : {};
      throw new BouncelessApiError(response.status, typeof error.code === 'string' ? error.code : 'http_error', typeof error.message === 'string' ? error.message : `HTTP ${response.status}`, typeof error.requestId === 'string' ? error.requestId : null);
    }
    return data;
  }
}
