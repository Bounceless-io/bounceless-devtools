#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BouncelessClient } from '@bounceless/client';
import { registerTools } from './tools.js';
const client = new BouncelessClient({ apiKey: process.env.BOUNCELESS_API_KEY ?? '' });
const server = new McpServer({ name: '@bounceless/mcp', version: '1.0.0' });
registerTools(server, client);
await server.connect(new StdioServerTransport());
