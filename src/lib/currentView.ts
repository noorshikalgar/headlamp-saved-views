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
import { NewSavedViewInput, ResourceRef } from '../types';
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
 * resource list page — capture itself (above) already handles that
 * correctly, since it reads `window.location` synchronously at click time,
 * before any navigation happens. What it must NOT do is navigate the user
 * away to show the resulting dialog: an earlier version routed to the
 * Saved Views page and handed the capture off via URL query params, which
 * left the user on a different page than the one they clicked from — a
 * confusing detour for no reason, since nothing about opening a dialog
 * requires changing the route. Callers should render the create dialog
 * directly wherever the "Save View" trigger lives (see
 * `SaveCurrentViewAppBarAction.tsx`), using this function to compute its
 * prefilled values and explanatory note from a capture.
 */
export interface CaptureDialogState {
  initialValues?: Partial<NewSavedViewInput>;
  helperNote: string;
}

const CAPTURE_MATCHED_NOTE =
  'Captured: this cluster and resource type only — a general "Pod list" style view, not a specific ' +
  'pod, even if you had one open. Headlamp doesn’t expose to plugins whether a details panel is open ' +
  'on top of the list, only the underlying page (logs are an exception — see below if a specific ' +
  'pod\'s logs were open). Namespace filter and search text also can’t be read automatically, so add ' +
  'them below if you want them saved.';

const CAPTURE_UNMATCHED_NOTE =
  "That page isn't a recognized built-in resource list, so nothing could be prefilled automatically. " +
  'Fill in the fields below to save a view.';

export function buildCaptureDialogState(capture: CurrentViewCapture): CaptureDialogState {
  if (!capture.resource) {
    return {
      initialValues: capture.cluster ? { cluster: capture.cluster } : undefined,
      helperNote: CAPTURE_UNMATCHED_NOTE,
    };
  }
  return {
    initialValues: { cluster: capture.cluster ?? '', resource: capture.resource },
    helperNote: CAPTURE_MATCHED_NOTE,
  };
}

/**
 * If a specific resource's logs are currently open (tracked via the public
 * LOGS event — see logsActivityTracking.ts, since there is no way to read
 * this from the URL), enriches the base capture with that resource's exact
 * name. Only applies when the tracked resource's cluster and kind actually
 * match the current capture, so a stale tracked value (e.g. logs closed,
 * user navigated to an unrelated list) can't leak into an unrelated saved
 * view.
 */
export function enrichCaptureDialogStateWithLogsResource(
  base: CaptureDialogState,
  capture: CurrentViewCapture,
  logsResource: { kind: string; cluster: string; name?: string; namespace?: string } | null
): CaptureDialogState {
  if (
    !logsResource ||
    !capture.resource ||
    logsResource.cluster !== capture.cluster ||
    logsResource.kind !== capture.resource.kind
  ) {
    return base;
  }

  return {
    initialValues: {
      ...base.initialValues,
      filters: {
        namespaces: logsResource.namespace ? [logsResource.namespace] : undefined,
        resourceName: logsResource.name,
      },
    },
    helperNote:
      `Logs for ${logsResource.kind} "${logsResource.name}" are currently open — captured its exact ` +
      'name, so opening this saved view later jumps straight to it (its details page, where Show ' +
      "Logs is one click away — Headlamp doesn't expose a way to open the logs view itself directly).",
  };
}
