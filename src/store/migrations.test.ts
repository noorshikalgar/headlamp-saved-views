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
import { SavedView } from '../types';
import { dedupeById, emptyConfig, migrateConfig } from './migrations';

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

describe('migrateConfig', () => {
  it('returns an empty config for undefined', () => {
    expect(migrateConfig(undefined)).toEqual(emptyConfig());
  });

  it('returns an empty config for null', () => {
    expect(migrateConfig(null)).toEqual(emptyConfig());
  });

  it('returns an empty config for a non-object', () => {
    expect(migrateConfig('garbage')).toEqual(emptyConfig());
    expect(migrateConfig(42)).toEqual(emptyConfig());
  });

  it('returns an empty config when views is missing entirely', () => {
    expect(migrateConfig({ schemaVersion: 1 })).toEqual(emptyConfig());
  });

  it('returns an empty config when views is not an array', () => {
    expect(migrateConfig({ schemaVersion: 1, views: 'nope' })).toEqual(emptyConfig());
  });

  it('passes through a valid config unchanged', () => {
    const view = makeView();
    const result = migrateConfig({ schemaVersion: 1, views: [view] });
    expect(result).toEqual({ schemaVersion: 1, views: [view] });
  });

  it('drops individually malformed entries without discarding the rest', () => {
    const good = makeView({ id: 'good' });
    const bad = { id: 'bad', name: '' }; // missing everything else
    const result = migrateConfig({ schemaVersion: 1, views: [good, bad] });
    expect(result.views).toEqual([good]);
  });

  it('drops an entry with a missing name', () => {
    const view = makeView() as unknown as Record<string, unknown>;
    delete view.name;
    const result = migrateConfig({ schemaVersion: 1, views: [view] });
    expect(result.views).toEqual([]);
  });

  it('never throws on deeply malformed input', () => {
    expect(() => migrateConfig({ views: [null, undefined, 1, 'x', [], {}] })).not.toThrow();
    expect(migrateConfig({ views: [null, undefined, 1, 'x', [], {}] }).views).toEqual([]);
  });

  it('caps the result at the maximum number of views', () => {
    const views = Array.from({ length: LIMITS.MAX_VIEWS + 20 }, (_, i) =>
      makeView({ id: `v${i}`, updatedAt: new Date(2026, 0, i + 1).toISOString() })
    );
    const result = migrateConfig({ schemaVersion: 1, views });
    expect(result.views.length).toBe(LIMITS.MAX_VIEWS);
  });
});

describe('dedupeById', () => {
  it('keeps the most recently updated entry for duplicate ids', () => {
    const older = makeView({ id: 'dup', name: 'older', updatedAt: '2026-01-01T00:00:00.000Z' });
    const newer = makeView({ id: 'dup', name: 'newer', updatedAt: '2026-02-01T00:00:00.000Z' });
    const result = dedupeById([older, newer]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('newer');
  });

  it('leaves views with unique ids untouched', () => {
    const a = makeView({ id: 'a' });
    const b = makeView({ id: 'b' });
    expect(dedupeById([a, b])).toEqual([a, b]);
  });

  it('handles an empty list', () => {
    expect(dedupeById([])).toEqual([]);
  });
});
