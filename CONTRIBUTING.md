# Contributing

Use Node.js 20 or newer and pnpm 10.15.0. From a clean checkout run:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm pack:release
pnpm verify:release
```

Use synthetic `example.test` addresses in tests. Do not commit API keys, customer data, generated tarballs, or registry credentials. Open a pull request; authors do not merge their own changes.
