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
import { buildSavedViewBaseUrl, buildSavedViewSearchParams, buildSavedViewUrl } from './savedViewUrl';

const mockCreateRouteURL = vi.fn();

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  Router: { createRouteURL: (name: string, params?: unknown) => mockCreateRouteURL(name, params) },
}));

const resource = { kind: 'Pod', apiVersion: 'v1', routeName: 'pods', scope: 'namespaced' as const };

function makeView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: 'view-1',
    schemaVersion: 1,
    name: 'My view',
    cluster: 'prod',
    resource,
    filters: {},
    favorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

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

  it('combines namespace and search when both are set', () => {
    expect(
      buildSavedViewSearchParams(
        makeView({ filters: { namespaces: ['payments'], search: 'CrashLoop' } })
      )
    ).toEqual({ namespace: 'payments', filter: 'CrashLoop' });
  });

  it('does not include a param for label selector — there is no URL binding for it', () => {
    expect(buildSavedViewSearchParams(makeView({ filters: { labelSelector: 'app=api' } }))).toEqual(
      {}
    );
  });
});

describe('buildSavedViewBaseUrl', () => {
  beforeEach(() => {
    mockCreateRouteURL.mockReset();
    mockCreateRouteURL.mockReturnValue('/c/prod/pods');
  });

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
});

describe('buildSavedViewUrl', () => {
  beforeEach(() => {
    mockCreateRouteURL.mockReset();
    mockCreateRouteURL.mockReturnValue('/c/prod/pods');
  });

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
