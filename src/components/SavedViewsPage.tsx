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
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { EmptyContent, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';
import { ClusterResolution, resolveClusterStatus } from '../lib/clusterIdentity';
import {
  captureCurrentView,
  CurrentViewCapture,
  parseCaptureQueryParams,
} from '../lib/currentView';
import { findResourceByRouteName } from '../lib/resourceCatalog';
import { useSavedViews } from '../store/configStore';
import { searchSavedViews, sortSavedViews } from '../store/savedViews';
import { NewSavedViewInput, SavedView } from '../types';
import { SavedViewFormDialog } from './SavedViewFormDialog';
import { SavedViewsTable } from './SavedViewsTable';

type DialogState =
  | { mode: 'closed' }
  | { mode: 'create'; initialValues?: Partial<NewSavedViewInput>; helperNote?: string }
  | { mode: 'edit'; view: SavedView };

const CAPTURE_MATCHED_NOTE =
  'Cluster and resource type were captured from the page you saved from. Namespace filter and search ' +
  "text cannot be read from Headlamp's page state (see this plugin's README), so add them below if " +
  'you want them saved.';

const CAPTURE_UNMATCHED_NOTE =
  "That page isn't a recognized built-in resource list, so nothing could be prefilled automatically. " +
  'Fill in the fields below to save a view.';

/** Shared by the in-page button and the app-bar action handoff (see the mount effect below). */
function buildCaptureDialogState(capture: CurrentViewCapture): DialogState {
  if (!capture.resource) {
    return {
      mode: 'create',
      initialValues: capture.cluster ? { cluster: capture.cluster } : undefined,
      helperNote: CAPTURE_UNMATCHED_NOTE,
    };
  }
  return {
    mode: 'create',
    initialValues: { cluster: capture.cluster ?? '', resource: capture.resource },
    helperNote: CAPTURE_MATCHED_NOTE,
  };
}

export function SavedViewsPage() {
  const { views, create, update, duplicate, remove, toggleFavorite } = useSavedViews();
  const clustersConf = K8s.useClustersConf();
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState>({ mode: 'closed' });

  const visibleViews = useMemo(
    () => sortSavedViews(searchSavedViews(views, query)),
    [views, query]
  );

  // The app-bar "Save View" action (present on every page, including
  // resource lists) captures the current view and hands it off via query
  // params, since by the time this page has mounted, window.location no
  // longer reflects the page the user actually came from. Headlamp uses
  // hash-based routing, so that query string lives inside
  // window.location.hash (e.g. "#/c/x/saved-views?svCluster=x"), not
  // window.location.search.
  useEffect(() => {
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) {
      return;
    }
    const { cluster, resourceRouteName } = parseCaptureQueryParams(hash.slice(queryIndex));
    if (!cluster && !resourceRouteName) {
      return;
    }
    const capture: CurrentViewCapture = {
      cluster,
      resource: resourceRouteName ? findResourceByRouteName(resourceRouteName) ?? null : null,
    };
    setDialog(buildCaptureDialogState(capture));

    const cleanHash = hash.slice(0, queryIndex);
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search + cleanHash
    );
    // Only meant to run once, on mount, to consume a one-shot handoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSaveCurrentView() {
    setDialog(buildCaptureDialogState(captureCurrentView()));
  }

  function getClusterStatus(view: SavedView): ClusterResolution {
    return resolveClusterStatus(view.cluster, clustersConf);
  }

  return (
    <SectionBox title="Saved Views">
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Save a cluster, resource type, and filters so you can jump back to them later. Saved views
          are stored only in this browser and are never sent anywhere or written to Kubernetes.
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            onClick={handleSaveCurrentView}
            startIcon={<Icon icon="mdi:content-save-outline" width={18} />}
          >
            Save Current View
          </Button>
          <Button
            variant="outlined"
            onClick={() => setDialog({ mode: 'create' })}
            startIcon={<Icon icon="mdi:plus" width={18} />}
          >
            Create Saved View
          </Button>
        </Stack>

        {views.length > 0 && (
          <TextField
            label="Search saved views"
            value={query}
            onChange={e => setQuery(e.target.value)}
            size="small"
            sx={{ maxWidth: 400 }}
          />
        )}

        {views.length === 0 ? (
          <EmptyContent>
            {'No saved views yet. Navigate to a resource list and click "Save Current View", or create ' +
              'one manually.'}
          </EmptyContent>
        ) : (
          <SavedViewsTable
            views={visibleViews}
            getClusterStatus={getClusterStatus}
            onEdit={view => setDialog({ mode: 'edit', view })}
            onDuplicate={view => duplicate(view.id)}
            onDelete={view => remove(view.id)}
            onToggleFavorite={view => toggleFavorite(view.id, !view.favorite)}
            emptyMessage={`No saved views match "${query}".`}
          />
        )}
      </Stack>

      {dialog.mode !== 'closed' && (
        <SavedViewFormDialog
          open
          title={dialog.mode === 'create' ? 'Create Saved View' : 'Edit Saved View'}
          submitLabel={dialog.mode === 'create' ? 'Create' : 'Save'}
          helperNote={dialog.mode === 'create' ? dialog.helperNote : undefined}
          initialValues={dialog.mode === 'create' ? dialog.initialValues : dialog.view}
          onClose={() => setDialog({ mode: 'closed' })}
          onSubmit={input =>
            dialog.mode === 'create' ? create(input) : update(dialog.view.id, input)
          }
        />
      )}
    </SectionBox>
  );
}
