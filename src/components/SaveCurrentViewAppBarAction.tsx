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
import Button from '@mui/material/Button';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { buildCaptureDialogState, captureCurrentView, CaptureDialogState } from '../lib/currentView';
import { useSavedViews } from '../store/configStore';
import { SavedViewFormDialog } from './SavedViewFormDialog';

/**
 * Registered globally via registerAppBarAction so it's present wherever
 * this decides to render itself — but it only renders on pages
 * captureCurrentView() recognizes as a built-in resource list (Pods,
 * Services, ...), not on Settings, Home, or anywhere else there's nothing
 * meaningful to capture. `useLocation()` (react-router-dom, a shared
 * dependency, not a private internal) is what makes this reactive to route
 * changes — without it, nothing would trigger a re-render when the hash
 * changes, since captureCurrentView() reads window.location directly.
 *
 * This is the real "Save Current View" trigger; see currentView.ts for why
 * a button living only on the Saved Views page can't do this. The dialog
 * is rendered right here, not by navigating to the Saved Views page —
 * capture happens synchronously at click time, so there was never a reason
 * to leave the page the user was on. An earlier version did navigate away,
 * which was confusing in practice: it's fixed by owning the dialog
 * directly.
 */
export function SaveCurrentViewAppBarAction() {
  useLocation();
  const { create } = useSavedViews();
  const [dialogState, setDialogState] = useState<CaptureDialogState | null>(null);

  const capture = captureCurrentView();
  if (!capture.resource) {
    return null;
  }

  return (
    <>
      <Button
        size="small"
        onClick={() => setDialogState(buildCaptureDialogState(capture))}
        startIcon={<Icon icon="mdi:content-save-outline" width={16} />}
      >
        Save View
      </Button>
      {dialogState && (
        <SavedViewFormDialog
          open
          title="Create Saved View"
          submitLabel="Create"
          helperNote={dialogState.helperNote}
          initialValues={dialogState.initialValues}
          onClose={() => setDialogState(null)}
          onSubmit={create}
        />
      )}
    </>
  );
}
