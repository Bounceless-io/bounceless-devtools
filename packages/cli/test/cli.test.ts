import { afterEach, describe, expect, it, vi } from 'vitest';
import { BouncelessClient } from '@bounceless/client';
import { createProgram, csvEmails, csvResults, run } from '../src/index.js';
describe('CLI', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('parses a synthetic CSV', () => expect(csvEmails('email\nperson@example.test')).toEqual(['person@example.test']));
  it('serializes nested decision and presend result fields as JSON in CSV', () => {
    const csv = csvResults({ results: [{
      email: 'person@example.test',
      decision: { action: 'send', reason: 'deliverable' },
      presend: { status: 'valid', score: 0.99 },
    }] });

    expect(csv).not.toContain('[object Object]');
    expect(csv).toContain('"{""action"":""send"",""reason"":""deliverable""}"');
    expect(csv).toContain('"{""status"":""valid"",""score"":0.99}"');
  });
  it('exposes the four exact leaf commands', () => {
    const program = createProgram(new BouncelessClient({ apiKey: 'synthetic' }));
    expect(program.commands.map(c => c.name())).toEqual(['verify','batch']);
    expect(program.commands[1]?.commands.map(c => c.name())).toEqual(['submit','status','results']);
  });
  it('returns usage code 2 for a missing key and invalid output', async () => {
    const io = { stdout: vi.fn(), stderr: vi.fn() };
    expect(await run(['verify', 'person@example.test'], {}, io)).toBe(2);
    expect(await run(['batch', 'results', 'request-1', '--output', 'xml'], { BOUNCELESS_API_KEY: 'synthetic' }, io)).toBe(2);
  });
  it.each([['--help'], ['--version']])('prints %s without a key on stdout only', async argument => {
    const io = { stdout: vi.fn(), stderr: vi.fn() };
    expect(await run([argument], {}, io)).toBe(0);
    expect(io.stdout).toHaveBeenCalled();
    expect(io.stderr).not.toHaveBeenCalled();
  });
  it.each([401, 402, 403, 429])('returns auth/credits/quota code 3 for HTTP %i', async status => {
    vi.stubGlobal('fetch', async () => new Response('{"error":{"code":"denied","message":"denied"}}', { status }));
    expect(await run(['verify', 'person@example.test'], { BOUNCELESS_API_KEY: 'synthetic' }, { stdout: vi.fn(), stderr: vi.fn() })).toBe(3);
  });
  it('returns retryable code 4 for a remote 5xx', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 503 }));
    expect(await run(['verify', 'person@example.test'], { BOUNCELESS_API_KEY: 'synthetic' }, { stdout: vi.fn(), stderr: vi.fn() })).toBe(4);
  });
  it('returns terminal code 5 for a remote non-auth 4xx', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 422 }));
    expect(await run(['verify', 'person@example.test'], { BOUNCELESS_API_KEY: 'synthetic' }, { stdout: vi.fn(), stderr: vi.fn() })).toBe(5);
  });
});
