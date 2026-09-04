import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BouncelessApiError, type BouncelessClient, type JsonObject } from '@bounceless/client';

const result = async (call: () => Promise<JsonObject>) => {
  try { const data = await call(); return { content: [{ type: 'text' as const, text: JSON.stringify(data) }], structuredContent: data }; }
  catch (cause) {
    if (!(cause instanceof BouncelessApiError)) throw cause;
    const data = { error: { status: cause.status, code: cause.code, message: cause.message, requestId: cause.requestId } };
    return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify(data) }], structuredContent: data };
  }
};
export function registerTools(server: McpServer, client: BouncelessClient): void {
  server.registerTool('verify_email', { description: 'Verify one email address.', inputSchema: { email: z.string().email() } }, ({email}) => result(() => client.verifyEmail(email)));
  server.registerTool('verify_batch', { description: 'Submit email addresses for batch verification.', inputSchema: { emails: z.array(z.string().email()).min(1).max(10000) } }, ({emails}) => result(() => client.verifyBatch(emails)));
  server.registerTool('get_job', { description: 'Get batch request status.', inputSchema: { request_id: z.string().min(1) } }, ({request_id}) => result(() => client.getJob(request_id)));
  server.registerTool('get_results', { description: 'Get batch request results.', inputSchema: { request_id: z.string().min(1) } }, ({request_id}) => result(() => client.getResults(request_id)));
}
