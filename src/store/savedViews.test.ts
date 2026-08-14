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
import { LIMITS } from '../lib/limits';
import { NewSavedViewInput, SavedViewsConfig } from '../types';
import { emptyConfig } from './migrations';
import {
  createSavedView,
  deleteSavedView,
  duplicateSavedView,
  searchSavedViews,
  setFavorite,
  sortSavedViews,
  updateSavedView,
} from './savedViews';

const resource = { kind: 'Pod', apiVersion: 'v1', routeName: 'pods', scope: 'namespaced' as const };

const validInput: NewSavedViewInput = {
  name: 'Prod crashing pods',
  description: 'Pods in CrashLoopBackOff',
  cluster: 'prod',
  resource,
  filters: { search: 'CrashLoop' },
};

describe('createSavedView', () => {
  it('creates a view with generated id and timestamps', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const result = createSavedView(emptyConfig(), validInput, now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.view.id).toBeTruthy();
    expect(result.view.name).toBe('Prod crashing pods');
    expect(result.view.favorite).toBe(false);
    expect(result.view.createdAt).toBe(now.toISOString());
    expect(result.view.updatedAt).toBe(now.toISOString());
    expect(result.config.views).toHaveLength(1);
  });

  it('rejects invalid input without mutating the config', () => {
    const config = emptyConfig();
    const result = createSavedView(config, { name: '' } as NewSavedViewInput);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('enforces the maximum number of saved views', () => {
    const config: SavedViewsConfig = {
      schemaVersion: 1,
      views: Array.from({ length: LIMITS.MAX_VIEWS }, (_, i) => ({
        id: `v${i}`,
        schemaVersion: 1,
        name: `view ${i}`,
        cluster: 'prod',
        resource,
        filters: {},
        favorite: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })),
    };
    const result = createSavedView(config, validInput);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.errors[0]).toMatch(/maximum/);
    }
  });

  it('defaults empty/undefined filters to an empty object', () => {
    const result = createSavedView(emptyConfig(), { ...validInput, filters: undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.view.filters).toEqual({});
  });
});

