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
import { buildSavedViewUrl } from './savedViewUrl';

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

describe('buildSavedViewUrl', () => {
  beforeEach(() => {
    mockCreateRouteURL.mockReset();
    mockCreateRouteURL.mockReturnValue('/c/prod/pods');
  });

  it('delegates URL construction to Router.createRouteURL with the resource route name and cluster', () => {
    buildSavedViewUrl(makeView());
    expect(mockCreateRouteURL).toHaveBeenCalledWith('pods', { cluster: 'prod' });
  });

  it('returns the URL Router.createRouteURL produces', () => {
    mockCreateRouteURL.mockReturnValue('/c/prod/pods');
    const result = buildSavedViewUrl(makeView());
    expect(result.url).toBe('/c/prod/pods');
  });

  it('reports no unapplied filters when the view has none', () => {
    const result = buildSavedViewUrl(makeView({ filters: {} }));
    expect(result.unappliedFilters).toEqual([]);
  });

  it('reports namespace, search, and label selector as unapplied filters', () => {
    const result = buildSavedViewUrl(
      makeView({
        filters: {
          namespaces: ['payments', 'billing'],
          search: 'CrashLoop',
          labelSelector: 'app=api',
        },
      })
    );
    expect(result.unappliedFilters).toEqual([
      'Namespace: payments, billing',
      'Search: "CrashLoop"',
      'Label selector: app=api',
    ]);
  });

  it('omits filter descriptions for filters that were not set', () => {
    const result = buildSavedViewUrl(makeView({ filters: { search: 'CrashLoop' } }));
    expect(result.unappliedFilters).toEqual(['Search: "CrashLoop"']);
  });
});
