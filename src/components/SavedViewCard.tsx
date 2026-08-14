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
import { ConfirmButton, Link } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ClusterResolution } from '../lib/clusterIdentity';
import { buildSavedViewUrl } from '../lib/savedViewUrl';
import { SavedView } from '../types';

export interface SavedViewCardProps {
  view: SavedView;
  clusterStatus: ClusterResolution;
  resourceAvailable: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

export function SavedViewCard({
  view,
  clusterStatus,
  resourceAvailable,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
}: SavedViewCardProps) {
  const canOpen = clusterStatus.status === 'found' && resourceAvailable;
  const { unappliedFilters } = buildSavedViewUrl(view);

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2 }}
      component="article"
      aria-label={`Saved view: ${view.name}`}
    >
      <Stack spacing={1.5}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle1" component="h3" sx={{ wordBreak: 'break-word' }}>
                {view.name}
              </Typography>
              <Chip size="small" label={view.resource.kind} />
            </Stack>
            {view.description && (
              <Typography variant="body2" color="text.secondary">
                {view.description}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" component="div">
              Cluster: {view.cluster}
              {view.filters.namespaces?.length
                ? ` · Namespaces: ${view.filters.namespaces.join(', ')}`
                : ''}
            </Typography>
          </Box>
          <IconButton
            aria-label={view.favorite ? `Unfavorite ${view.name}` : `Favorite ${view.name}`}
            aria-pressed={view.favorite}
            onClick={onToggleFavorite}
            size="small"
          >
            <Icon icon={view.favorite ? 'mdi:star' : 'mdi:star-outline'} width={20} />
          </IconButton>
        </Box>

        {clusterStatus.status === 'not-found' && (
          <Alert severity="warning">
            Cluster &quot;{view.cluster}&quot; is not currently configured in Headlamp.
          </Alert>
        )}
        {clusterStatus.status === 'found' && !resourceAvailable && (
          <Alert severity="warning">
            &quot;{view.resource.kind}&quot; is not available on this cluster right now (it may be a
            removed CRD or an unregistered resource type).
          </Alert>
        )}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {canOpen ? (
            <Link
              routeName={view.resource.routeName}
              params={{ cluster: view.cluster }}
              tooltip={false}
            >
              <Button
                variant="contained"
                size="small"
                component="span"
                startIcon={<Icon icon="mdi:open-in-new" width={16} />}
              >
                Open
              </Button>
            </Link>
          ) : (
            <Button variant="contained" size="small" disabled>
              Open
            </Button>
          )}
          <Button
            size="small"
            onClick={onEdit}
            startIcon={<Icon icon="mdi:pencil-outline" width={16} />}
          >
            Edit
          </Button>
          <Button
            size="small"
            onClick={onDuplicate}
            startIcon={<Icon icon="mdi:content-copy" width={16} />}
          >
            Duplicate
          </Button>
          <ConfirmButton
            size="small"
            color="error"
            confirmTitle="Delete saved view?"
            confirmDescription={`This will permanently delete "${view.name}". This cannot be undone.`}
            onConfirm={onDelete}
            ariaLabel={`Delete ${view.name}`}
            startIcon={<Icon icon="mdi:delete-outline" width={16} />}
          >
            Delete
          </ConfirmButton>
        </Stack>

        {canOpen && unappliedFilters.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            After opening, apply manually — {unappliedFilters.join(' · ')}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
