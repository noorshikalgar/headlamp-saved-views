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
 * A saved view's cluster reference is a *name*, not a guaranteed-unique
 * identity — Headlamp's public API (`getCluster()`) only exposes the
 * `:cluster` URL path segment, which is the cluster's configured display
 * name. Two differently configured clusters sharing a name are
 * indistinguishable to a plugin. See DECISIONS.md Decision C.
 */
export type ClusterResolution =
  | { status: 'found' }
  | { status: 'not-found' }
  /** `useClustersConf()` returns null until Headlamp has loaded cluster config. */
  | { status: 'loading' };

/**
 * Checks whether `clusterName` currently corresponds to a configured
 * cluster, using the same `configuredClusters` map returned by the public
 * `K8s.useClustersConf()` hook.
 */
export function resolveClusterStatus(
  clusterName: string,
  configuredClusters: Record<string, unknown> | null | undefined
): ClusterResolution {
  if (configuredClusters === null || configuredClusters === undefined) {
    return { status: 'loading' };
  }
  if (Object.prototype.hasOwnProperty.call(configuredClusters, clusterName)) {
    return { status: 'found' };
  }
  return { status: 'not-found' };
}
