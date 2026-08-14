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

export interface ResolvedSavedViewUrl {
  /** Deterministic deep link to the resource's built-in list view for this cluster. */
  url: string;
  /**
   * Human-readable descriptions of filters that could not be encoded into
   * the URL and must be applied manually. Built-in list routes don't carry
   * namespace/search/label-selector state in the URL (see DECISIONS.md
   * Decision B), so a saved view with filters navigates to the correct
   * cluster + resource and surfaces the rest here rather than silently
   * dropping it.
   */
  unappliedFilters: string[];
}

/**
 * Builds the URL to open for a saved view, using Headlamp's own
 * `Router.createRouteURL` rather than hand-constructing a path string, so
 * it stays correct if Headlamp's URL scheme changes.
 */
export function buildSavedViewUrl(view: SavedView): ResolvedSavedViewUrl {
  const url = Router.createRouteURL(view.resource.routeName, { cluster: view.cluster });

  const unappliedFilters: string[] = [];
  if (view.filters.namespaces?.length) {
    unappliedFilters.push(`Namespace: ${view.filters.namespaces.join(', ')}`);
  }
  if (view.filters.search) {
    unappliedFilters.push(`Search: "${view.filters.search}"`);
  }
  if (view.filters.labelSelector) {
    unappliedFilters.push(`Label selector: ${view.filters.labelSelector}`);
  }

  return { url, unappliedFilters };
}
