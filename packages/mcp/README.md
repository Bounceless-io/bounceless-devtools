# @bounceless/mcp

Official Bounceless MCP server, published on the public npm registry as `@bounceless/mcp`. The unscoped `bounceless-mcp` name does not resolve outside this repository.

```
npm install @bounceless/mcp@1.0.2 && node -p "require('@bounceless/mcp/package.json').version"
```

Local stdio MCP server for the Bounceless GA single and batch API. Requires Node.js 20+. Set `BOUNCELESS_API_KEY`; the default API is `https://api.bounceless.io`. A missing key exits with a concise error and no stack trace. Start the published server with `npx --yes @bounceless/mcp@1.0.2`.

The 1.0 surface is exactly `verify_email`, `verify_batch`, `get_job`, and `get_results`. `verify_email` takes `email`, `verify_batch` takes `emails`, and both `get_job` and `get_results` require the snake-case argument `request_id`. Any argument-name harmonization belongs in a future 1.1 release; the 1.0 contract remains unchanged.
