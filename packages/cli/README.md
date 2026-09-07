# @bounceless/cli

Requires Node.js 20+. Set `BOUNCELESS_API_KEY`, then use `bounceless verify <email>`, `bounceless batch submit <file.csv>`, `bounceless batch status <request-id>`, or `bounceless batch results <request-id> [--output json|csv]`. `--help` and `--version` work without a key. No credential is stored locally.

`batch submit` returns the batch job identifier in `request.id`; use that value as `<request-id>` for `batch status` and `batch results`. The top-level `requestId` is only an HTTP trace identifier. Renaming it to `traceId` is a possible 1.1 change, not a change to the 1.0 contract.
