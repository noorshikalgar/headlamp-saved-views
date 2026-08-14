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

/**
 * Identifies a Kubernetes resource kind/list that a saved view targets.
 *
 * `routeName` is the path segment Headlamp's built-in sidebar/routes use for
 * this resource's list view (e.g. "pods", "services", "configmaps"). It is
 * what {@link file://./lib/savedViewUrl.ts} uses to build a deep link back
 * to the resource list.
 */
export interface ResourceRef {
  /** Kubernetes Kind, e.g. "Pod". */
  kind: string;
  /** apiVersion, e.g. "v1" or "apps/v1". */
  apiVersion: string;
  /** URL path segment for this resource's built-in list route. */
  routeName: string;
  /**
   * Headlamp's route name for this resource's own details page (e.g.
   * "Pod" for the "pods" list route), when Headlamp exposes one —
   * confirmed live via `K8s.ResourceClasses.Pod.detailsRoute === "Pod"`,
   * a static property inherited from Headlamp's base resource class. Used
   * to deep-link straight to one specific captured resource instead of a
   * filtered list — see `resourceName` on {@link SavedViewFilters}. Not
   * every resource class is guaranteed to expose this, so callers must
   * fall back to `routeName` + filters when it's absent.
   */
  detailsRoute?: string;
  /** Whether this resource is namespaced or cluster-scoped. */
  scope: 'namespaced' | 'cluster';
}

/**
 * Filters attached to a saved view. Only fields the user explicitly set are
 * present — nothing here is inferred from private application state.
 */
export interface SavedViewFilters {
  /** Namespace names to filter by. Omitted/empty means "all namespaces". */
  namespaces?: string[];
  /** Free-text search string, matched the same way Headlamp's own search box works. */
  search?: string;
  /** A Kubernetes label selector string, e.g. "app=nginx,tier!=frontend". */
  labelSelector?: string;
  /**
   * Exact name of one specific resource this view targets — always
   * captured from a resource's own details view or its logs Activity
   * (see SaveResourceDetailsAction, logsActivityTracking), never typed by
   * the user. When set alongside a `resource.detailsRoute`, opening this
   * view jumps straight to that resource's own details page instead of a
   * filtered list. Falls back to filtering the list by this name (same as
   * `search`) when no details route is available for the resource kind.
   */
  resourceName?: string;
}

/** The current schema version for a single saved view record. */
export const SAVED_VIEW_SCHEMA_VERSION = 1 as const;

export interface SavedView {
  /** Stable unique id, generated at creation time. */
  id: string;
  schemaVersion: typeof SAVED_VIEW_SCHEMA_VERSION;
  /** User-facing name. */
  name: string;
  /** Optional user-facing description. */
  description?: string;
  /** Cluster display name, as reported by Headlamp. See DECISIONS.md Decision C. */
  cluster: string;
  resource: ResourceRef;
  filters: SavedViewFilters;
  favorite: boolean;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp. */
  updatedAt: string;
}

/** The current schema version for the whole persisted config object. */
export const SAVED_VIEWS_CONFIG_SCHEMA_VERSION = 1 as const;

export interface SavedViewsConfig {
  schemaVersion: typeof SAVED_VIEWS_CONFIG_SCHEMA_VERSION;
  views: SavedView[];
}

/** Fields a caller supplies to create a new saved view. */
export type NewSavedViewInput = Pick<
  SavedView,
  'name' | 'description' | 'cluster' | 'resource' | 'filters'
>;

/** Fields a caller may change on an existing saved view. */
export type SavedViewUpdateInput = Partial<
  Pick<SavedView, 'name' | 'description' | 'cluster' | 'resource' | 'filters' | 'favorite'>
>;
