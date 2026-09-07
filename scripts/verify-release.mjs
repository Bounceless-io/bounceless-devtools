/* global console, setTimeout */
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve('.');
const tarballs = (await readdir('packs')).filter(name => name.endsWith('.tgz')).sort();
if (tarballs.length !== 2) throw new Error(`expected two tarballs, got ${tarballs.length}`);
const scratchRoot = process.env.PAPERCLIP_RUN_SCRATCH_DIR ?? process.env.PAPERCLIP_SCRATCH_DIR ?? tmpdir();
const sandbox = await mkdtemp(join(scratchRoot, 'bounceless-r2-'));
const cache = join(sandbox, 'npm-cache');
const run = (args, cwd = sandbox, env = {}) => {
  const result = spawnSync(args[0], args.slice(1), { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${args.join(' ')} failed (${result.status})\n${result.stdout}\n${result.stderr}`);
  return result;
};
const runAsync = (args, cwd = sandbox, env = {}) => new Promise((resolveRun, rejectRun) => {
  const child = spawn(args[0], args.slice(1), { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('close', status => status === 0 ? resolveRun({ stdout, stderr }) : rejectRun(new Error(`${args.join(' ')} failed (${status})\n${stdout}\n${stderr}`)));
});
const captureAsync = (args, cwd = sandbox, env = {}) => new Promise(resolveRun => {
  const child = spawn(args[0], args.slice(1), { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('close', status => resolveRun({ status, stdout, stderr }));
});

for (const tarball of tarballs) {
  const full = resolve('packs', tarball);
  const manifest = JSON.parse(run(['npm', 'pack', '--dry-run', '--json', full], root).stdout)[0];
  if (!manifest.files.some(file => file.path === 'LICENSE')) throw new Error(`${tarball} omits LICENSE`);
  const notices = manifest.files.find(file => file.path === 'dist/THIRD-PARTY-NOTICES.txt');
  if (!notices || notices.size < 100) throw new Error(`${tarball} omits substantive third-party notices`);
  const sha256 = createHash('sha256').update(await readFile(full)).digest('hex');
  console.log(`${tarball} sha256=${sha256}`);
  console.log(manifest.files.map(file => file.path).sort().join('\n'));
}

const cli = resolve('packs/bounceless-cli-1.0.1.tgz');
const mcp = resolve('packs/bounceless-mcp-1.0.1.tgz');
run(['npm', 'init', '-y']);
run(['npm', 'install', '--cache', cache, '--ignore-scripts', cli, mcp]);
const installed = JSON.parse(await readFile(join(sandbox, 'node_modules/@bounceless/cli/package.json'), 'utf8'));
const installedMcp = JSON.parse(await readFile(join(sandbox, 'node_modules/@bounceless/mcp/package.json'), 'utf8'));
for (const pkg of [installed, installedMcp]) {
  if (Object.keys(pkg.dependencies ?? {}).some(name => name.includes('client'))) throw new Error(`${pkg.name} resolves an external client`);
}
for (const arg of ['--help', '--version']) {
  const result = run([join(sandbox, 'node_modules/.bin/bounceless'), arg], sandbox, { BOUNCELESS_API_KEY: '' });
  if (result.stderr !== '') throw new Error(`${arg} wrote stderr`);
  console.log(`cli ${arg}: exit=0 stderr=empty`);
}
const missing = spawnSync(join(sandbox, 'node_modules/.bin/bounceless-mcp'), [], { cwd: sandbox, env: { ...process.env, BOUNCELESS_API_KEY: '' }, encoding: 'utf8' });
if (missing.status !== 1 || !missing.stderr.includes('BOUNCELESS_API_KEY is required') || missing.stderr.includes(' at ')) throw new Error('MCP missing-key error is not concise');
console.log('mcp missing-key: exit=1 readable-error no-stack');

const server = createServer((request, response) => {
  if (request.url === '/v1/verify' && request.headers['x-api-key'] === 'synthetic-key') {
    response.writeHead(200, { 'content-type': 'application/json' }); response.end('{"status":"DELIVERABLE","requestId":"synthetic"}'); return;
  }
  response.writeHead(404); response.end('{}');
});
await new Promise(resolveReady => server.listen(0, '127.0.0.1', resolveReady));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const cliCall = await runAsync([join(sandbox, 'node_modules/.bin/bounceless'), 'verify', 'person@example.test'], sandbox, { BOUNCELESS_API_KEY: 'synthetic-key', BOUNCELESS_BASE_URL: baseUrl });
if (!cliCall.stdout.includes('DELIVERABLE')) throw new Error('CLI synthetic call failed');
console.log('cli verify: synthetic server call passed');

const attempts = new Map();
const rows = start => Array.from({ length: 5 }, (_, index) => ({
  index: start + index,
  decision: { action: 'send' },
  presend: { status: 'valid' },
  reasonCodes: ['smtp_accept'],
}));
const fixture = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://fixture');
  const id = url.pathname.split('/')[3] ?? '';
  const attempt = (attempts.get(id) ?? 0) + 1;
  attempts.set(id, attempt);
  const cursor = url.searchParams.get('cursor');
  const json = body => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); };
  if (id === 'normal') return json({ results: rows(cursor ? 5 : 0), finalized: Boolean(cursor), nextCursor: cursor ? null : 'page-2' });
  if (id === 'offset-201') {
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const count = offset === 0 ? 200 : 1;
    return json({ results: Array.from({ length: count }, (_, index) => ({ index: offset + index })), partial: offset === 0, finalized: offset !== 0, offset, limit: count });
  }
  if (id === 'truncated') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(cursor ? '{"results":[' : JSON.stringify({ results: rows(0), finalized: false, nextCursor: 'page-2' })); return;
  }
  if (id === 'shape') return json(cursor ? { finalized: false, nextCursor: 'page-3' } : { results: rows(0), finalized: false, nextCursor: 'page-2' });
  if (id === 'loop') return json({ results: rows(cursor ? 5 : 0), finalized: false, nextCursor: 'same' });
  if (id === 'transient-429' && attempt === 1) { response.writeHead(429, { 'retry-after': '0' }); response.end('{}'); return; }
  if (id === 'persistent-429') { response.writeHead(429, { 'retry-after': '0' }); response.end('{}'); return; }
  if (id === 'persistent-500') { response.writeHead(500); response.end('{}'); return; }
  if (id === 'transient-429') return json({ results: rows(cursor ? 5 : 0), finalized: Boolean(cursor), nextCursor: cursor ? null : 'page-2' });
  response.writeHead(404); response.end('{}');
});
await new Promise(resolveReady => fixture.listen(0, '127.0.0.1', resolveReady));
const fixtureAddress = fixture.address();
const fixtureEnv = { BOUNCELESS_API_KEY: 'synthetic-key', BOUNCELESS_BASE_URL: `http://127.0.0.1:${fixtureAddress.port}` };
const binary = join(sandbox, 'node_modules/.bin/bounceless');
const cliResult = async (id, format = 'json') => captureAsync([binary, 'batch', 'results', id, '--output', format], sandbox, fixtureEnv);
for (const format of ['json', 'csv']) {
  const result = await cliResult('normal', format);
  if (result.status !== 0 || result.stderr !== '' || (format === 'json' ? JSON.parse(result.stdout).results.length !== 10 : result.stdout.includes('[object Object]'))) {
    throw new Error(`normal ${format} fixture failed: ${JSON.stringify(result)}`);
  }
  if (format === 'csv' && (!result.stdout.includes('"{""action"":""send""}"') || !result.stdout.includes('"[""smtp_accept""]"'))) throw new Error('CSV nested cells are not JSON-parseable');
}
const offsetResult = await cliResult('offset-201');
const offsetRows = JSON.parse(offsetResult.stdout).results;
if (offsetResult.status !== 0 || offsetRows.length !== 201 || new Set(offsetRows.map(row => row.index)).size !== 201) throw new Error('offset 201 partial-to-final lost or duplicated rows');
for (const [id, code] of [['truncated', 'invalid_json'], ['shape', 'invalid_response'], ['loop', 'pagination_loop']]) {
  const result = await cliResult(id);
  if (result.status === 0 || result.stdout !== '' || !result.stderr.includes(code) || result.stderr.includes(' at ') || result.stderr.includes('synthetic-key')) {
    throw new Error(`${id} failure contract failed: ${JSON.stringify(result)}`);
  }
}
const recovered = await cliResult('transient-429');
if (recovered.status !== 0 || JSON.parse(recovered.stdout).results.length !== 10) throw new Error('transient 429 did not recover to 10 results');
for (const id of ['persistent-429', 'persistent-500']) {
  const result = await cliResult(id);
  if (result.status === 0 || result.stdout !== '' || (attempts.get(id) ?? 0) !== 3) throw new Error(`${id} retries were not bounded`);
}
fixture.close();
console.log('cli tarball fixtures: normal=10/10; offset=201/201 no loss/duplicates; invalid JSON/shape/loop nonzero; 429 recovery; persistent 429/500 bounded; JSON+CSV passed');

const child = spawn(join(sandbox, 'node_modules/.bin/bounceless-mcp'), [], { cwd: sandbox, env: { ...process.env, BOUNCELESS_API_KEY: 'synthetic-key', BOUNCELESS_BASE_URL: baseUrl }, stdio: ['pipe', 'pipe', 'pipe'] });
let buffer = ''; const replies = [];
child.stdout.setEncoding('utf8');
child.stdout.on('data', chunk => { buffer += chunk; for (;;) { const newline = buffer.indexOf('\n'); if (newline < 0) break; const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1); if (line.trim()) replies.push(JSON.parse(line)); } });
const send = message => child.stdin.write(`${JSON.stringify(message)}\n`);
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'r2-test', version: '1' } } });
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'verify_email', arguments: { email: 'person@example.test' } } });
const deadline = Date.now() + 5_000;
while (replies.filter(reply => reply.id).length < 3 && Date.now() < deadline) await new Promise(resolveWait => setTimeout(resolveWait, 20));
child.kill(); server.close();
const names = replies.find(reply => reply.id === 2)?.result?.tools?.map(tool => tool.name);
if (JSON.stringify(names) !== JSON.stringify(['verify_email', 'verify_batch', 'get_job', 'get_results'])) throw new Error(`unexpected tools: ${JSON.stringify(names)}`);
if (!replies.find(reply => reply.id === 3)?.result?.content?.[0]?.text?.includes('DELIVERABLE')) throw new Error('MCP synthetic tool call failed');
console.log(`mcp initialize/tools/list/call: ${names.join(',')} passed`);

const negative = join(sandbox, 'negative');
await mkdir(negative);
run(['npm', 'init', '-y'], negative);
const failed = spawnSync('npm', ['install', '--ignore-scripts', '@bounceless/client@1.0.0'], { cwd: negative, encoding: 'utf8' });
if (failed.status === 0) throw new Error('negative omitted-client install unexpectedly succeeded');
if (!`${failed.stdout}\n${failed.stderr}`.includes('E404')) throw new Error('negative omitted-client install did not fail with registry E404');
console.log('negative omitted @bounceless/client@1.0.0: failed as expected');