describe('updateSavedView', () => {
  it('updates fields and bumps updatedAt while preserving createdAt', () => {
    const created = createSavedView(
      emptyConfig(),
      validInput,
      new Date('2026-01-01T00:00:00.000Z')
    );
    if (!created.ok) throw new Error('setup failed');

    const updated = updateSavedView(
      created.config,
      created.view.id,
      { name: 'Renamed' },
      new Date('2026-02-01T00:00:00.000Z')
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.view.name).toBe('Renamed');
    expect(updated.view.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(updated.view.updatedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('returns an error for a saved view that no longer exists', () => {
    const result = updateSavedView(emptyConfig(), 'missing-id', { name: 'x' });
    expect(result.ok).toBe(false);
  });

  it('rejects an update that would make the view invalid', () => {
    const created = createSavedView(emptyConfig(), validInput);
    if (!created.ok) throw new Error('setup failed');
    const result = updateSavedView(created.config, created.view.id, { name: '' });
    expect(result.ok).toBe(false);
  });
});

describe('duplicateSavedView', () => {
  it('creates a copy with a new id and "(copy)" suffix', () => {
    const created = createSavedView(emptyConfig(), validInput);
    if (!created.ok) throw new Error('setup failed');
    const result = duplicateSavedView(created.config, created.view.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.view.id).not.toBe(created.view.id);
    expect(result.view.name).toBe('Prod crashing pods (copy)');
    expect(result.config.views).toHaveLength(2);
  });

  it('truncates the name if the "(copy)" suffix would exceed the limit', () => {
    const longNameInput = { ...validInput, name: 'x'.repeat(LIMITS.MAX_NAME_LENGTH) };
    const created = createSavedView(emptyConfig(), longNameInput);
    if (!created.ok) throw new Error('setup failed');
    const result = duplicateSavedView(created.config, created.view.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.view.name.length).toBeLessThanOrEqual(LIMITS.MAX_NAME_LENGTH);
    expect(result.view.name.endsWith('(copy)')).toBe(true);
  });

  it('resets favorite on the duplicate', () => {
    const created = createSavedView(emptyConfig(), validInput);
    if (!created.ok) throw new Error('setup failed');
    const favorited = setFavorite(created.config, created.view.id, true);
    const result = duplicateSavedView(favorited, created.view.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.view.favorite).toBe(false);
  });

  it('returns an error when duplicating a missing view', () => {
    const result = duplicateSavedView(emptyConfig(), 'missing-id');
    expect(result.ok).toBe(false);
  });
});

describe('deleteSavedView', () => {
  it('removes the matching view', () => {
    const created = createSavedView(emptyConfig(), validInput);
    if (!created.ok) throw new Error('setup failed');
    const result = deleteSavedView(created.config, created.view.id);
    expect(result.views).toHaveLength(0);
  });

  it('is a no-op for an id that does not exist', () => {
    const config = emptyConfig();
    expect(deleteSavedView(config, 'nope')).toEqual(config);
  });
});

describe('setFavorite', () => {
  it('toggles the favorite flag and bumps updatedAt', () => {
    const created = createSavedView(
      emptyConfig(),
      validInput,
      new Date('2026-01-01T00:00:00.000Z')
    );
    if (!created.ok) throw new Error('setup failed');
    const result = setFavorite(
      created.config,
      created.view.id,
      true,
      new Date('2026-03-01T00:00:00.000Z')
    );
    expect(result.views[0].favorite).toBe(true);
    expect(result.views[0].updatedAt).toBe('2026-03-01T00:00:00.000Z');
  });
});

describe('searchSavedViews', () => {
  const view1 = {
    id: '1',
    schemaVersion: 1 as const,
    name: 'Prod crash loops',
    description: 'crashing pods',
    cluster: 'prod',
    resource,
    filters: { namespaces: ['payments'], labelSelector: 'app=api' },
    favorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const view2 = {
    ...view1,
    id: '2',
    name: 'Staging services',
    description: '',
    cluster: 'staging',
    filters: {},
  };

  it('matches by name case-insensitively', () => {
    expect(searchSavedViews([view1, view2], 'PROD')).toEqual([view1]);
  });

  it('matches by cluster', () => {
    expect(searchSavedViews([view1, view2], 'staging')).toEqual([view2]);
  });

  it('matches by namespace and label selector', () => {
    expect(searchSavedViews([view1, view2], 'payments')).toEqual([view1]);
    expect(searchSavedViews([view1, view2], 'app=api')).toEqual([view1]);
  });

  it('returns everything for an empty/whitespace query', () => {
    expect(searchSavedViews([view1, view2], '')).toEqual([view1, view2]);
    expect(searchSavedViews([view1, view2], '   ')).toEqual([view1, view2]);
  });

  it('returns nothing for a query that matches no saved view', () => {
    expect(searchSavedViews([view1, view2], 'no-such-thing')).toEqual([]);
  });
});

describe('sortSavedViews', () => {
  it('sorts favorites first, then most recently updated', () => {
    const base = {
      id: '',
      schemaVersion: 1 as const,
      name: '',
      cluster: 'prod',
      resource,
      filters: {},
      favorite: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const older = { ...base, id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' };
    const newer = { ...base, id: 'b', updatedAt: '2026-03-01T00:00:00.000Z' };
    const favoriteButOld = {
      ...base,
      id: 'c',
      favorite: true,
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    const result = sortSavedViews([older, newer, favoriteButOld]);
    expect(result.map(v => v.id)).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate the input array', () => {
    const views = [
      {
        id: 'a',
        schemaVersion: 1 as const,
        name: '',
        cluster: 'prod',
        resource,
        filters: {},
        favorite: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const original = [...views];
    sortSavedViews(views);
    expect(views).toEqual(original);
  });
});
