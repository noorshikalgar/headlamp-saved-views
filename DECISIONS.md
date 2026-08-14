# Architecture Decisions

This document records design decisions that were not fully specified by the
product requirements and required inspecting Headlamp's current plugin API
and source (`@kinvolk/headlamp-plugin@0.14.0`, and
`kubernetes-sigs/headlamp` on the `main` branch) before being made. Each
decision favors the least invasive implementation that survives a Headlamp
upgrade over a more "automatic" but internals-dependent one.

## Decision A — What a Saved View actually stores

A Saved View stores only three kinds of information:

1. **Cluster** — the cluster name as Headlamp knows it (see Decision C).
2. **Resource** — a resource kind identifier plus, for list views, the API
   version/group needed to route back to it (see Decision B).
3. **Filters** — namespace selection, a free-text search string, and
   (optionally, only where the target view supports it) a label selector.
   These are supplied explicitly by the user, not inferred (see Decision B).

Nothing else is persisted. In particular, no component state, no scroll
position, no table sort column, no Redux state.

## Decision B — How "current view" capture works

**Investigated:** `registerRoute`, `registerRouteFilter`,
`registerSidebarEntry`, `registerResourceTableColumnsProcessor`,
`registerDetailsViewSection(s)Processor`, and the frontend Redux source
(`frontend/src/redux/filterSlice.ts`).

**Finding:** Headlamp's built-in resource list views keep their active
namespace filter and free-text search string in a Redux slice
(`filterSlice`, persisted separately to `localStorage` via
`lib/storage.ts`), not in the URL and not behind any exported plugin hook.
The public registry API lets a plugin *add/remove/reorder* table columns and
detail sections, but it does not expose a way to *read* the currently active
filter/search state of an arbitrary built-in list page.

Per the master instruction's explicit prohibition on reading private Redux
state or scraping the DOM to reconstruct filter state, automatic capture of
an arbitrary built-in resource-list view's filters is **not implemented**.

**What is safe to auto-capture**, because it comes from the public URL
(`getCluster()` / route path), when the user clicks "Save Current View" from
a page the plugin recognizes:
- the current cluster
- the resource kind, when the current route path matches a known built-in
  list route pattern (e.g. `/c/:cluster/pods`, `/c/:cluster/services`, ...)

**What always requires the explicit form:**
- namespace scope (all / current / specific list)
- search text
- label selector

So "Save Current View" is a convenience prefill, not a scrape: it opens the
same manual creation form used everywhere else, with cluster and resource
pre-selected when they could be reliably determined, and leaves filter
fields for the user to fill in or confirm. If the current route isn't a
recognized resource list at all, the dialog explains that and opens the
manual form with only the cluster field prefilled.

This is a deliberate, documented scope reduction from a fully "magic" save
button, and it is the direct, evidence-based reason this plugin will not
silently invent filter state that isn't actually active.

**Revised after live testing against a real Headlamp instance + kind
cluster** (not just unit tests, which had mocked assumptions that turned out
to be wrong in two ways):

1. A "Save Current View" button placed only on the Saved Views page cannot
   work at all — by the time it's clicked, `window.location` already reflects
   the Saved Views page, not whatever resource list the user came from. The
   fix is `registerAppBarAction` (`src/components/SaveCurrentViewAppBarAction.tsx`):
   a "Save View" button present in the app bar on every page, which captures
   the view at the actual moment of intent (synchronously, at click time,
   before any navigation) and renders the create dialog itself, right there.
   An earlier version instead navigated to the Saved Views page and handed
   the capture off via URL query params — technically working, but a
   confusing detour that took the user away from the page they clicked from
   for no reason, since nothing about showing a dialog requires changing the
   route. Found by actually clicking through the flow, not just unit-testing
   the capture logic in isolation.
2. Headlamp uses hash-based routing everywhere (confirmed live:
   `window.location.pathname` is always `/`; the real route lives in
   `window.location.hash`, e.g. `#/c/prod/pods`). `captureCurrentView()`
   parses the pathname out of the hash, not `window.location.pathname`.
3. `Router.getRoutePath()` returns the route's path *template*, literally
   including `:cluster` (e.g. `/c/:cluster/pods`), not a cluster-resolved
   path. Matching substitutes the actual cluster name into that placeholder
   before comparing, rather than trying to strip a cluster prefix from the
   observed pathname (the original, wrong approach).

