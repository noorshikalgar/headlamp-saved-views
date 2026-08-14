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

import { Router, Utils } from '@kinvolk/headlamp-plugin/lib';
import { ResourceRef } from '../types';
import { getResourceCatalog } from './resourceCatalog';

export interface CurrentViewCapture {
  cluster: string | null;
  /** Set only when the current route is recognized as a built-in resource list view. */
  resource: ResourceRef | null;
}

/**
 * Best-effort capture of what "Save Current View" can determine from public
 * APIs: the current cluster (from the URL, via `Utils.getCluster()`) and,
 * when the current route matches a known built-in resource list route, that
 * resource's kind (matched via the public route registry, `Router.getRoute`
 * / `Router.getRoutePath`, against `window.location`).
 *
 * Deliberately NOT captured: namespace filter, search text, label selector.
 * That state lives in Headlamp's internal Redux store with no public read
 * API — see DECISIONS.md Decision B. Callers must collect those from the
 * user via the saved-view form.
 */
export function captureCurrentView(): CurrentViewCapture {
  const cluster = Utils.getCluster();
  const pathname = getRoutePathname();

  for (const resource of getResourceCatalog()) {
    const route = Router.getRoute(resource.routeName);
    if (!route) {
      continue;
    }
    const routePath = Router.getRoutePath(route);
    if (matchesListPath(pathname, routePath, cluster)) {
      return { cluster, resource };
    }
  }

  return { cluster, resource: null };
}

/**
 * Headlamp uses hash-based routing (confirmed against a live instance:
 * `window.location.pathname` is always "/", the actual route lives in
 * `window.location.hash`, e.g. "#/c/prod/pods"). Falls back to `pathname`
 * itself when there's no hash, in case of a differently configured router.
 */
function getRoutePathname(): string {
  const hash = window.location.hash;
  if (!hash) {
    return window.location.pathname;
  }
  const withoutHash = hash.slice(1);
  const queryIndex = withoutHash.indexOf('?');
  return queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
}

/**
 * `Router.getRoutePath()` returns the route's path *template*, e.g.
 * "/c/:cluster/pods" — the literal ":cluster" placeholder, not the actual
 * cluster name (confirmed live: `Router.getRoutePath(Router.getRoute('pods'))`
 * returns exactly "/c/:cluster/pods"). Built-in resource list routes are
 * otherwise static (no `:namespace`/`:name` segments — namespace filtering
 * happens client-side), so resolving that one placeholder and comparing
 * directly is sufficient. This avoids depending on undocumented
 * router-matching internals like path-to-regexp.
 */
function matchesListPath(pathname: string, routePath: string, cluster: string | null): boolean {
  const resolvedRoutePath = cluster
    ? routePath.replace(':cluster', encodeURIComponent(cluster))
    : routePath;
  return (
    pathname === resolvedRoutePath ||
    `${pathname}/` === resolvedRoutePath ||
    pathname === `${resolvedRoutePath}/`
  );
}

/**
 * "Save Current View" has to capture state while the user is actually on a
 * resource list page — by the time they've navigated to the Saved Views
 * page itself, `window.location` no longer reflects that page, so a button
 * that only lives on the Saved Views page can never observe it (confirmed
 * live against a real Headlamp instance, not just unit tests). The fix is
 * a `registerAppBarAction` button that's present everywhere, which captures
 * the view at click time and hands it to the Saved Views page via query
 * parameters on navigation — a plain, public URL mechanism, not shared
 * component state or storage.
 */
export const CAPTURE_CLUSTER_PARAM = 'svCluster';
export const CAPTURE_RESOURCE_ROUTE_PARAM = 'svResource';

export function buildCaptureQueryParams(capture: CurrentViewCapture): string {
  const params = new URLSearchParams();
  if (capture.cluster) {
    params.set(CAPTURE_CLUSTER_PARAM, capture.cluster);
  }
  if (capture.resource) {
    params.set(CAPTURE_RESOURCE_ROUTE_PARAM, capture.resource.routeName);
  }
  return params.toString();
}

export interface ParsedCaptureParams {
  cluster: string | null;
  resourceRouteName: string | null;
}

export function parseCaptureQueryParams(search: string): ParsedCaptureParams {
  const params = new URLSearchParams(search);
  return {
    cluster: params.get(CAPTURE_CLUSTER_PARAM),
    resourceRouteName: params.get(CAPTURE_RESOURCE_ROUTE_PARAM),
  };
}
