# bounceless-devtools

Private monorepo for public-candidate developer tools.

This repository is **PRIVATE**. Creation of the shell is not authorization to publish.

The workspace contains a shared API-key HTTP client, `@bounceless/mcp@1.0.0`,
and `@bounceless/cli@1.0.0`. Both clients default to
`https://api.bounceless.io`, read only `BOUNCELESS_API_KEY`, and never persist
credentials. No product/server code belongs here.

- License: Apache-2.0
- Default branch: `main`
- Visibility remains private until the TOOLS-RELEASE gate
