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
import {
  isValidFilters,
  isValidResourceRef,
  isValidSavedView,
  validateNewSavedViewInput,
} from './validation';

const validResource = {
  kind: 'Pod',
  apiVersion: 'v1',
  routeName: 'pods',
  scope: 'namespaced' as const,
};

function makeValidView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: 'view-1',
    schemaVersion: 1,
    name: 'My view',
    cluster: 'prod',
    resource: validResource,
    filters: {},
    favorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('isValidResourceRef', () => {
  it('accepts a well-formed resource ref', () => {
    expect(isValidResourceRef(validResource)).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(isValidResourceRef(null)).toBe(false);
    expect(isValidResourceRef(undefined)).toBe(false);
    expect(isValidResourceRef('pods')).toBe(false);
    expect(isValidResourceRef([])).toBe(false);
  });

  it('rejects an invalid scope value', () => {
    expect(isValidResourceRef({ ...validResource, scope: 'global' })).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(isValidResourceRef({ ...validResource, kind: '' })).toBe(false);
    expect(isValidResourceRef({ ...validResource, apiVersion: undefined })).toBe(false);
  });
});

describe('isValidFilters', () => {
  it('accepts empty filters', () => {
    expect(isValidFilters({})).toBe(true);
  });

  it('rejects undefined/null', () => {
    expect(isValidFilters(undefined)).toBe(false);
    expect(isValidFilters(null)).toBe(false);
  });

  it('accepts populated, in-bounds filters', () => {
    expect(
      isValidFilters({
        namespaces: ['default', 'kube-system'],
        search: 'crash',
        labelSelector: 'app=nginx',
      })
    ).toBe(true);
  });

  it('rejects an oversized search string', () => {
    expect(isValidFilters({ search: 'x'.repeat(LIMITS.MAX_SEARCH_LENGTH + 1) })).toBe(false);
  });

  it('rejects an oversized label selector', () => {
    expect(
      isValidFilters({ labelSelector: 'x'.repeat(LIMITS.MAX_LABEL_SELECTOR_LENGTH + 1) })
    ).toBe(false);
  });

  it('rejects too many namespaces', () => {
    const namespaces = Array.from({ length: LIMITS.MAX_NAMESPACES + 1 }, (_, i) => `ns-${i}`);
    expect(isValidFilters({ namespaces })).toBe(false);
  });

  it('rejects a non-array namespaces field', () => {
    expect(isValidFilters({ namespaces: 'default' })).toBe(false);
  });
});

describe('validateNewSavedViewInput', () => {
  it('accepts fully valid input', () => {
    const result = validateNewSavedViewInput({
      name: 'Prod crashing pods',
      cluster: 'prod',
      resource: validResource,
      filters: { search: 'CrashLoop' },
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects empty input with one error per missing field', () => {
    const result = validateNewSavedViewInput({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Name is required.');
    expect(result.errors).toContain('A cluster is required.');
    expect(result.errors).toContain('A resource type is required.');
  });

  it('rejects a name that is only whitespace', () => {
    const result = validateNewSavedViewInput({
      name: '   ',
      cluster: 'prod',
      resource: validResource,
    });
    expect(result.valid).toBe(false);
  });

  it('rejects an oversized name', () => {
    const result = validateNewSavedViewInput({
      name: 'x'.repeat(LIMITS.MAX_NAME_LENGTH + 1),
      cluster: 'prod',
      resource: validResource,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/80 characters/);
  });

  it('rejects an oversized description', () => {
    const result = validateNewSavedViewInput({
      name: 'ok',
      cluster: 'prod',
      resource: validResource,
      description: 'x'.repeat(LIMITS.MAX_DESCRIPTION_LENGTH + 1),
    });
    expect(result.valid).toBe(false);
  });

  it('collects multiple errors at once rather than stopping at the first', () => {
    const result = validateNewSavedViewInput({ name: '' });
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('isValidSavedView', () => {
  it('accepts a fully valid saved view', () => {
    expect(isValidSavedView(makeValidView())).toBe(true);
  });

  it('rejects malformed data without throwing', () => {
    expect(isValidSavedView(null)).toBe(false);
    expect(isValidSavedView(undefined)).toBe(false);
    expect(isValidSavedView('not an object')).toBe(false);
    expect(isValidSavedView(42)).toBe(false);
    expect(isValidSavedView([])).toBe(false);
  });

  it('rejects a view with a missing name', () => {
    const view = makeValidView() as unknown as Record<string, unknown>;
    delete view.name;
    expect(isValidSavedView(view)).toBe(false);
  });

  it('rejects a view with an invalid timestamp', () => {
    expect(isValidSavedView(makeValidView({ createdAt: 'not-a-date' }))).toBe(false);
  });

  it('rejects a view with a mismatched schema version', () => {
    // @ts-expect-error deliberately malformed for the test
    expect(isValidSavedView(makeValidView({ schemaVersion: 2 }))).toBe(false);
  });

  it('rejects a view with an invalid resource ref', () => {
    // @ts-expect-error deliberately malformed for the test
    expect(isValidSavedView(makeValidView({ resource: { kind: 'Pod' } }))).toBe(false);
  });

  it('rejects a view where favorite is not a boolean', () => {
    // @ts-expect-error deliberately malformed for the test
    expect(isValidSavedView(makeValidView({ favorite: 'yes' }))).toBe(false);
  });
});
