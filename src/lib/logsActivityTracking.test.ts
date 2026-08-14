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
// Imported once — the module registers its event callback as a side effect
// at load time (see the file's own comment on why that must happen exactly
// once, not reactively).
import { getCurrentLogsResource, trackDetailsResource } from './logsActivityTracking';

const mockRegisterHeadlampEventCallback = vi.hoisted(() => vi.fn());

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  DefaultHeadlampEvents: { LOGS: 'headlamp.logs' },
  registerHeadlampEventCallback: (cb: unknown) => mockRegisterHeadlampEventCallback(cb),
}));

function getRegisteredCallback(): (event: { type: string; data?: unknown }) => void {
  expect(mockRegisterHeadlampEventCallback).toHaveBeenCalledTimes(1);
  return mockRegisterHeadlampEventCallback.mock.calls[0][0];
}

describe('logsActivityTracking', () => {
  beforeEach(() => {
    trackDetailsResource(null);
  });

  it('registers exactly one event callback at module load', () => {
    expect(mockRegisterHeadlampEventCallback).toHaveBeenCalledTimes(1);
  });

  it('attributes a LOGS "open" event to the last-tracked details resource', () => {
    const resource = { kind: 'Pod', cluster: 'prod', name: 'my-pod', namespace: 'payments' };
    trackDetailsResource(resource);

    getRegisteredCallback()({ type: 'headlamp.logs', data: { status: 'open' } });

    expect(getCurrentLogsResource()).toEqual(resource);
  });

  it('clears the tracked logs resource on a "closed" event', () => {
    trackDetailsResource({ kind: 'Pod', cluster: 'prod', name: 'my-pod' });
    getRegisteredCallback()({ type: 'headlamp.logs', data: { status: 'open' } });
    expect(getCurrentLogsResource()).not.toBeNull();

    getRegisteredCallback()({ type: 'headlamp.logs', data: { status: 'closed' } });
    expect(getCurrentLogsResource()).toBeNull();
  });

  it('ignores events of a different type', () => {
    trackDetailsResource({ kind: 'Pod', cluster: 'prod', name: 'my-pod' });
    getRegisteredCallback()({ type: 'headlamp.terminal', data: { status: 'open' } });
    expect(getCurrentLogsResource()).toBeNull();
  });

  it('has nothing to attribute when a LOGS "open" event fires with no tracked resource', () => {
    getRegisteredCallback()({ type: 'headlamp.logs', data: { status: 'open' } });
    expect(getCurrentLogsResource()).toBeNull();
  });

  it('does not crash when the event has no data', () => {
    expect(() => getRegisteredCallback()({ type: 'headlamp.logs' })).not.toThrow();
    expect(getCurrentLogsResource()).toBeNull();
  });
});
