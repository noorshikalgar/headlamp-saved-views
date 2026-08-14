# Contributing

Thanks for considering a contribution to headlamp-saved-views.

## Before you start

For anything beyond a small fix, please open an issue first describing what
you'd like to change — especially for anything touching how a saved view's
state is captured, validated, or resolved, since those decisions were made
deliberately (see [`DECISIONS.md`](./DECISIONS.md)) and changing them has
user-data implications.

## Development setup

```bash
git clone <this-repo>
cd headlamp-saved-views
npm install
npm run start
```

`npm run start` watches `src/` and rebuilds; load the output into a running
Headlamp instance per the plugin development docs linked in
[`AGENTS.md`](./AGENTS.md).

## Before opening a PR

Run the full validation pipeline locally and make sure it's clean:

```bash
npm run lint
npm run tsc
npm run test
npm run build
npm run package
```

CI runs the same checks (see `.github/workflows/ci.yml`) and will block
merges that don't pass.

## Code guidelines

- Use Headlamp's **public** plugin API only. Do not read private Redux
  state, scrape the DOM, or depend on undocumented router internals — see
  `DECISIONS.md` for why, and for the specific boundaries already chosen.
- Prefer Headlamp-provided/shared dependencies over adding new ones.
- Every new business rule (parsing, validation, migration, URL
  construction) needs a unit test — see the existing `src/**/*.test.ts`
  files for the expected style (plain-data, no live cluster required).
- No `console.log` debugging statements, no dead code, no `any` without a
  documented reason.
- Keep accessibility in mind: labeled controls, visible focus, keyboard
  operability, no color-only signaling.

## Reporting bugs / requesting features

Please use the issue templates under `.github/ISSUE_TEMPLATE/`.

## Security issues

Do not open a public issue for a security concern — see
[`SECURITY.md`](./SECURITY.md).

## Code of Conduct

This project follows the [Code of Conduct](./CODE_OF_CONDUCT.md).
