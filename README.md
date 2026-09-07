# Bounceless developer tools

Public source for the official Bounceless CLI and MCP packages. The registry currently serves `@bounceless/cli@1.0.0` and `@bounceless/mcp@1.0.0`; this source prepares unpublished 1.0.1 candidates. Each release tarball embeds the shared HTTP client; there is no separately published client dependency.

Requirements: Node.js 20 or newer and an API key in `BOUNCELESS_API_KEY`. Authentication uses the canonical `X-Api-Key` header. `Authorization: Bearer` remains a server compatibility path, not the client default. For local controlled testing only, `BOUNCELESS_BASE_URL` overrides `https://api.bounceless.io`.

## CLI

```sh
npm install @bounceless/cli@1.0.0
bounceless --help
bounceless verify person@example.test
bounceless batch submit emails.csv
bounceless batch status REQUEST_ID
bounceless batch results REQUEST_ID --output json
```

`--help` and `--version` do not require a key and write no error output. Results pagination follows canonical `cursor`/`nextCursor` responses and remains compatible with `offset` responses. Network, 429, and server retries are bounded. Invalid/truncated successful responses and repeated cursors fail explicitly instead of returning partial results as complete.

`batch submit` returns the batch job identifier in `request.id`; pass that value to `batch status` and `batch results`. The top-level `requestId` is an HTTP trace identifier, not a batch job identifier. A future 1.1 release may rename that trace field to `traceId`; the 1.0 contract is unchanged.

## MCP

```sh
npm install @bounceless/mcp@1.0.0
BOUNCELESS_API_KEY=blc_example bounceless-mcp
```

The GA server exposes exactly `verify_email`, `verify_batch`, `get_job`, and `get_results`. `verify_email` takes `email`, `verify_batch` takes `emails`, and both `get_job` and `get_results` require the snake-case argument `request_id`. Argument-name harmonization is deferred to a future 1.1 release; the 1.0 contract is unchanged. The server uses stdio; keep stdout reserved for MCP messages.

## Reproduce the two tarballs

From a clean checkout at the candidate SHA:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm pack:release
pnpm verify:release
sha256sum packs/*.tgz
```

The generated 1.0.1 tarballs are release candidates only and are not published by this recipe. The verification recipe inspects both inventories, installs both tarballs outside the workspace with a dedicated empty npm cache, exercises CLI and MCP against a synthetic local server, and proves that an omitted external `@bounceless/client@1.0.0` cannot resolve offline.

CSV object and array fields—including `decision`, `presend`, and `reasonCodes`—are JSON-stringified inside quoted CSV cells. They never use JavaScript's `[object Object]` coercion. This corrects candidate output; the immutable registry version 1.0.0 retains its historical formatting.

## Migration from MCP 0.1.0

The historical package remains selectable as exact version `@bounceless/mcp@0.1.0`; this repository does not republish or mutate it. For GA, replace `presend_check`, `doorman_check`, `get_credits`, and `get_pricing` with the four-tool surface above. Single verification moves to `verify_email`; batch flows use `verify_batch`, then `get_job` and `get_results`. The presend envelope may still appear in API responses as documented compatibility data, but it is not a fifth tool or route.

Unknown results are never billed and credits do not expire. No billing behavior is changed by these packages.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [LICENSE](LICENSE).