Both are covered by `src/lib/currentView.test.ts`, with the mocked route
shapes corrected to match what's actually observed from a live instance.

**Further revision — saving a specific resource, not just a list.** A user
correctly pushed back on the app-bar "Save View" button: opening a pod's
details/logs (which Headlamp renders as an "Activity" popup — confirmed
live, it never changes `window.location`) and clicking Save Current View
only ever captured "Pod, this cluster," never that specific pod. Checked
whether this is fixable: `Activity.launch/close/update` and `useActivity()`
are public exports, but `useActivity()` only works *from inside* an
already-open Activity — there is no exported way for an unrelated
component to enumerate currently-open Activities (the backing
`activitySlice` Redux state isn't exported). So the app bar genuinely can't
know this. The real fix is a different, more precise entry point:
`registerDetailsViewSection` (`src/components/SaveResourceDetailsAction.tsx`)
renders inside the resource's own details view — the same view whether
shown as an Activity or a full page — and is handed the actual resource
object directly (kind, `getName()`, `getNamespace()`, `.cluster`). Since
there's deliberately no "specific resource" concept in the saved-view data
model (Decision A), this captures the resource's exact name as a `search`
filter instead: opening the resulting saved view lands on that resource's
list with a reminder to enter that exact name, which — since Headlamp's
own search matches by name — narrows the list down to just that one
resource. No schema change needed.

Also narrowed the app-bar "Save View" button itself to only render on
pages `captureCurrentView()` recognizes as a resource list — it was
showing (uselessly) on Settings, Home, and dashboard pages like Workloads
overview. Made reactive to route changes via `useLocation()` from
`react-router-dom` (a shared dependency, not a private internal) — without
it, nothing would trigger a re-render when only the hash changes.

**Further revision — the Logs Activity is a different surface entirely.**
Headlamp's pod logs viewer (opened via "Show Logs" from the pod details
view) turned out, on live testing, to be a *separate* Activity from the
resource details view — confirmed by the taskbar showing two independent
tabs ("Pod: x" and "Logs: x"). `registerDetailsViewSection` genuinely does
not render inside it; `SaveResourceDetailsAction` has no reach there.
Checked for a dedicated hook: `registerHeadlampEventCallback` does fire a
public `LOGS` event on open/close (`src/lib/logsActivityTracking.ts`), and
its documented type includes an optional `resource` field — but tested
live and that field is actually never populated on the real payload, only
`status` comes through. Rather than give up, combined two independent
public signals: `SaveResourceDetailsAction` already has direct access to
the resource (it's a component prop), so it now also records itself as the
"last viewed details resource"; the LOGS event's `status: 'open'` is then
used purely as a trigger, attributed to whatever was last recorded. This
works because opening the Logs Activity is only ever reachable by clicking
a button that lives inside that same details view — not a coincidence, an
actual invariant of the current UI. Both the event registration
(`registerHeadlampEventCallback`, like `registerSidebarEntryFilter`,
appends to a list on every call) and the tracking are covered by
`src/lib/logsActivityTracking.test.ts`.

## Decision C — Cluster identity

**Investigated:** `frontend/src/lib/cluster.ts`.

**Finding:** `getCluster()` returns whatever string is in the `:cluster`
URL path segment, which is the cluster's *configured display name* — there
is no separate stable identifier (no kubeconfig context hash, no API server
URL, no UID) exposed to plugins. Two differently configured clusters that
happen to share a display name are indistinguishable to a plugin.

**Consequence:** A Saved View's cluster reference is inherently a *name*,
not a guaranteed-unique identity. This is documented as a known limitation
in the README rather than "solved," because it cannot be solved without
depending on private/unexported internals. When a saved view is opened, the
plugin checks that a cluster with the stored name is currently configured
(via `useClustersConf()`) before navigating; if it isn't, or if it's
ambiguous, the user sees an explicit "cluster not found" state rather than a
silent redirect to a same-named-but-different cluster.

## Decision D — Log-viewer style integration question (N/A for this repo)

Not applicable to `headlamp-saved-views`; recorded here only because the
master instruction asks for it to be tracked. See
`headlamp-structured-logs/DECISIONS.md` for that plugin's version of this
decision.

## Decision E — Dependencies / virtualization

**Investigated:** `node_modules/@kinvolk/headlamp-plugin/package.json`.

**Finding:** The plugin devDependency tree already includes
`@mui/material`, `@iconify/react`, and other UI primitives that Headlamp
shares at runtime. Saved Views' UI (a list of cards/rows with search) is
small enough (expected: low hundreds of views at the documented limit, see
`src/lib/limits.ts`) that no virtualization library is needed. No new
runtime dependency was added for this plugin beyond what the scaffold
already provides.

## Decision F — Import/export

Not implemented in this initial release, per the master instruction's
explicit guidance to keep it out of MVP scope. The data model
(`SavedView`, versioned `SavedViewsConfig`) is already plain JSON and
schema-versioned, so import/export can be added later as a pure
serialize/validate layer on top of the existing `src/store` module without
changing the persisted shape.

## Pinning favorites in the sidebar

Per the original spec's "if practical, show a small number of pinned
favorites under the main entry" — implemented via up to 5 child
`registerSidebarEntry` calls under the `saved-views` parent, each a direct
link to the view's resolved resource URL (`useClusterURL: false`, since the
view's own cluster may not be the currently selected one).

Two non-obvious things, found only by testing live against a real
instance:

- `registerSidebarEntry` is a plain Redux dispatch keyed by entry `name`,
  so it's safe to call reactively as favorites change (confirmed by
  reading `sidebarSlice.js`: `state.entries[name] = payload`).
