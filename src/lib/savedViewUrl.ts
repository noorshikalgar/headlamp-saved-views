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
 * actually filtering the list. This directly revises an earlier,
 * overly-conservative assumption (Decision B) that no filter state could
 * be encoded in the URL — that held for referencing one specific resource
 * instance (still true: no URL param means "this one item"), but was
 * wrong for namespace and free-text search on a list.
 *
 * Namespaces are joined with a plain space (URLSearchParams encodes that
 * as `+`), matching what Headlamp's own UI produces when selecting
 * multiple namespaces manually.
 */
export function buildSavedViewSearchParams(view: SavedView): Record<string, string> {
  const params: Record<string, string> = {};
  if (view.filters.namespaces?.length) {
    params.namespace = view.filters.namespaces.join(' ');
  }
  if (view.filters.search) {
    params.filter = view.filters.search;
  }
  return params;
}

export interface ResolvedSavedViewUrl {
  /** Deep link to the resource's built-in list view, with namespace/search applied where possible. */
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
 * Just the deep link, no query string — the only form safe to use as a
 * `registerSidebarEntry` `url`. Confirmed live: Headlamp unconditionally
 * appends its own `?namespace=<current>` to every sidebar entry's href
 * (apparently to carry the active namespace filter across navigation),
 * with no check for whether the url already has a `?` in it. A sidebar
 * entry built from `buildSavedViewUrl`'s query string produced
 * `...?namespace=payments?namespace=payments` and Headlamp's router
 * couldn't resolve it at all ("Whoops! This page doesn't exist"). So
 * pinned sidebar favorites (`SidebarFavoritesSync.tsx`) intentionally lose
 * the namespace/search auto-apply that the table's Open button and
 * `Link`'s `search` prop get — there is no known-safe way to give a raw
 * sidebar `url` a query string.
 */
export function buildSavedViewBaseUrl(view: SavedView): string {
  return Router.createRouteURL(view.resource.routeName, { cluster: view.cluster });
}

/**
 * Builds a plain-string URL for contexts that need one and don't go
 * through a live sidebar registration (e.g. tests, or a future "copy
 * link" feature) — see `buildSavedViewBaseUrl`'s doc for why this exact
 * shape is unsafe to hand to `registerSidebarEntry`. `Router.createRouteURL`
 * only fills in path placeholders like `:cluster` — verified live that
 * passing `namespace`/`filter` as extra params does nothing — so the query
 * string from `buildSavedViewSearchParams` is appended by hand. Prefer the
 * `search` prop on Headlamp's own `Link` component directly where that's
 * available (see `SavedViewsTable.tsx`) — same params, same encoding
 * (`Link`'s docs confirm objects are converted via URLSearchParams too),
 * just via the more idiomatic, React-Router-aware path.
 */
export function buildSavedViewUrl(view: SavedView): ResolvedSavedViewUrl {
  const baseUrl = buildSavedViewBaseUrl(view);
  const query = new URLSearchParams(buildSavedViewSearchParams(view)).toString();
  const url = query ? `${baseUrl}?${query}` : baseUrl;

  const unappliedFilters: string[] = [];
  if (view.filters.labelSelector) {
    unappliedFilters.push(`Label selector: ${view.filters.labelSelector}`);
  }

  return { url, unappliedFilters };
}
