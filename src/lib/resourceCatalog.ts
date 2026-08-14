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

import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { ResourceRef } from '../types';

/**
 * The resource picker (manual creation form + auto-capture) is built from
 * Headlamp's own `K8s.ResourceClasses` rather than a hand-maintained list of
 * kinds, so it automatically stays in sync as Headlamp adds, removes, or
 * renames built-in resource types across versions. This intentionally does
 * not attempt to enumerate CRDs/plugin-registered resources for v1 — those
 * aren't exposed through `ResourceClasses`, and a saved view referencing one
 * simply won't resolve later if the CRD is gone (handled gracefully, see
 * src/lib/savedViewUrl.ts).
 */
export function getResourceCatalog(): ResourceRef[] {
  const refs: ResourceRef[] = [];

  for (const ResourceClass of Object.values(K8s.ResourceClasses)) {
    try {
      const apiVersionValue = (ResourceClass as { apiVersion?: string | string[] }).apiVersion;
      const apiVersion = Array.isArray(apiVersionValue) ? apiVersionValue[0] : apiVersionValue;
      const kind = (ResourceClass as { kind?: string }).kind;
      const routeName = (ResourceClass as { listRoute?: string }).listRoute;
      const isNamespaced = (ResourceClass as { isNamespaced?: boolean }).isNamespaced;

      if (!kind || !apiVersion || !routeName) {
        continue;
      }

      refs.push({
        kind,
        apiVersion,
        routeName,
        scope: isNamespaced ? 'namespaced' : 'cluster',
      });
    } catch {
      // A resource class that doesn't expose the expected static metadata is
      // skipped rather than allowed to break the whole catalog.
      continue;
    }
  }

  // Some entries (e.g. Endpoint/Endpoints) alias to the same list route;
  // keep one per route name.
  const byRoute = new Map(refs.map(ref => [ref.routeName, ref]));
  return Array.from(byRoute.values()).sort((a, b) => a.kind.localeCompare(b.kind));
}

export function findResourceByRouteName(routeName: string): ResourceRef | undefined {
  return getResourceCatalog().find(ref => ref.routeName === routeName);
}

export function findResourceCatalogEntryByKind(kind: string): ResourceRef | undefined {
  return getResourceCatalog().find(ref => ref.kind === kind);
}
