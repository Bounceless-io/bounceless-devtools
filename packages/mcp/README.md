# @bounceless/mcp

Local stdio MCP server for the Bounceless GA single and batch API. Requires Node.js 20+. Set `BOUNCELESS_API_KEY`; the default API is `https://api.bounceless.io`. A missing key exits with a concise error and no stack trace.

The 1.0 surface is exactly `verify_email`, `verify_batch`, `get_job`, and `get_results`.
