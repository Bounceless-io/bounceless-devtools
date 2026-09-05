import { build } from 'esbuild';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageName = process.argv[2];
if (!['cli', 'mcp'].includes(packageName)) throw new Error('usage: build-package.mjs <cli|mcp>');
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = join(repositoryRoot, 'packages', packageName);
const result = await build({
  entryPoints: [join(packageRoot, 'src/bin.ts')],
  outfile: join(packageRoot, 'dist/bin.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  metafile: true,
});

const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes('node_modules')) continue;
  let directory = dirname(resolve(input));
  for (;;) {
    try {
      const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      if (manifest.name && manifest.version) {
        packages.set(`${manifest.name}@${manifest.version}`, { directory, manifest });
        break;
      }
      directory = dirname(directory);
    } catch {
      const parent = dirname(directory);
      if (parent === directory) throw new Error(`cannot locate package metadata for ${input}`);
      directory = parent;
    }
  }
}

const sections = [];
for (const [key, value] of [...packages].sort(([left], [right]) => left.localeCompare(right))) {
  const licenseName = (await readdir(value.directory)).find(name => /^(licen[cs]e|copying)(\.|$)/i.test(name));
  if (!licenseName) throw new Error(`bundled dependency ${key} has no license file`);
  sections.push(`${key}\nDeclared license: ${value.manifest.license ?? 'see text below'}\n\n${(await readFile(join(value.directory, licenseName), 'utf8')).trim()}`);
}
await writeFile(join(packageRoot, 'dist/THIRD-PARTY-NOTICES.txt'), `Third-party software bundled in @bounceless/${packageName}\n\n${sections.join('\n\n---\n\n')}\n`);
