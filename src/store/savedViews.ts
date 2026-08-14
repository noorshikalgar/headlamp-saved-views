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

import { LIMITS } from '../lib/limits';
import {
  NewSavedViewInput,
  SAVED_VIEW_SCHEMA_VERSION,
  SavedView,
  SavedViewsConfig,
  SavedViewUpdateInput,
} from '../types';
import { validateNewSavedViewInput } from './validation';

/**
 * All CRUD/search/sort logic operates on plain {@link SavedViewsConfig}
 * values and returns new values (no mutation, no ConfigStore, no React).
 * This keeps the business rules unit-testable without a live Headlamp
 * environment. See src/store/configStore.ts for the persistence wrapper.
 */

export type SavedViewOpResult =
  | { ok: true; config: SavedViewsConfig; view: SavedView }
  | { ok: false; errors: string[] };

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older test runners).
  return `sv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSavedView(
  config: SavedViewsConfig,
  input: NewSavedViewInput,
  now: Date = new Date()
): SavedViewOpResult {
  const validation = validateNewSavedViewInput(input);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }
  if (config.views.length >= LIMITS.MAX_VIEWS) {
    return {
      ok: false,
      errors: [
        `You have reached the maximum of ${LIMITS.MAX_VIEWS} saved views. Delete one before creating another.`,
      ],
    };
  }

  const timestamp = now.toISOString();
  const view: SavedView = {
    id: generateId(),
    schemaVersion: SAVED_VIEW_SCHEMA_VERSION,
    name: input.name,
    description: input.description,
    cluster: input.cluster,
    resource: input.resource,
    filters: input.filters ?? {},
    favorite: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return { ok: true, config: { ...config, views: [...config.views, view] }, view };
}

export function updateSavedView(
  config: SavedViewsConfig,
  id: string,
  patch: SavedViewUpdateInput,
  now: Date = new Date()
): SavedViewOpResult {
  const existing = config.views.find(v => v.id === id);
  if (!existing) {
    return { ok: false, errors: ['This saved view no longer exists.'] };
  }

  const merged: SavedView = {
    ...existing,
    ...patch,
    filters: patch.filters ?? existing.filters,
    updatedAt: now.toISOString(),
  };

  const validation = validateNewSavedViewInput(merged);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  return {
    ok: true,
    config: { ...config, views: config.views.map(v => (v.id === id ? merged : v)) },
    view: merged,
  };
}

export function duplicateSavedView(
  config: SavedViewsConfig,
  id: string,
  now: Date = new Date()
): SavedViewOpResult {
  const source = config.views.find(v => v.id === id);
  if (!source) {
    return { ok: false, errors: ['This saved view no longer exists.'] };
  }
  if (config.views.length >= LIMITS.MAX_VIEWS) {
    return {
      ok: false,
      errors: [
        `You have reached the maximum of ${LIMITS.MAX_VIEWS} saved views. Delete one before duplicating.`,
      ],
    };
  }

  const suffix = ' (copy)';
  const name =
    source.name.length + suffix.length <= LIMITS.MAX_NAME_LENGTH
      ? `${source.name}${suffix}`
      : `${source.name.slice(0, LIMITS.MAX_NAME_LENGTH - suffix.length)}${suffix}`;

  const timestamp = now.toISOString();
  const view: SavedView = {
    ...source,
    id: generateId(),
    name,
    favorite: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return { ok: true, config: { ...config, views: [...config.views, view] }, view };
}

/** Deleting a view that doesn't exist is a no-op, not an error — it's already gone. */
export function deleteSavedView(config: SavedViewsConfig, id: string): SavedViewsConfig {
  return { ...config, views: config.views.filter(v => v.id !== id) };
}

export function setFavorite(
  config: SavedViewsConfig,
  id: string,
  favorite: boolean,
  now: Date = new Date()
): SavedViewsConfig {
  return {
    ...config,
    views: config.views.map(v =>
      v.id === id ? { ...v, favorite, updatedAt: now.toISOString() } : v
    ),
  };
}

/**
 * Case-insensitive search across saved views only (never against live
 * Kubernetes resources) — name, description, cluster, resource kind, and
 * filter values.
 */
export function searchSavedViews(views: SavedView[], query: string): SavedView[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return views;
  }
  return views.filter(v => {
    const haystack = [
      v.name,
      v.description ?? '',
      v.cluster,
      v.resource.kind,
      v.filters.search ?? '',
      v.filters.labelSelector ?? '',
      ...(v.filters.namespaces ?? []),
    ]
      .join('\n')
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** Favorites first, then most-recently-updated within each group. */
export function sortSavedViews(views: SavedView[]): SavedView[] {
  return [...views].sort((a, b) => {
    if (a.favorite !== b.favorite) {
      return a.favorite ? -1 : 1;
    }
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}
