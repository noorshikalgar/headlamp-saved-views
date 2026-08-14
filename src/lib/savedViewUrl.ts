/*
 * Copyright 2026 The Headlamp Saved Views Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Router } from '@kinvolk/headlamp-plugin/lib';
import { SavedView } from '../types';

/**
 * Namespace and search *are* URL-bindable on Headlamp's built-in list
 * views — found by reading the actual query-param wiring
 * (`useQueryParamsState` in Table.tsx) and confirming live, on a fresh
 * page load, that `?namespace=ns1+ns2&filter=text` is picked up by both
 * the namespace selector and the search box, not just cosmetically but
 * actually filtering the list.
 *
 * Namespaces are joined with a plain space (URLSearchParams encodes that
 * as `+`), matching what Headlamp's own UI produces when selecting
 * multiple namespaces manually. `filter` falls back to `resourceName` when
 * there's no typed `search` — used only when `buildSavedViewLinkTarget`
 * below couldn't build a direct resource link, so the list is at least
 * filtered down to the captured name instead of showing everything.
 */
export function buildSavedViewSearchParams(view: SavedView): Record<string, string> {
  const params: Record<string, string> = {};
  if (view.filters.namespaces?.length) {
    params.namespace = view.filters.namespaces.join(' ');
  }
  const filterText = view.filters.search || view.filters.resourceName;
  if (filterText) {
    params.filter = filterText;
  }
  return params;
}

export interface SavedViewLinkTarget {
  /** A key in Headlamp's default routes object. */
  routeName: string;
  /** Params for the route's path placeholders (`:cluster`, `:namespace`, `:name`). */
  params: Record<string, string>;
  /** Query params, only present for the list-view fallback (never for a direct resource link). */
  search?: Record<string, string>;
}

/**
 * Picks between two ways of getting a saved view to actually show
 * something useful when opened:
 *
 * 1. **Direct resource link** — when the view captured one specific
 *    resource's exact name (`filters.resourceName`, set only by
 *    `SaveResourceDetailsAction`/the logs-tracking enrichment, never
 *    typed) *and* Headlamp exposes a details route for this resource kind
 *    (`resource.detailsRoute`, a static property like
 *    `K8s.ResourceClasses.Pod.detailsRoute === "Pod"`, confirmed live).
 *    This lands the user on the resource's own details page in one click
 *    — e.g. `/c/prod/pods/payments/payments-api-xyz` — instead of a
 *    filtered list they'd still have to click into. There is no public
 *    API to go one step further and auto-open the Logs Activity from
 *    there: Headlamp's own "Show Logs" button dispatches
 *    `Activity.launch()` with a `content` that's a private, unexported
 *    React component bound to the fetched resource object — confirmed
 *    live by monkey-patching `Activity.launch` and inspecting the actual
 *    dispatched payload. A plugin has no way to construct that content
 *    itself, so the details page is as close as this can get.
 * 2. **List + query params** — the previous behavior, used whenever (1)
 *    doesn't apply: no captured resource, or a resource kind without a
 *    known details route (older Headlamp versions, or classes that don't
 *    expose one).
 */
export function buildSavedViewLinkTarget(view: SavedView): SavedViewLinkTarget {
  const { resourceName } = view.filters;
  const namespace = view.filters.namespaces?.[0];
  const canUseDetailsRoute =
    !!resourceName &&
    !!view.resource.detailsRoute &&
    (view.resource.scope === 'cluster' || !!namespace);

  if (canUseDetailsRoute) {
    return {
      routeName: view.resource.detailsRoute as string,
      params: {
        cluster: view.cluster,
        ...(namespace ? { namespace } : {}),
        name: resourceName as string,
      },
    };
  }

  return {
    routeName: view.resource.routeName,
    params: { cluster: view.cluster },
    search: buildSavedViewSearchParams(view),
  };
}

/**
 * Just the deep link, no query string — the only form safe to use as a
 * `registerSidebarEntry` `url`. Confirmed live: Headlamp unconditionally
 * appends its own `?namespace=<current>` to every sidebar entry's href
 * (apparently to carry the active namespace filter across navigation),
 * with no check for whether the url already has a `?` in it. A sidebar
 * entry built with an existing query string produced
 * `...?namespace=payments?namespace=payments` and Headlamp's router
 * couldn't resolve it at all ("Whoops! This page doesn't exist"). Since
 * `buildSavedViewLinkTarget`'s direct-resource-link branch encodes
 * namespace/name as path segments rather than a query string, pinned
 * sidebar favorites (`SidebarFavoritesSync.tsx`) safely get that upgrade
 * too — only the list-view fallback's `search` params are unsafe here,
 * and this function deliberately never appends them.
 */
export function buildSavedViewBaseUrl(view: SavedView): string {
  const target = buildSavedViewLinkTarget(view);
  return Router.createRouteURL(target.routeName, target.params);
}

export interface ResolvedSavedViewUrl {
  /** Deep link to the saved view's target — a specific resource's own page when captured, otherwise its list. */
  url: string;
  /**
   * Human-readable descriptions of filters that could not be encoded into
   * the URL and must be applied manually. Only the label selector falls
   * here — Headlamp's built-in list views have no URL-bindable concept of
   * one (confirmed live: the per-column "Show/Hide filters" panel filters
   * by field values like Status, not by Kubernetes label selector).
   */
  unappliedFilters: string[];
}

/**
 * Builds a plain-string URL for contexts that need one and don't go
 * through a live sidebar registration (e.g. tests, or a future "copy
 * link" feature) — see `buildSavedViewBaseUrl`'s doc for why the
 * list-fallback's query string is unsafe to hand to `registerSidebarEntry`.
 * Prefer the `routeName`/`params`/`search` from `buildSavedViewLinkTarget`
 * directly where a `Link` component is available (see
 * `SavedViewsTable.tsx`) — same params, same encoding, just via the more
 * idiomatic, React-Router-aware path.
 */
export function buildSavedViewUrl(view: SavedView): ResolvedSavedViewUrl {
  const target = buildSavedViewLinkTarget(view);
  const baseUrl = Router.createRouteURL(target.routeName, target.params);
  const query = target.search ? new URLSearchParams(target.search).toString() : '';
  const url = query ? `${baseUrl}?${query}` : baseUrl;

  const unappliedFilters: string[] = [];
  if (view.filters.labelSelector) {
    unappliedFilters.push(`Label selector: ${view.filters.labelSelector}`);
  }

  return { url, unappliedFilters };
}
