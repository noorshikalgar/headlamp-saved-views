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
import { ConfirmButton, Link, SimpleTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { ClusterResolution } from '../lib/clusterIdentity';
import { findResourceByRouteName } from '../lib/resourceCatalog';
import { buildSavedViewLinkTarget, buildSavedViewUrl } from '../lib/savedViewUrl';
import { SavedView } from '../types';

export interface SavedViewsTableProps {
  views: SavedView[];
  getClusterStatus: (view: SavedView) => ClusterResolution;
  onEdit: (view: SavedView) => void;
  onDuplicate: (view: SavedView) => void;
  onDelete: (view: SavedView) => void;
  onToggleFavorite: (view: SavedView) => void;
  emptyMessage: string;
}

/**
 * A compact, sortable table matching the layout Headlamp's own resource
 * lists use (SimpleTable, the same CSS-grid primitive), rather than a
 * custom card layout — fits more saved views on screen and feels native.
 */
export function SavedViewsTable({
  views,
  getClusterStatus,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
  emptyMessage,
}: SavedViewsTableProps) {
  return (
    <SimpleTable
      emptyMessage={emptyMessage}
      data={views}
      rowsPerPage={[10, 25, 50]}
      reflectInURL="savedViews"
      columns={[
        {
          label: 'Favorite',
          gridTemplate: 'min-content',
          getter: (view: SavedView) => (
            <IconButton
              aria-label={view.favorite ? `Unfavorite ${view.name}` : `Favorite ${view.name}`}
              aria-pressed={view.favorite}
              onClick={() => onToggleFavorite(view)}
              size="small"
            >
              <Icon icon={view.favorite ? 'mdi:star' : 'mdi:star-outline'} width={18} />
            </IconButton>
          ),
          sort: (a: SavedView, b: SavedView) => Number(b.favorite) - Number(a.favorite),
        },
        {
          label: 'Name',
          gridTemplate: '1.6fr',
          getter: (view: SavedView) => (
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                {view.name}
              </Typography>
              {view.description && (
                <Typography variant="caption" color="text.secondary" component="div">
                  {view.description}
                </Typography>
              )}
            </Box>
          ),
          sort: (a: SavedView, b: SavedView) => a.name.localeCompare(b.name),
        },
        {
          label: 'Resource',
          gridTemplate: 'min-content',
          getter: (view: SavedView) => {
            const resourceAvailable = !!findResourceByRouteName(view.resource.routeName);
            return (
              <Tooltip
                title={resourceAvailable ? '' : 'Not available on this cluster right now'}
                disableHoverListener={resourceAvailable}
              >
                <Chip
                  size="small"
                  label={view.resource.kind}
                  color={resourceAvailable ? 'default' : 'warning'}
                  icon={
                    resourceAvailable ? undefined : <Icon icon="mdi:alert-outline" width={14} />
                  }
                />
              </Tooltip>
            );
          },
          sort: (a: SavedView, b: SavedView) => a.resource.kind.localeCompare(b.resource.kind),
        },
        {
          label: 'Cluster',
          gridTemplate: '1fr',
          getter: (view: SavedView) => {
            const status = getClusterStatus(view);
            if (status.status === 'not-found') {
              return (
                <Tooltip title="Not currently configured in Headlamp">
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}
                  >
                    <Icon icon="mdi:alert-outline" width={16} />
                    <Typography variant="body2">{view.cluster}</Typography>
                  </Box>
                </Tooltip>
              );
            }
            return <Typography variant="body2">{view.cluster}</Typography>;
          },
          sort: (a: SavedView, b: SavedView) => a.cluster.localeCompare(b.cluster),
        },
        {
          label: 'Namespaces',
          gridTemplate: '1fr',
          getter: (view: SavedView) =>
            view.filters.namespaces?.length ? view.filters.namespaces.join(', ') : 'All',
        },
        {
          label: 'Actions',
          gridTemplate: 'min-content',
          getter: (view: SavedView) => {
            const status = getClusterStatus(view);
            const resourceAvailable = !!findResourceByRouteName(view.resource.routeName);
            const canOpen = status.status === 'found' && resourceAvailable;
            const { unappliedFilters } = buildSavedViewUrl(view);
            const linkTarget = buildSavedViewLinkTarget(view);
            const openTooltip = !canOpen
              ? status.status === 'not-found'
                ? 'Cluster not currently configured'
                : 'Resource not available on this cluster'
              : unappliedFilters.length > 0
              ? `Apply manually after opening: ${unappliedFilters.join(' · ')}`
              : 'Open';

            return (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title={openTooltip}>
                  <span>
                    {canOpen ? (
                      <Link
                        routeName={linkTarget.routeName}
                        params={linkTarget.params}
                        search={linkTarget.search}
                      >
                        <IconButton size="small" aria-label={`Open ${view.name}`}>
                          <Icon icon="mdi:open-in-new" width={18} />
                        </IconButton>
                      </Link>
                    ) : (
                      <IconButton size="small" aria-label={`Open ${view.name}`} disabled>
                        <Icon icon="mdi:open-in-new" width={18} />
                      </IconButton>
                    )}
                  </span>
                </Tooltip>
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    aria-label={`Edit ${view.name}`}
                    onClick={() => onEdit(view)}
                  >
                    <Icon icon="mdi:pencil-outline" width={18} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Duplicate">
                  <IconButton
                    size="small"
                    aria-label={`Duplicate ${view.name}`}
                    onClick={() => onDuplicate(view)}
                  >
                    <Icon icon="mdi:content-copy" width={16} />
                  </IconButton>
                </Tooltip>
                <ConfirmButton
                  size="small"
                  ariaLabel={`Delete ${view.name}`}
                  confirmTitle="Delete saved view?"
                  confirmDescription={`This will permanently delete "${view.name}". This cannot be undone.`}
                  onConfirm={() => onDelete(view)}
                  sx={{ minWidth: 0, p: '4px' }}
                >
                  <Icon icon="mdi:delete-outline" width={18} />
                </ConfirmButton>
              </Box>
            );
          },
        },
      ]}
    />
  );
}
