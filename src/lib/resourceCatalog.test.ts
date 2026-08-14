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

import { describe, expect, it } from 'vitest';
import {
  findResourceByRouteName,
  findResourceCatalogEntryByKind,
  getResourceCatalog,
} from './resourceCatalog';

// Deliberately exercised against the real `K8s.ResourceClasses` (no
// mocking) so this test fails loudly if Headlamp ever removes the static
// metadata (`kind`, `apiVersion`, `isNamespaced`, `listRoute`) this plugin
// depends on — see DECISIONS.md Decision B/E.
describe('getResourceCatalog', () => {
  it('returns a non-empty catalog built from K8s.ResourceClasses', () => {
    const catalog = getResourceCatalog();
    expect(catalog.length).toBeGreaterThan(0);
  });

  it('every entry has the fields a saved view needs', () => {
    for (const ref of getResourceCatalog()) {
      expect(ref.kind).toBeTruthy();
      expect(ref.apiVersion).toBeTruthy();
      expect(ref.routeName).toBeTruthy();
      expect(['namespaced', 'cluster']).toContain(ref.scope);
    }
  });

  it('includes the well-known namespaced Pod kind', () => {
    const pod = getResourceCatalog().find(ref => ref.kind === 'Pod');
    expect(pod).toBeDefined();
    expect(pod?.scope).toBe('namespaced');
  });

  // detailsRoute is a static property inherited via the ResourceClass
  // prototype chain (not an own property — confirmed live via
  // K8s.ResourceClasses.Pod.detailsRoute === "Pod", and it doesn't show up
  // via Object.getOwnPropertyNames but is readable directly). Verified
  // here against the real, unmocked K8s.ResourceClasses for the same
  // reason as the rest of this file: fail loudly if Headlamp ever removes
  // it.
  it("captures Pod's detailsRoute for deep-linking straight to one resource", () => {
    const pod = getResourceCatalog().find(ref => ref.kind === 'Pod');
    expect(pod?.detailsRoute).toBe('Pod');
  });

  it('includes at least one cluster-scoped kind', () => {
    const clusterScoped = getResourceCatalog().filter(ref => ref.scope === 'cluster');
    expect(clusterScoped.length).toBeGreaterThan(0);
  });

  it('has no duplicate route names', () => {
    const routeNames = getResourceCatalog().map(ref => ref.routeName);
    expect(new Set(routeNames).size).toBe(routeNames.length);
  });

  it('is sorted by kind', () => {
    const kinds = getResourceCatalog().map(ref => ref.kind);
    expect(kinds).toEqual([...kinds].sort((a, b) => a.localeCompare(b)));
  });
});

describe('findResourceByRouteName', () => {
  it('finds a known resource by its route name', () => {
    const pod = getResourceCatalog().find(ref => ref.kind === 'Pod');
    expect(pod).toBeDefined();
    if (!pod) return;
    expect(findResourceByRouteName(pod.routeName)).toEqual(pod);
  });

  it('returns undefined for an unknown route name', () => {
    expect(findResourceByRouteName('not-a-real-route-name')).toBeUndefined();
  });
});

describe('findResourceCatalogEntryByKind', () => {
  it('finds a known resource by its Kubernetes Kind', () => {
    expect(findResourceCatalogEntryByKind('Pod')).toEqual(
      getResourceCatalog().find(ref => ref.kind === 'Pod')
    );
  });

  it('returns undefined for an unknown kind', () => {
    expect(findResourceCatalogEntryByKind('NotARealKind')).toBeUndefined();
  });

  it('is case-sensitive, matching Kubernetes Kind casing exactly', () => {
    expect(findResourceCatalogEntryByKind('pod')).toBeUndefined();
  });
});
