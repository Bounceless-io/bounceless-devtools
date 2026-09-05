import { cp, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

await rm('packs', { recursive: true, force: true });
await mkdir('packs', { recursive: true });
await Promise.all(['cli', 'mcp'].map(name => cp('LICENSE', `packages/${name}/LICENSE`)));
for (const command of [
  ['pnpm', ['install', '--frozen-lockfile']],
  ['pnpm', ['test']],
  ['pnpm', ['typecheck']],
  ['pnpm', ['--filter', '@bounceless/cli', 'build']],
  ['pnpm', ['--filter', '@bounceless/mcp', 'build']],
]) {
  const result = spawnSync(command[0], command[1], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
for (const name of ['cli', 'mcp']) {
  const result = spawnSync('pnpm', ['pack', '--pack-destination', '../../packs'], { cwd: `packages/${name}`, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
