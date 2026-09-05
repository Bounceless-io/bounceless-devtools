import { randomUUID } from 'node:crypto';

export type JsonObject = Record<string, unknown>;
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class BouncelessApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly requestId: string | null) {
    super(message); this.name = 'BouncelessApiError';
  }
  get retryable(): boolean { return this.status === 0 || this.status === 429 || this.status >= 500; }
}

export interface BouncelessClientOptions {
  apiKey: string; baseUrl?: string; fetchImpl?: FetchLike;
  maxRetries?: number; maxRetryDelayMs?: number; maxPages?: number;
  sleepImpl?: (milliseconds: number) => Promise<void>;
}

export class BouncelessClient {
  readonly #apiKey: string; readonly #baseUrl: string; readonly #fetch: FetchLike;
  readonly #maxRetries: number; readonly #maxRetryDelayMs: number; readonly #maxPages: number;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  constructor(options: BouncelessClientOptions) {
    if (!options.apiKey.trim()) throw new Error('BOUNCELESS_API_KEY is required');
    this.#apiKey = options.apiKey; this.#baseUrl = (options.baseUrl ?? 'https://api.bounceless.io').replace(/\/$/, '');
    this.#fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.#maxRetries = options.maxRetries ?? 2;
    this.#maxRetryDelayMs = options.maxRetryDelayMs ?? 2_000;
    this.#maxPages = options.maxPages ?? 1_000;
    this.#sleep = options.sleepImpl ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  }
  verifyEmail(email: string): Promise<JsonObject> { return this.#request('POST', '/v1/verify', { email }); }
  verifyBatch(emails: string[]): Promise<JsonObject> { return this.#request('POST', '/v1/requests', { emails }); }
  getJob(id: string): Promise<JsonObject> { return this.#request('GET', `/v1/requests/${encodeURIComponent(id)}`); }
  async getResults(id: string): Promise<JsonObject> {
    const path = `/v1/requests/${encodeURIComponent(id)}/results`;
    const pageSize = 200;
    const first = await this.#request('GET', path, undefined, { limit: String(pageSize) });
    const results = Array.isArray(first.results) ? [...first.results] : [];
    let cursor = typeof first.nextCursor === 'string' ? first.nextCursor : null;
    let offset = results.length;
    let pageCount = 1;
    const seen = new Set<string>();
    let page = first;
    while (pageCount < this.#maxPages) {
      const hasCursorContract = Object.hasOwn(page, 'nextCursor');
      if (hasCursorContract && !cursor) break;
      if (cursor && seen.has(cursor)) break;
      const previousCount = Array.isArray(page.results) ? page.results.length : 0;
      if (!hasCursorContract && previousCount < pageSize) break;
      const query: Record<string, string> = cursor ? { limit: String(pageSize), cursor } : { limit: String(pageSize), offset: String(offset) };
      if (cursor) seen.add(cursor);
      page = await this.#request('GET', path, undefined, query);
      if (Array.isArray(page.results)) results.push(...page.results);
      offset += Array.isArray(page.results) ? page.results.length : 0;
      cursor = typeof page.nextCursor === 'string' ? page.nextCursor : null;
      pageCount += 1;
    }
    if (pageCount >= this.#maxPages && (cursor || (Array.isArray(page.results) && page.results.length === pageSize))) {
      throw new BouncelessApiError(0, 'pagination_limit', `Result pagination exceeded ${this.#maxPages} pages`, null);
    }
    return { ...first, results, limit: results.length, nextCursor: cursor };
  }
  async #request(method: string, path: string, body?: JsonObject, query?: Record<string, string>): Promise<JsonObject> {
    const headers: Record<string,string> = { 'X-Api-Key': this.#apiKey, Accept: 'application/json' };
    const init: RequestInit = { method, headers };
    if (body) { headers['Content-Type'] = 'application/json'; headers['Idempotency-Key'] = randomUUID(); init.body = JSON.stringify(body); }
    const suffix = query ? `?${new URLSearchParams(query).toString()}` : '';
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try { response = await this.#fetch(this.#baseUrl + path + suffix, init); }
      catch (cause) {
        if (attempt < this.#maxRetries) { await this.#sleep(Math.min(100 * 2 ** attempt, this.#maxRetryDelayMs)); continue; }
        throw new BouncelessApiError(0, 'network_error', cause instanceof Error ? cause.message : String(cause), null);
      }
      const text = await response.text(); let data: JsonObject = {};
      try { data = text ? JSON.parse(text) as JsonObject : {}; } catch { data = {}; }
      if (response.ok) return data;
      const error = typeof data.error === 'object' && data.error ? data.error as JsonObject : {};
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < this.#maxRetries) {
        const seconds = Number(response.headers.get('retry-after'));
        const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : 100 * 2 ** attempt;
        await this.#sleep(Math.min(delay, this.#maxRetryDelayMs));
        continue;
      }
      throw new BouncelessApiError(response.status, typeof error.code === 'string' ? error.code : 'http_error', typeof error.message === 'string' ? error.message : `HTTP ${response.status}`, typeof error.requestId === 'string' ? error.requestId : null);
    }
  }
}
