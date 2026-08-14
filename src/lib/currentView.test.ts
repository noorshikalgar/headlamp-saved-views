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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureCurrentView } from './currentView';

const mockGetCluster = vi.fn();
const mockGetRoute = vi.fn();
const mockGetRoutePath = vi.fn();

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  Utils: { getCluster: () => mockGetCluster() },
  Router: {
    getRoute: (name: string) => mockGetRoute(name),
    getRoutePath: (route: unknown) => mockGetRoutePath(route),
    createRouteURL: vi.fn(),
  },
  K8s: {
    ResourceClasses: {
      Pod: { kind: 'Pod', apiVersion: 'v1', isNamespaced: true, listRoute: 'pods' },
      Service: { kind: 'Service', apiVersion: 'v1', isNamespaced: true, listRoute: 'services' },
      Namespace: {
        kind: 'Namespace',
        apiVersion: 'v1',
        isNamespaced: false,
        listRoute: 'namespaces',
      },
    },
  },
}));

function setPathname(pathname: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname },
    writable: true,
  });
}

describe('captureCurrentView', () => {
  beforeEach(() => {
    mockGetCluster.mockReset();
    mockGetRoute.mockReset();
    mockGetRoutePath.mockReset();
    mockGetRoute.mockImplementation((name: string) => ({ path: `/${name}`, name }));
    mockGetRoutePath.mockImplementation((route: { path: string }) => route.path);
  });

  it('captures the cluster and resource when the path matches a known list route', () => {
    mockGetCluster.mockReturnValue('prod');
    setPathname('/c/prod/pods');

    const result = captureCurrentView();
    expect(result.cluster).toBe('prod');
    expect(result.resource?.kind).toBe('Pod');
  });

  it('returns a null resource when the path matches no known list route', () => {
    mockGetCluster.mockReturnValue('prod');
    setPathname('/c/prod/some-unrelated-page');

    const result = captureCurrentView();
    expect(result.cluster).toBe('prod');
    expect(result.resource).toBeNull();
  });

  it('handles a cluster-scoped resource whose route has no cluster prefix collision', () => {
    mockGetCluster.mockReturnValue('prod');
    setPathname('/c/prod/namespaces');

    const result = captureCurrentView();
    expect(result.resource?.kind).toBe('Namespace');
  });

  it('returns a null cluster when Utils.getCluster returns null', () => {
    mockGetCluster.mockReturnValue(null);
    setPathname('/pods');

    const result = captureCurrentView();
    expect(result.cluster).toBeNull();
  });

  it('does not match a route whose name only appears as a URL substring', () => {
    mockGetCluster.mockReturnValue('prod');
    setPathname('/c/prod/pods-extended-view');

    const result = captureCurrentView();
    expect(result.resource).toBeNull();
  });

  it('does not crash when a resource route is not registered', () => {
    mockGetCluster.mockReturnValue('prod');
    mockGetRoute.mockReturnValue(undefined);
    setPathname('/c/prod/pods');

    expect(() => captureCurrentView()).not.toThrow();
    expect(captureCurrentView().resource).toBeNull();
  });
});
