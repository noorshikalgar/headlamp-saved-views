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

import { beforeEach, describe, expect, it } from 'vitest';
import { SavedView } from '../types';
import { loadConfig, store } from './configStore';
import { emptyConfig } from './migrations';

// These tests exercise the real ConfigStore (backed by Headlamp's real
// Redux store, which is a plain importable module — no live Headlamp app or
// browser storage required). They verify the migration layer is actually
// wired up to persistence, not just correct in isolation.

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

describe('loadConfig', () => {
  beforeEach(() => {
    store.set(emptyConfig());
  });

  it('returns an empty config when nothing has been persisted yet', () => {
    // Simulate a genuinely empty store by writing undefined directly, the
    // way it would look on a brand new install.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.set(undefined as any);
    expect(loadConfig()).toEqual(emptyConfig());
  });

  it('reflects a value written through the store', () => {
    const view = makeView();
    store.set({ schemaVersion: 1, views: [view] });
    expect(loadConfig()).toEqual({ schemaVersion: 1, views: [view] });
  });

  it('migrates malformed persisted data instead of throwing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.set({ schemaVersion: 1, views: [{ id: 'bad' }] } as any);
    expect(() => loadConfig()).not.toThrow();
    expect(loadConfig()).toEqual(emptyConfig());
  });
});
