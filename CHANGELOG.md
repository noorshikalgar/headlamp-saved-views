# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Initial release: create/edit/duplicate/delete/favorite saved views,
  "Save Current View" (cluster + resource auto-capture, filters entered
  manually — see `DECISIONS.md`), Saved Views sidebar page, local
  `ConfigStore`-backed persistence with schema versioning and migration.
- "Save View" app-bar action, present on every page, as the real trigger
  for capturing the current cluster/resource — verified end-to-end against
  a live Headlamp instance and a local kind cluster.
- Saved Views list rendered as a sortable table (matching Headlamp's own
  resource lists) instead of a card layout, for a more native, compact fit.

### Fixed

- (Pre-release, found via live testing) "Save Current View" never actually
  captured a resource kind: Headlamp's hash-based routing and route-path
  templating weren't accounted for in the original implementation. See
  `DECISIONS.md` Decision B.
- (Pre-release) Typing a namespace and not pressing Enter silently dropped
  it; the namespace field now commits pending text on blur and on submit.
