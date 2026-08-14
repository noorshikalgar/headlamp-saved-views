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

import { registerSidebarEntry, registerSidebarEntryFilter } from '@kinvolk/headlamp-plugin/lib';
import { useEffect } from 'react';
import { buildSavedViewBaseUrl } from '../lib/savedViewUrl';
import { useSavedViews } from '../store/configStore';
import { sortSavedViews } from '../store/savedViews';

/**
 * Small number of favorites pinned under the "Saved Views" sidebar entry,
 * per the master instruction's "do not create a huge sidebar list"
 * guidance.
 */
const MAX_PINNED_FAVORITES = 5;

const SLOT_NAME_PATTERN = /^saved-view-slot-(\d+)$/;

/**
 * `registerSidebarEntry` is a plain Redux dispatch under the hood
 * (confirmed by reading the bundled source), so it's safe to call
 * reactively as favorites change — each call updates the entry keyed by
 * `name`, it doesn't append.
 *
 * `registerSidebarEntryFilter`, however, *appends* to an array of filters
 * every time it's called (also confirmed by reading the source) — calling
 * it on every favorite change would accumulate filters forever. So it's
 * registered exactly once, at module load, reading a mutable slot count
 * that the sync effect below keeps up to date. Unused slots (e.g. only 2
 * favorites but 5 slots were ever used in this session) are hidden by the
 * filter rather than left as stale, empty sidebar entries — there is no
 * "unregister" for individual entries.
 */
let pinnedSlotCount = 0;

registerSidebarEntryFilter(entry => {
  const match = SLOT_NAME_PATTERN.exec(entry.name);
  if (match && Number(match[1]) >= pinnedSlotCount) {
    return null;
  }
  return entry;
});

/**
 * Registered via registerAppBarAction purely because that's Headlamp's
 * public way to mount a component for the lifetime of the app session,
 * across every page — this component renders no visible UI of its own.
 */
export function SidebarFavoritesSync() {
  const { views } = useSavedViews();

  useEffect(() => {
    const favorites = sortSavedViews(views.filter(view => view.favorite)).slice(
      0,
      MAX_PINNED_FAVORITES
    );

    // pinnedSlotCount must be set before dispatching, and every slot must be
    // dispatched on every run (not just the ones currently in use) — the
    // filter only gets *re-evaluated* when something actually changes in
    // Redux sidebar state. If favorites shrinks from 1 to 0, skipping the
    // dispatch for the now-unused slot would leave its stale entry visible
    // forever, since nothing would trigger the sidebar to re-render and
    // re-apply the filter with the updated count.
    pinnedSlotCount = favorites.length;

    for (let index = 0; index < MAX_PINNED_FAVORITES; index++) {
      const view = favorites[index];
      registerSidebarEntry({
        parent: 'saved-views',
        name: `saved-view-slot-${index}`,
        label: view ? view.name : '',
        // The URL is already resolved to the view's own cluster (which may
        // not be the currently selected one) via buildSavedViewBaseUrl, so
        // Headlamp must not additionally prefix it with the current
        // cluster's path. Deliberately the query-string-free base URL, not
        // buildSavedViewUrl's — see that function's doc for why a sidebar
        // url can't safely carry a query string.
        useClusterURL: false,
        url: view ? buildSavedViewBaseUrl(view) : '',
        icon: 'mdi:star',
      });
    }
  }, [views]);

  return null;
}
