import { describe, expect, it } from 'vitest';
import { registerTools } from '../src/tools.js';
describe('MCP surface', () => it('registers exactly four GA tools', () => {
  const names: string[] = []; const server = { registerTool: (name: string) => names.push(name) };
  registerTools(server as never, {} as never);
  expect(names).toEqual(['verify_email','verify_batch','get_job','get_results']);
}));
