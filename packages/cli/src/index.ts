import { readFile } from 'node:fs/promises';
import { Command, CommanderError } from 'commander';
import { BouncelessApiError, BouncelessClient, type JsonObject } from '@bounceless/client';
export interface Io { stdout(value: string): void; stderr(value: string): void }
const defaultIo: Io = { stdout: value => process.stdout.write(value + '\n'), stderr: value => process.stderr.write(value + '\n') };
const csvEmails = (input: string): string[] => input.split(/\r?\n/).map(line => line.split(',')[0]?.trim() ?? '').filter((v, i) => Boolean(v) && !(i === 0 && v.toLowerCase() === 'email'));
const csvResults = (data: JsonObject): string => {
  const rows = Array.isArray(data.results) ? data.results as JsonObject[] : [];
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const quote = (value: unknown) => {
    const serialized = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    return `"${serialized.replaceAll('"', '""')}"`;
  };
  return [keys.join(','), ...rows.map(row => keys.map(k => quote(row[k])).join(','))].join('\n');
};
export function createProgram(client: BouncelessClient, io: Io = defaultIo): Command {
  const program = new Command().name('bounceless').description('Bounceless email verification CLI').version('1.0.0').exitOverride().configureOutput({ writeOut: s => io.stdout(s.trimEnd()), writeErr: s => io.stderr(s.trimEnd()) });
  program.command('verify <email>').action(async email => io.stdout(JSON.stringify(await client.verifyEmail(email))));
  const batch = program.command('batch');
  batch.command('submit <file>').action(async file => io.stdout(JSON.stringify(await client.verifyBatch(csvEmails(await readFile(file, 'utf8'))))));
  batch.command('status <request-id>').action(async id => io.stdout(JSON.stringify(await client.getJob(id))));
  batch.command('results <request-id>').option('--output <format>', 'json or csv', 'json').action(async (id: string, options: { output: string }) => {
    if (!['json', 'csv'].includes(options.output)) throw new CommanderError(2, 'commander.invalidArgument', '--output must be json or csv');
    const data = await client.getResults(id);
    io.stdout(options.output === 'csv' ? csvResults(data) : JSON.stringify(data));
  });
  return program;
}
export async function run(argv: string[], env = process.env, io: Io = defaultIo): Promise<number> {
  try {
    const informational = argv.some(value => ['-h', '--help', '-V', '--version'].includes(value));
    await createProgram(new BouncelessClient({ apiKey: informational ? 'help-only' : env.BOUNCELESS_API_KEY ?? '', baseUrl: env.BOUNCELESS_BASE_URL }), io).parseAsync(argv, { from: 'user' }); return 0;
  }
  catch (cause) {
    if (cause instanceof CommanderError && cause.exitCode === 0) return 0;
    if (cause instanceof CommanderError || (cause instanceof Error && cause.message.includes('BOUNCELESS_API_KEY'))) { io.stderr(cause.message); return 2; }
    if (cause instanceof BouncelessApiError) { io.stderr(JSON.stringify({ error: { code: cause.code, message: cause.message, requestId: cause.requestId } })); return cause.status === 401 || cause.status === 402 || cause.status === 403 || cause.status === 429 ? 3 : cause.retryable ? 4 : 5; }
    io.stderr(cause instanceof Error ? cause.message : String(cause)); return 5;
  }
}
export { csvEmails, csvResults };
