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
import {
  buildCaptureQueryParams,
  captureCurrentView,
  parseCaptureQueryParams,
} from './currentView';

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

// Headlamp uses hash-based routing (window.location.pathname is always
// "/"; the real route lives in window.location.hash) — see currentView.ts.
function setHash(hash: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname: '/', hash },
    writable: true,
  });
}

describe('captureCurrentView', () => {
  beforeEach(() => {
    mockGetCluster.mockReset();
    mockGetRoute.mockReset();
    mockGetRoutePath.mockReset();
    // Router.getRoutePath() returns the path *template*, including the
    // literal ":cluster" placeholder — confirmed against a live instance.
    mockGetRoute.mockImplementation((name: string) => ({ path: `/c/:cluster/${name}`, name }));
    mockGetRoutePath.mockImplementation((route: { path: string }) => route.path);
  });

  it('captures the cluster and resource when the path matches a known list route', () => {
    mockGetCluster.mockReturnValue('prod');
    setHash('#/c/prod/pods');

    const result = captureCurrentView();
    expect(result.cluster).toBe('prod');
    expect(result.resource?.kind).toBe('Pod');
  });

  it('returns a null resource when the path matches no known list route', () => {
    mockGetCluster.mockReturnValue('prod');
    setHash('#/c/prod/some-unrelated-page');

    const result = captureCurrentView();
    expect(result.cluster).toBe('prod');
    expect(result.resource).toBeNull();
  });

  it('handles a cluster-scoped resource whose route has no cluster prefix collision', () => {
    mockGetCluster.mockReturnValue('prod');
    setHash('#/c/prod/namespaces');

    const result = captureCurrentView();
    expect(result.resource?.kind).toBe('Namespace');
  });

  it('returns a null cluster when Utils.getCluster returns null', () => {
    mockGetCluster.mockReturnValue(null);
    setHash('#/pods');

    const result = captureCurrentView();
    expect(result.cluster).toBeNull();
  });

  it('does not match a route whose name only appears as a URL substring', () => {
    mockGetCluster.mockReturnValue('prod');
    setHash('#/c/prod/pods-extended-view');

    const result = captureCurrentView();
    expect(result.resource).toBeNull();
  });

  it('does not crash when a resource route is not registered', () => {
    mockGetCluster.mockReturnValue('prod');
    mockGetRoute.mockReturnValue(undefined);
    setHash('#/c/prod/pods');

    expect(() => captureCurrentView()).not.toThrow();
    expect(captureCurrentView().resource).toBeNull();
  });

  it('falls back to pathname when there is no hash', () => {
    mockGetCluster.mockReturnValue('prod');
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/c/prod/pods', hash: '' },
      writable: true,
    });

    const result = captureCurrentView();
    expect(result.resource?.kind).toBe('Pod');
  });

  it('ignores a query string appended to the hash route', () => {
    mockGetCluster.mockReturnValue('prod');
    setHash('#/c/prod/pods?svCluster=prod');

    const result = captureCurrentView();
    expect(result.resource?.kind).toBe('Pod');
  });
});

describe('buildCaptureQueryParams / parseCaptureQueryParams', () => {
  it('round-trips a capture with both cluster and resource', () => {
    const capture = {
      cluster: 'prod',
      resource: { kind: 'Pod', apiVersion: 'v1', routeName: 'pods', scope: 'namespaced' as const },
    };
    const query = buildCaptureQueryParams(capture);
    expect(parseCaptureQueryParams(`?${query}`)).toEqual({
      cluster: 'prod',
      resourceRouteName: 'pods',
    });
  });

  it('round-trips a capture with only a cluster (unmatched route)', () => {
    const query = buildCaptureQueryParams({ cluster: 'prod', resource: null });
    expect(parseCaptureQueryParams(`?${query}`)).toEqual({
      cluster: 'prod',
      resourceRouteName: null,
    });
  });

  it('produces an empty query string when nothing was captured', () => {
    expect(buildCaptureQueryParams({ cluster: null, resource: null })).toBe('');
  });

  it('parses missing params as null rather than throwing', () => {
    expect(parseCaptureQueryParams('')).toEqual({ cluster: null, resourceRouteName: null });
    expect(parseCaptureQueryParams('?unrelated=1')).toEqual({
      cluster: null,
      resourceRouteName: null,
    });
  });

  it('URL-encodes a cluster name with special characters and decodes it back', () => {
    const query = buildCaptureQueryParams({ cluster: 'my cluster/name', resource: null });
    expect(parseCaptureQueryParams(`?${query}`).cluster).toBe('my cluster/name');
  });
});
