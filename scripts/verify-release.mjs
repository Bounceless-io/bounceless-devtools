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

for (const tarball of tarballs) {
  const full = resolve('packs', tarball);
  const manifest = JSON.parse(run(['npm', 'pack', '--dry-run', '--json', full], root).stdout)[0];
  if (!manifest.files.some(file => file.path === 'LICENSE')) throw new Error(`${tarball} omits LICENSE`);
  const sha256 = createHash('sha256').update(await readFile(full)).digest('hex');
  console.log(`${tarball} sha256=${sha256}`);
  console.log(manifest.files.map(file => file.path).sort().join('\n'));
}

const cli = resolve('packs/bounceless-cli-1.0.0.tgz');
const mcp = resolve('packs/bounceless-mcp-1.0.0.tgz');
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
const failed = spawnSync('npm', ['install', '--offline', '--cache', join(sandbox, 'empty-cache'), '@bounceless/client@1.0.0'], { cwd: negative, encoding: 'utf8' });
if (failed.status === 0) throw new Error('negative omitted-client install unexpectedly succeeded');
console.log('negative omitted @bounceless/client@1.0.0: failed as expected');
