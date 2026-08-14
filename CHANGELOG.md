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
- Up to 5 favorited views are pinned as direct links under **Saved Views**
  in the sidebar for one-click access, kept in sync as favorites change.
- "Save a view for this &lt;kind&gt;" action inside a resource's own details
  view (works inside Headlamp's Activity popup too, e.g. pod logs), which
  can capture a specific resource's exact name as a search filter — the
  app-bar action alone can only ever see the underlying list page.

### Fixed

- (Pre-release, found via live testing) "Save Current View" never actually
  captured a resource kind: Headlamp's hash-based routing and route-path
  templating weren't accounted for in the original implementation. See
  `DECISIONS.md` Decision B.
- (Pre-release) Typing a namespace and not pressing Enter silently dropped
  it; the namespace field now commits pending text on blur and on submit.
- (Pre-release) Clicking "Save View" navigated to the Saved Views page and
  handed the capture off via URL query params before showing the create
  dialog — confusing in practice, since it took the user away from the
  page they clicked from for no functional reason. It now renders the
  dialog directly, wherever the button was clicked from.
- (Pre-release) Unfavoriting a pinned sidebar entry didn't remove it —
  nothing was triggering the sidebar to re-render and re-apply the
  visibility filter when the favorites list shrank to fewer used slots.
- (Pre-release) "Save View" appeared on every page, including Settings and
  other pages with nothing to capture; it's now only shown on recognized
  resource-list pages.
- (Pre-release) Opening a specific pod's details/logs and clicking "Save
  View" silently captured only "Pod, this cluster" with no indication that
  the specific pod wasn't (and can't be) captured that way — see the new
  details-view action above, and the improved wording when only the
  general list is captured.
