# @bounceless/mcp

The npm registry currently serves `@bounceless/mcp@1.0.0`; version 1.0.1 in this source tree is an unpublished candidate.

Local stdio MCP server for the Bounceless GA single and batch API. Requires Node.js 20+. Set `BOUNCELESS_API_KEY`; the default API is `https://api.bounceless.io`. A missing key exits with a concise error and no stack trace.

The 1.0 surface is exactly `verify_email`, `verify_batch`, `get_job`, and `get_results`. `verify_email` takes `email`, `verify_batch` takes `emails`, and both `get_job` and `get_results` require the snake-case argument `request_id`. Any argument-name harmonization belongs in a future 1.1 release; the 1.0 contract remains unchanged.
