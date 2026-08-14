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
import { SavedView } from '../types';
import {
  buildSavedViewBaseUrl,
  buildSavedViewLinkTarget,
  buildSavedViewSearchParams,
  buildSavedViewUrl,
} from './savedViewUrl';

const mockCreateRouteURL = vi.fn();

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  Router: { createRouteURL: (name: string, params?: unknown) => mockCreateRouteURL(name, params) },
}));

const podResource = {
  kind: 'Pod',
  apiVersion: 'v1',
  routeName: 'pods',
  detailsRoute: 'Pod',
  scope: 'namespaced' as const,
};

const noDetailsRouteResource = {
  kind: 'Widget',
  apiVersion: 'v1',
  routeName: 'widgets',
  scope: 'namespaced' as const,
};

const nodeResource = {
  kind: 'Node',
  apiVersion: 'v1',
  routeName: 'nodes',
  detailsRoute: 'Node',
  scope: 'cluster' as const,
};

function makeView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: 'view-1',
    schemaVersion: 1,
    name: 'My view',
    cluster: 'prod',
    resource: podResource,
    filters: {},
    favorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockCreateRouteURL.mockReset();
  mockCreateRouteURL.mockImplementation((routeName: string, params: Record<string, string>) => {
    const segments = [`/c/${params.cluster}`];
    if (routeName === 'pods' || routeName === 'nodes' || routeName === 'widgets') {
      segments.push(`/${routeName}`);
    } else {
      // Details routes are keyed by kind (e.g. "Pod", "Node") — mimic
      // Headlamp's real list-route-lowercased-plural path shape.
      segments.push(`/${routeName.toLowerCase()}s`);
    }
    if (params.namespace) {
      segments.push(`/${params.namespace}`);
    }
    if (params.name) {
      segments.push(`/${params.name}`);
    }
    return segments.join('');
  });
});

describe('buildSavedViewSearchParams', () => {
  it('is empty when the view has no namespace/search filters', () => {
    expect(buildSavedViewSearchParams(makeView({ filters: {} }))).toEqual({});
  });

  it('joins multiple namespaces with a space (Headlamp encodes that as "+")', () => {
    expect(
      buildSavedViewSearchParams(makeView({ filters: { namespaces: ['payments', 'billing'] } }))
    ).toEqual({ namespace: 'payments billing' });
  });

  it('maps search text to the "filter" param — the name Headlamp actually binds to', () => {
    expect(buildSavedViewSearchParams(makeView({ filters: { search: 'CrashLoop' } }))).toEqual({
      filter: 'CrashLoop',
    });
  });

  it('falls back to resourceName for the filter param when there is no typed search', () => {
    expect(
      buildSavedViewSearchParams(makeView({ filters: { resourceName: 'payments-api-xyz' } }))
    ).toEqual({ filter: 'payments-api-xyz' });
  });

  it('prefers typed search over resourceName if somehow both are set', () => {
    expect(
      buildSavedViewSearchParams(
        makeView({ filters: { search: 'CrashLoop', resourceName: 'payments-api-xyz' } })
      )
    ).toEqual({ filter: 'CrashLoop' });
  });

  it('does not include a param for label selector — there is no URL binding for it', () => {
    expect(buildSavedViewSearchParams(makeView({ filters: { labelSelector: 'app=api' } }))).toEqual(
      {}
    );
  });
});

