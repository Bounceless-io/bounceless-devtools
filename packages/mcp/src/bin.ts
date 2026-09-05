#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BouncelessClient } from '@bounceless/client';
import { registerTools } from './tools.js';
async function main(): Promise<void> {
  const client = new BouncelessClient({ apiKey: process.env.BOUNCELESS_API_KEY ?? '', baseUrl: process.env.BOUNCELESS_BASE_URL });
  const server = new McpServer(
    { name: '@bounceless/mcp', version: '1.0.0' },
    { instructions: 'Use verify_email for one synthetic address; use verify_batch, get_job, then get_results for batches. Results may be partial until finalized.' },
  );
  registerTools(server, client);
  await server.connect(new StdioServerTransport());
}
void main().catch(cause => { process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`); process.exitCode = 1; });
