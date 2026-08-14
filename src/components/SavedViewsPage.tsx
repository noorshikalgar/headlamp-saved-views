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
import { useMemo, useState } from 'react';
import { resolveClusterStatus } from '../lib/clusterIdentity';
import { captureCurrentView } from '../lib/currentView';
import { findResourceByRouteName } from '../lib/resourceCatalog';
import { useSavedViews } from '../store/configStore';
import { searchSavedViews, sortSavedViews } from '../store/savedViews';
import { NewSavedViewInput, SavedView } from '../types';
import { SavedViewCard } from './SavedViewCard';
import { SavedViewFormDialog } from './SavedViewFormDialog';

type DialogState =
  | { mode: 'closed' }
  | { mode: 'create'; initialValues?: Partial<NewSavedViewInput>; helperNote?: string }
  | { mode: 'edit'; view: SavedView };

const CAPTURE_MATCHED_NOTE =
  'Cluster and resource type were captured from the current page. Namespace filter and search text ' +
  "cannot be read from Headlamp's page state (see this plugin's README), so add them below if you want them saved.";

const CAPTURE_UNMATCHED_NOTE =
  "This page isn't a recognized built-in resource list, so nothing could be prefilled automatically. " +
  'Fill in the fields below to save a view.';

export function SavedViewsPage() {
  const { views, create, update, duplicate, remove, toggleFavorite } = useSavedViews();
  const clustersConf = K8s.useClustersConf();
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState>({ mode: 'closed' });

  const visibleViews = useMemo(
    () => sortSavedViews(searchSavedViews(views, query)),
    [views, query]
  );

  function handleSaveCurrentView() {
    const capture = captureCurrentView();
    if (!capture.resource) {
      setDialog({
        mode: 'create',
        initialValues: capture.cluster ? { cluster: capture.cluster } : undefined,
        helperNote: CAPTURE_UNMATCHED_NOTE,
      });
      return;
    }
    setDialog({
      mode: 'create',
      initialValues: { cluster: capture.cluster ?? '', resource: capture.resource },
      helperNote: CAPTURE_MATCHED_NOTE,
    });
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
        ) : visibleViews.length === 0 ? (
          <EmptyContent>{`No saved views match "${query}".`}</EmptyContent>
        ) : (
          <Stack spacing={1.5}>
            {visibleViews.map(view => (
              <SavedViewCard
                key={view.id}
                view={view}
                clusterStatus={resolveClusterStatus(view.cluster, clustersConf)}
                resourceAvailable={!!findResourceByRouteName(view.resource.routeName)}
                onEdit={() => setDialog({ mode: 'edit', view })}
                onDuplicate={() => duplicate(view.id)}
                onDelete={() => remove(view.id)}
                onToggleFavorite={() => toggleFavorite(view.id, !view.favorite)}
              />
            ))}
          </Stack>
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
