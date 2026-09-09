# @bounceless/cli

Official Bounceless CLI, published on the public npm registry as `@bounceless/cli`. The unscoped `bounceless` name does not resolve outside this repository.

```
npx --yes @bounceless/cli@1.0.2 --version
```

Requires Node.js 20+. Set `BOUNCELESS_API_KEY`, then use `bounceless verify <email>`, `bounceless batch submit <file.csv>`, `bounceless batch status <request-id>`, or `bounceless batch results <request-id> [--output json|csv]`. `--help` and `--version` work without a key. No credential is stored locally.

`batch submit` returns the batch job identifier in `request.id`; use that value as `<request-id>` for `batch status` and `batch results`. The top-level `requestId` is only an HTTP trace identifier. Renaming it to `traceId` is a possible 1.1 change, not a change to the 1.0 contract.

Result downloads fail explicitly on invalid JSON, unexpected page shapes, exhausted retries, or repeated cursors. CSV object and array cells (`decision`, `presend`, and `reasonCodes`) contain JSON rather than `[object Object]`.
