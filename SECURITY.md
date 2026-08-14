# Security Policy

## Scope and posture

headlamp-saved-views is a client-side Headlamp plugin. By design it:

- makes no external network calls,
- sends no telemetry or analytics,
- never reads or stores Kubernetes credentials or authentication tokens,
- never reads Kubernetes Secrets,
- stores saved views only in the local Headlamp plugin configuration
  (`ConfigStore`) in the user's own browser profile,
- never mutates Kubernetes resources — opening a saved view only navigates
  the UI.

See the [Security & privacy](./README.md#12-security--privacy) section of
the README for the full statement.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a suspected security
vulnerability. Instead, open a
[GitHub private security advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)
on this repository, or contact the maintainers listed in
`artifacthub-repo.yml`.

Please include:

- a description of the issue and its potential impact,
- steps to reproduce (a minimal saved-view config or plugin state is ideal),
- the Headlamp and plugin versions involved.

We'll acknowledge reports as soon as we can and aim to follow up with a fix
or mitigation plan. Since this plugin has no backend and no network calls of
its own, most realistic issues would involve the plugin's handling of
persisted/malformed local configuration data (see `src/store/migrations.ts`
and `src/store/validation.ts`) rather than remote attack surface — reports
about validation/migration gaps that could let malformed local data cause
unexpected behavior are welcome too.

## Supported versions

Only the latest released version is supported with security fixes.
