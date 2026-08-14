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

import { Icon } from '@iconify/react';
import { Router } from '@kinvolk/headlamp-plugin/lib';
import Button from '@mui/material/Button';
import { buildCaptureQueryParams, captureCurrentView } from '../lib/currentView';

/**
 * Registered globally via registerAppBarAction so it's present on whatever
 * page the user is actually viewing — including resource list pages. This
 * is the real "Save Current View" trigger; see currentView.ts for why a
 * button living only on the Saved Views page can't do this.
 */
export function SaveCurrentViewAppBarAction() {
  function handleClick() {
    const capture = captureCurrentView();
    if (!capture.cluster) {
      return;
    }
    const base = Router.createRouteURL('saved-views', { cluster: capture.cluster });
    const query = buildCaptureQueryParams(capture);
    window.location.hash = query ? `${base}?${query}` : base;
  }

  return (
    <Button
      size="small"
      onClick={handleClick}
      startIcon={<Icon icon="mdi:content-save-outline" width={16} />}
    >
      Save View
    </Button>
  );
}
