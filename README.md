# Bounceless developer tools

Public source for the official `@bounceless/cli@1.0.0` and `@bounceless/mcp@1.0.0` packages. Each release tarball embeds the shared HTTP client; there is no separately published client dependency.

Requirements: Node.js 20 or newer and an API key in `BOUNCELESS_API_KEY`. Authentication uses the canonical `X-Api-Key` header. `Authorization: Bearer` remains a server compatibility path, not the client default. For local controlled testing only, `BOUNCELESS_BASE_URL` overrides `https://api.bounceless.io`.

## CLI

```sh
npm install ./bounceless-cli-1.0.0.tgz
bounceless --help
bounceless verify person@example.test
bounceless batch submit emails.csv
bounceless batch status REQUEST_ID
bounceless batch results REQUEST_ID --output json
```

`--help` and `--version` do not require a key and write no error output. Results pagination follows canonical `cursor`/`nextCursor` responses and remains compatible with `offset` responses. Network, 429, and server retries are bounded.

CLI guide: https://docs.bounceless.io/cli

## MCP

```sh
npm install ./bounceless-mcp-1.0.0.tgz
BOUNCELESS_API_KEY=blc_example bounceless-mcp
```

The GA server exposes exactly `verify_email`, `verify_batch`, `get_job`, and `get_results`. It uses stdio; keep stdout reserved for MCP messages.

MCP guide: https://docs.bounceless.io/guides/mcp

## Reproduce the two tarballs

From a clean checkout at the candidate SHA:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm pack:release
pnpm verify:release
sha256sum packs/*.tgz
```

The verification recipe inspects both inventories, installs both tarballs outside the workspace with a dedicated empty npm cache, exercises CLI and MCP against a synthetic local server, and proves that an omitted external `@bounceless/client@1.0.0` cannot resolve offline.

## Migration from MCP 0.1.0

The historical package remains selectable as exact version `@bounceless/mcp@0.1.0`; this repository does not republish or mutate it. For GA, replace `presend_check`, `doorman_check`, `get_credits`, and `get_pricing` with the four-tool surface above. Single verification moves to `verify_email`; batch flows use `verify_batch`, then `get_job` and `get_results`. The presend envelope may still appear in API responses as documented compatibility data, but it is not a fifth tool or route.

Unknown results are never billed and credits do not expire. No billing behavior is changed by these packages.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [LICENSE](LICENSE).