- `registerSidebarEntryFilter`, by contrast, *appends* to an array of
  filter functions on every call (`state.filters.push(...)`) — calling it
  reactively would accumulate a new filter on every favorite toggle. It's
  registered exactly once, at module load, closing over a mutable slot
  count the sync effect updates.
- The filter is only *re-evaluated* when the sidebar's Redux state actually
  changes. The first implementation skipped dispatching for unused slots
  when the favorites list shrank — e.g. going from 1 favorite to 0 did
  nothing, so nothing triggered a re-render, so the stale entry stayed
  pinned forever. Fixed by always dispatching all `MAX_PINNED_FAVORITES`
  slots on every run (unused ones get an empty entry that the filter then
  hides), guaranteeing a state change every time. See
  `src/components/SidebarFavoritesSync.tsx`.

## Routing scheme

The plugin registers:
- `/saved-views` — the Saved Views list page (`registerSidebarEntry` +
  `registerRoute`, cluster-scoped like other built-in sidebar entries).

Opening a saved view does not use a plugin-owned "viewer" route. Instead it
navigates directly to Headlamp's own resource route for the stored resource
kind (e.g. `/c/<cluster>/pods`) with the namespace/search state applied via
the same mechanisms a user would use manually (namespace filter selection,
search box), since — per Decision B — there is no public way to encode
arbitrary filter state into a URL that a built-in list route will pick up
automatically. This is documented as a limitation: opening a saved view
navigates to the correct cluster and resource list, and pre-fills what the
public API allows; it does not silently replay a fully filtered view for
built-in resource kinds. See `src/lib/currentView.ts` and
`src/lib/savedViewUrl.ts` for the implementation boundary.

## List UI: table, not cards

The Saved Views list uses Headlamp's `SimpleTable` component (the same
CSS-grid table primitive Headlamp's own resource lists are built on),
rather than a custom card layout — sortable columns, compact rows, and a
visual language that matches the rest of the app instead of introducing a
new one. `SimpleTable` was chosen over the richer `Table` (built on
`material-react-table`) for lower API risk: `SimpleTable`'s column shape
(`label`/`getter`/`sort`) is simple enough to get right without a working
example to copy from, while `material-react-table`'s column-definition API
is easy to get subtly wrong without one. See `src/components/SavedViewsTable.tsx`.

## Persistence

`ConfigStore<SavedViewsConfig>('headlamp-saved-views')` — one config object
per plugin, scoped to the user's Headlamp browser profile, matching the
pattern used by `change-logo`, `pod-counter`, and the official `flux`
plugin's settings. Saved views are user-local; they are not synchronized
across machines or written to any Kubernetes resource. This is documented
in the README.
