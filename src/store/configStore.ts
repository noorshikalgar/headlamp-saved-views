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

import { ConfigStore } from '@kinvolk/headlamp-plugin/lib';
import { useCallback } from 'react';
import { NewSavedViewInput, SavedView, SavedViewsConfig, SavedViewUpdateInput } from '../types';
import { emptyConfig, migrateConfig } from './migrations';
import {
  createSavedView,
  deleteSavedView,
  duplicateSavedView,
  SavedViewOpResult,
  setFavorite,
  updateSavedView,
} from './savedViews';

/**
 * One ConfigStore object per plugin, scoped to the user's Headlamp browser
 * profile (see DECISIONS.md "Persistence"). Saved views are local-only —
 * they are never written to Kubernetes and never leave the browser.
 */
export const store = new ConfigStore<SavedViewsConfig>('headlamp-saved-views');

/** Reads and migrates the persisted config. Never throws — see migrateConfig. */
export function loadConfig(): SavedViewsConfig {
  try {
    return migrateConfig(store.get());
  } catch {
    return emptyConfig();
  }
}

function saveConfig(config: SavedViewsConfig): void {
  store.set(config);
}

export interface UseSavedViewsResult {
  /** All saved views, migrated and validated, unsorted/unfiltered. */
  views: SavedView[];
  create: (input: NewSavedViewInput) => SavedViewOpResult;
  update: (id: string, patch: SavedViewUpdateInput) => SavedViewOpResult;
  duplicate: (id: string) => SavedViewOpResult;
  remove: (id: string) => void;
  toggleFavorite: (id: string, favorite: boolean) => void;
}

/**
 * React hook exposing the persisted saved views plus CRUD actions.
 * Re-renders whenever the underlying ConfigStore value changes (e.g. from
 * another action performed in the same session), via ConfigStore's own
 * `useConfig()` reactivity.
 */
export function useSavedViews(): UseSavedViewsResult {
  const useConfigHook = store.useConfig();
  const rawConfig = useConfigHook();
  const config = migrateConfig(rawConfig);

  const create = useCallback((input: NewSavedViewInput) => {
    const result = createSavedView(loadConfig(), input);
    if (result.ok) {
      saveConfig(result.config);
    }
    return result;
  }, []);

  const update = useCallback((id: string, patch: SavedViewUpdateInput) => {
    const result = updateSavedView(loadConfig(), id, patch);
    if (result.ok) {
      saveConfig(result.config);
    }
    return result;
  }, []);

  const duplicate = useCallback((id: string) => {
    const result = duplicateSavedView(loadConfig(), id);
    if (result.ok) {
      saveConfig(result.config);
    }
    return result;
  }, []);

  const remove = useCallback((id: string) => {
    saveConfig(deleteSavedView(loadConfig(), id));
  }, []);

  const toggleFavorite = useCallback((id: string, favorite: boolean) => {
    saveConfig(setFavorite(loadConfig(), id, favorite));
  }, []);

  return { views: config.views, create, update, duplicate, remove, toggleFavorite };
}
