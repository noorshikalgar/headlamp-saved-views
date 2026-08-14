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
import { SAVED_VIEWS_CONFIG_SCHEMA_VERSION, SavedView, SavedViewsConfig } from '../types';
import { isValidSavedView } from './validation';

/** The value used whenever there is no usable persisted config. */
export function emptyConfig(): SavedViewsConfig {
  return { schemaVersion: SAVED_VIEWS_CONFIG_SCHEMA_VERSION, views: [] };
}

/**
 * Removes duplicate ids from a list of saved views, keeping whichever entry
 * was most recently updated. This never throws; it is a best-effort repair
 * of data that should not exist but must not crash the plugin if it does.
 */
export function dedupeById(views: SavedView[]): SavedView[] {
  const byId = new Map<string, SavedView>();
  for (const view of views) {
    const existing = byId.get(view.id);
    if (!existing || Date.parse(view.updatedAt) >= Date.parse(existing.updatedAt)) {
      byId.set(view.id, view);
    }
  }
  return Array.from(byId.values());
}

/**
 * Migrates whatever is currently persisted in ConfigStore into a valid,
 * current-schema {@link SavedViewsConfig}.
 *
 * This function must never throw. Undefined config, malformed JSON shapes,
 * unknown schema versions, entries with missing/invalid fields, and
 * duplicate ids are all handled by dropping or repairing the offending data
 * rather than failing. Invalid entries are silently excluded rather than
 * deleting the user's entire saved-views list.
 */
export function migrateConfig(raw: unknown): SavedViewsConfig {
  if (raw === undefined || raw === null || typeof raw !== 'object') {
    return emptyConfig();
  }

  const candidate = raw as Partial<SavedViewsConfig>;

  // Only schema version 1 exists today. Future versions should add a
  // migration step here (e.g. `if (candidate.schemaVersion === 1) { ... }`)
  // that transforms into the next version rather than discarding data.
  if (!Array.isArray(candidate.views)) {
    return emptyConfig();
  }

  const validViews = candidate.views.filter(isValidSavedView);
  const deduped = dedupeById(validViews).slice(0, LIMITS.MAX_VIEWS);

  return {
    schemaVersion: SAVED_VIEWS_CONFIG_SCHEMA_VERSION,
    views: deduped,
  };
}
