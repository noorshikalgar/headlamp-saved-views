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

import { K8s } from '@kinvolk/headlamp-plugin/lib';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';
import { LIMITS } from '../lib/limits';
import { getResourceCatalog } from '../lib/resourceCatalog';
import { NewSavedViewInput, ResourceRef } from '../types';

export interface SavedViewFormDialogProps {
  open: boolean;
  title: string;
  /** Explains why fields are (or aren't) prefilled, shown for the "Save Current View" flow. */
  helperNote?: string;
  initialValues?: Partial<NewSavedViewInput>;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (input: NewSavedViewInput) => { ok: boolean; errors?: string[] };
}

const emptyValues = (): NewSavedViewInput => ({
  name: '',
  description: '',
  cluster: '',
  resource: undefined as unknown as ResourceRef,
  filters: {},
});

/**
 * Shared create/edit form. Namespaces are entered as free text rather than
 * fetched from the cluster, because a user may not have permission to list
 * namespaces (see the master instruction's RBAC guidance) — asking them to
 * type the ones they care about avoids that assumption entirely.
 */
export function SavedViewFormDialog({
  open,
  title,
  helperNote,
  initialValues,
  submitLabel,
  onClose,
  onSubmit,
}: SavedViewFormDialogProps) {
  const clustersConf = K8s.useClustersConf();
  const clusterNames = Object.keys(clustersConf ?? {});
  const resourceCatalog = getResourceCatalog();

  const [values, setValues] = useState<NewSavedViewInput>(() => ({
    ...emptyValues(),
    ...initialValues,
  }));
  const [errors, setErrors] = useState<string[]>([]);
  const [namespaceInput, setNamespaceInput] = useState('');

  useEffect(() => {
    if (open) {
      setValues({ ...emptyValues(), ...initialValues });
      setErrors([]);
      setNamespaceInput('');
    }
    // Only reset when the dialog is (re)opened, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Commits whatever the user typed but didn't press Enter for, so losing
   * focus doesn't silently discard a namespace they clearly meant to add. */
  function commitPendingNamespace() {
    const trimmed = namespaceInput.trim();
    if (!trimmed) {
      return;
    }
    setValues(v => ({
      ...v,
      filters: { ...v.filters, namespaces: [...(v.filters?.namespaces ?? []), trimmed] },
    }));
    setNamespaceInput('');
  }

  const selectedResource =
    resourceCatalog.find(
      ref => ref.kind === values.resource?.kind && ref.routeName === values.resource?.routeName
    ) ?? null;

  function handleSubmit() {
    // Merged inline rather than via commitPendingNamespace(), since a
    // setState call here wouldn't be reflected in `values` until after this
    // function returns — submitting must not silently drop typed-but-not
    // "Enter"-ed text.
    const pending = namespaceInput.trim();
    const submitValues = pending
      ? {
          ...values,
          filters: {
            ...values.filters,
            namespaces: [...(values.filters?.namespaces ?? []), pending],
          },
        }
      : values;

    const result = onSubmit(submitValues);
    if (!result.ok) {
      setErrors(result.errors ?? ['Could not save this view.']);
      return;
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="saved-view-form-title"
    >
      <DialogTitle id="saved-view-form-title">{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {helperNote && <Alert severity="info">{helperNote}</Alert>}
          {errors.length > 0 && (
            <Alert severity="error">
              <Stack spacing={0.5}>
                {errors.map(error => (
                  <span key={error}>{error}</span>
                ))}
              </Stack>
            </Alert>
          )}

          <TextField
            label="Name"
            value={values.name}
            onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
            required
            fullWidth
            inputProps={{ maxLength: LIMITS.MAX_NAME_LENGTH }}
            helperText={`${values.name.length}/${LIMITS.MAX_NAME_LENGTH}`}
          />

          <TextField
            label="Description"
            value={values.description ?? ''}
            onChange={e => setValues(v => ({ ...v, description: e.target.value }))}
            fullWidth
            multiline
            minRows={2}
            inputProps={{ maxLength: LIMITS.MAX_DESCRIPTION_LENGTH }}
          />

          <Autocomplete
            freeSolo
            options={clusterNames}
            value={values.cluster}
            onInputChange={(_e, newValue) => setValues(v => ({ ...v, cluster: newValue }))}
            renderInput={params => <TextField {...params} label="Cluster" required />}
          />

          <Autocomplete
            options={resourceCatalog}
            value={selectedResource}
            getOptionLabel={ref => ref.kind}
            isOptionEqualToValue={(a, b) => a.routeName === b.routeName}
            onChange={(_e, newValue) =>
              setValues(v => ({
                ...v,
                resource: newValue ?? (undefined as unknown as ResourceRef),
              }))
            }
            renderInput={params => <TextField {...params} label="Resource type" required />}
          />

          <Autocomplete
            multiple
            freeSolo
            options={[]}
            value={values.filters?.namespaces ?? []}
            inputValue={namespaceInput}
            onInputChange={(_e, newInputValue, reason) => {
              if (reason !== 'reset') {
                setNamespaceInput(newInputValue);
              }
            }}
            onChange={(_e, newValue) => {
              setValues(v => ({
                ...v,
                filters: { ...v.filters, namespaces: newValue as string[] },
              }));
              setNamespaceInput('');
            }}
            onBlur={commitPendingNamespace}
            renderInput={params => (
              <TextField
                {...params}
                label="Namespaces"
                helperText="Leave empty for all namespaces, or type namespace names and press Enter."
              />
            )}
          />

          <TextField
            label="Search text"
            value={values.filters?.search ?? ''}
            onChange={e =>
              setValues(v => ({ ...v, filters: { ...v.filters, search: e.target.value } }))
            }
            fullWidth
            inputProps={{ maxLength: LIMITS.MAX_SEARCH_LENGTH }}
            helperText="Matches the same way Headlamp's own search box does."
          />

          <TextField
            label="Label selector"
            value={values.filters?.labelSelector ?? ''}
            onChange={e =>
              setValues(v => ({ ...v, filters: { ...v.filters, labelSelector: e.target.value } }))
            }
            fullWidth
            inputProps={{ maxLength: LIMITS.MAX_LABEL_SELECTOR_LENGTH }}
            placeholder="app=nginx,tier!=frontend"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
