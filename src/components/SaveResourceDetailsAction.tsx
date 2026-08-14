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

import { ActionButton } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useState } from 'react';
import { findResourceCatalogEntryByKind } from '../lib/resourceCatalog';
import { useSavedViews } from '../store/configStore';
import { NewSavedViewInput } from '../types';
import { SavedViewFormDialog } from './SavedViewFormDialog';

/**
 * Minimal shape of what registerDetailsViewSection hands us — deliberately
 * loose (not importing KubeObject) since all we need is metadata, kind, and
 * cluster, and this keeps the component decoupled from the exact class.
 */
interface DetailsResource {
  kind: string;
  cluster: string;
  getName?: () => string;
  getNamespace?: () => string | undefined;
}

/**
 * A specific resource (a single pod, say) can't be captured from the app
 * bar's "Save View" — that only ever sees the underlying list page's URL,
 * never which resource's details/logs panel might be open on top of it
 * (Headlamp doesn't expose that to plugins). registerDetailsViewSection,
 * by contrast, is rendered inside the details view itself and is handed
 * the actual resource object — same whether that view is shown as a full
 * page or inside an Activity popup.
 *
 * There's no "specific resource" concept in the saved-view data model
 * (deliberately — see DECISIONS.md), so this captures the resource's exact
 * name as a search filter instead: opening the resulting saved view takes
 * you to the resource's list with a reminder to type that exact name,
 * which — since Headlamp's own search matches by name — narrows the list
 * down to just this one resource.
 */
export function SaveResourceDetailsAction({ resource }: { resource: DetailsResource | null }) {
  const { create } = useSavedViews();
  const [open, setOpen] = useState(false);

  if (!resource) {
    return null;
  }
  const catalogEntry = findResourceCatalogEntryByKind(resource.kind);
  if (!catalogEntry) {
    return null;
  }

  const name = resource.getName?.();
  const namespace = resource.getNamespace?.();

  const initialValues: Partial<NewSavedViewInput> = {
    cluster: resource.cluster,
    resource: catalogEntry,
    filters: {
      namespaces: namespace ? [namespace] : undefined,
      search: name,
    },
  };

  return (
    <>
      <ActionButton
        description={`Save a view for this ${resource.kind}`}
        icon="mdi:content-save-outline"
        onClick={() => setOpen(true)}
      />
      {open && (
        <SavedViewFormDialog
          open
          title="Create Saved View"
          submitLabel="Create"
          helperNote={
            `Prefilled from ${resource.kind} "${name}". Saved views don't target a single resource ` +
            'directly — this searches by its exact name instead, which narrows the list to just this ' +
            'one when you open it.'
          }
          initialValues={initialValues}
          onClose={() => setOpen(false)}
          onSubmit={create}
        />
      )}
    </>
  );
}
