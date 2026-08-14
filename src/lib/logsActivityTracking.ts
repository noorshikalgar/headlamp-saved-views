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

import { DefaultHeadlampEvents, HeadlampEvent, registerHeadlampEventCallback } from '@kinvolk/headlamp-plugin/lib';

/**
 * Headlamp's "Logs" viewer (opened via the pod details view's "Show Logs"
 * action) is a separate Activity popup — not rendered through
 * registerDetailsViewSection, confirmed live: it has none of a resource
 * details view's sections, just its own container/lines/follow controls.
 * There is no registration point for content *inside* that Activity.
 *
 * registerHeadlampEventCallback fires a public LOGS event on open/close.
 * Its documented type includes an optional `resource` field, but checked
 * live against a real instance: that field is actually absent on the real
 * payload (only `status` comes through) — the type's `?` undersold how
 * unreliable it is. So the event is used only as a trigger, not a data
 * source: `SaveResourceDetailsAction` already has direct access to the
 * resource via its own props (registerDetailsViewSection), and is the
 * *only* place "Show Logs" can be clicked from, so it records itself as
 * the last-viewed details resource; when the LOGS event announces "open",
 * that's attributed to whatever was last recorded. Two independent public
 * signals combined via ordinary component lifecycle — not reading
 * anything private.
 *
 * registerHeadlampEventCallback appends to a list of callbacks on every
 * call (the same pattern as registerSidebarEntryFilter — see
 * DECISIONS.md), so this is registered exactly once, at module load.
 */
export interface TrackedLogsResource {
  kind: string;
  cluster: string;
  name?: string;
  namespace?: string;
}

let lastViewedDetailsResource: TrackedLogsResource | null = null;
let currentLogsResource: TrackedLogsResource | null = null;

/** Called by SaveResourceDetailsAction whenever a resource's details view mounts/unmounts. */
export function trackDetailsResource(resource: TrackedLogsResource | null): void {
  lastViewedDetailsResource = resource;
}

export function getCurrentLogsResource(): TrackedLogsResource | null {
  return currentLogsResource;
}

interface LogsEventData {
  status?: 'open' | 'closed';
}

registerHeadlampEventCallback((event: HeadlampEvent) => {
  if (event.type !== DefaultHeadlampEvents.LOGS) {
    return;
  }
  const status = (event as HeadlampEvent & { data?: LogsEventData }).data?.status;
  currentLogsResource = status === 'open' ? lastViewedDetailsResource : null;
});
