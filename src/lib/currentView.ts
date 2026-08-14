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
  const pathname = window.location.pathname;

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
 * Built-in resource list routes are static (no `:namespace`/`:name`
 * segments — namespace filtering happens client-side), so an exact match
 * after stripping the `/c/<cluster>` prefix is sufficient. This avoids
 * depending on undocumented router-matching internals.
 */
function matchesListPath(pathname: string, routePath: string, cluster: string | null): boolean {
  const prefix = cluster ? `/c/${encodeURIComponent(cluster)}` : '';
  const normalized =
    prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) || '/' : pathname;
  return (
    normalized === routePath || `${normalized}/` === routePath || normalized === `${routePath}/`
  );
}
