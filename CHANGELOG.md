# Changelog

## 1.0.0 candidate

- Ship autonomous CLI and MCP tarballs with the shared HTTP client embedded.
- Use canonical `X-Api-Key` authentication, bounded retries, cursor pagination, and offset compatibility.
- Expose exactly four MCP tools: `verify_email`, `verify_batch`, `get_job`, and `get_results`.
- Keep `@bounceless/mcp@0.1.0` immutable and installable by exact registry version; see the README migration guide.

No package is published by this candidate change.
