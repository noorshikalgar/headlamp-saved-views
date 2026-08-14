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

## Persistence

`ConfigStore<SavedViewsConfig>('headlamp-saved-views')` — one config object
per plugin, scoped to the user's Headlamp browser profile, matching the
pattern used by `change-logo`, `pod-counter`, and the official `flux`
plugin's settings. Saved views are user-local; they are not synchronized
across machines or written to any Kubernetes resource. This is documented
in the README.