describe('buildSavedViewLinkTarget', () => {
  it('targets the list route with search params when there is no captured resourceName', () => {
    const target = buildSavedViewLinkTarget(
      makeView({ filters: { namespaces: ['payments'], search: 'CrashLoop' } })
    );
    expect(target).toEqual({
      routeName: 'pods',
      params: { cluster: 'prod' },
      search: { namespace: 'payments', filter: 'CrashLoop' },
    });
  });

  it('targets the resource details route when resourceName + detailsRoute + namespace are all present', () => {
    const target = buildSavedViewLinkTarget(
      makeView({ filters: { namespaces: ['payments'], resourceName: 'payments-api-xyz' } })
    );
    expect(target).toEqual({
      routeName: 'Pod',
      params: { cluster: 'prod', namespace: 'payments', name: 'payments-api-xyz' },
    });
  });

  it('targets the resource details route for a cluster-scoped resource without needing a namespace', () => {
    const target = buildSavedViewLinkTarget(
      makeView({ resource: nodeResource, filters: { resourceName: 'node-1' } })
    );
    expect(target).toEqual({
      routeName: 'Node',
      params: { cluster: 'prod', name: 'node-1' },
    });
  });

  it('falls back to the list when resourceName is set but the resource kind has no detailsRoute', () => {
    const target = buildSavedViewLinkTarget(
      makeView({ resource: noDetailsRouteResource, filters: { resourceName: 'widget-1' } })
    );
    expect(target.routeName).toBe('widgets');
    expect(target.search).toEqual({ filter: 'widget-1' });
  });

  it('falls back to the list when resourceName is set on a namespaced resource but no namespace was captured', () => {
    const target = buildSavedViewLinkTarget(makeView({ filters: { resourceName: 'payments-api-xyz' } }));
    expect(target.routeName).toBe('pods');
    expect(target.search).toEqual({ filter: 'payments-api-xyz' });
  });
});

describe('buildSavedViewBaseUrl', () => {
  it('delegates to Router.createRouteURL with the resource route name and cluster', () => {
    buildSavedViewBaseUrl(makeView());
    expect(mockCreateRouteURL).toHaveBeenCalledWith('pods', { cluster: 'prod' });
  });

  it('never includes a query string — required for registerSidebarEntry urls', () => {
    const url = buildSavedViewBaseUrl(
      makeView({ filters: { namespaces: ['payments'], search: 'CrashLoop' } })
    );
    expect(url).not.toContain('?');
  });

  it('resolves straight to the resource details path when captured, still with no query string', () => {
    const url = buildSavedViewBaseUrl(
      makeView({ filters: { namespaces: ['payments'], resourceName: 'payments-api-xyz' } })
    );
    expect(url).toBe('/c/prod/pods/payments/payments-api-xyz');
    expect(url).not.toContain('?');
  });
});

describe('buildSavedViewUrl', () => {
  it('returns the base URL unchanged when there are no namespace/search filters', () => {
    const result = buildSavedViewUrl(makeView({ filters: {} }));
    expect(result.url).toBe('/c/prod/pods');
  });

  it('appends namespace and filter query params when set', () => {
    const result = buildSavedViewUrl(
      makeView({ filters: { namespaces: ['payments', 'billing'], search: 'CrashLoop' } })
    );
    expect(result.url).toBe('/c/prod/pods?namespace=payments+billing&filter=CrashLoop');
  });

  it('links directly to the resource details page when a resourceName was captured', () => {
    const result = buildSavedViewUrl(
      makeView({ filters: { namespaces: ['payments'], resourceName: 'payments-api-xyz' } })
    );
    expect(result.url).toBe('/c/prod/pods/payments/payments-api-xyz');
  });

  it('reports no unapplied filters when the view has none', () => {
    const result = buildSavedViewUrl(makeView({ filters: {} }));
    expect(result.unappliedFilters).toEqual([]);
  });

  it('does not report namespace or search as unapplied — they are now baked into the URL', () => {
    const result = buildSavedViewUrl(
      makeView({ filters: { namespaces: ['payments'], search: 'CrashLoop' } })
    );
    expect(result.unappliedFilters).toEqual([]);
  });

  it('still reports label selector as unapplied — no known URL binding for it', () => {
    const result = buildSavedViewUrl(makeView({ filters: { labelSelector: 'app=api' } }));
    expect(result.unappliedFilters).toEqual(['Label selector: app=api']);
  });
});
