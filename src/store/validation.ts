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

import { LIMITS } from '../lib/limits';
import { NewSavedViewInput, ResourceRef, SavedView, SavedViewFilters } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Type guard for a well-formed {@link ResourceRef}. Used both for form validation and migration sanitization. */
export function isValidResourceRef(value: unknown): value is ResourceRef {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    isNonEmptyString(value.kind) &&
    isNonEmptyString(value.apiVersion) &&
    isNonEmptyString(value.routeName) &&
    (value.scope === 'namespaced' || value.scope === 'cluster')
  );
}

/** Type guard for well-formed {@link SavedViewFilters}. Empty/omitted filters are valid. */
export function isValidFilters(value: unknown): value is SavedViewFilters {
  if (value === undefined || value === null) {
    return false;
  }
  if (!isPlainObject(value)) {
    return false;
  }
  if (value.namespaces !== undefined) {
    if (!Array.isArray(value.namespaces) || value.namespaces.length > LIMITS.MAX_NAMESPACES) {
      return false;
    }
    if (
      !value.namespaces.every(
        ns => typeof ns === 'string' && ns.length <= LIMITS.MAX_NAMESPACE_NAME_LENGTH
      )
    ) {
      return false;
    }
  }
  if (value.search !== undefined) {
    if (typeof value.search !== 'string' || value.search.length > LIMITS.MAX_SEARCH_LENGTH) {
      return false;
    }
  }
  if (value.labelSelector !== undefined) {
    if (
      typeof value.labelSelector !== 'string' ||
      value.labelSelector.length > LIMITS.MAX_LABEL_SELECTOR_LENGTH
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Validates user-supplied input for creating a saved view. Returns all
 * validation errors at once (rather than the first) so a form can display
 * them together.
 */
export function validateNewSavedViewInput(input: Partial<NewSavedViewInput>): ValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(input.name)) {
    errors.push('Name is required.');
  } else if (input.name.length > LIMITS.MAX_NAME_LENGTH) {
    errors.push(`Name must be ${LIMITS.MAX_NAME_LENGTH} characters or fewer.`);
  }

  if (input.description !== undefined && input.description.length > LIMITS.MAX_DESCRIPTION_LENGTH) {
    errors.push(`Description must be ${LIMITS.MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }

  if (!isNonEmptyString(input.cluster)) {
    errors.push('A cluster is required.');
  }

  if (!isValidResourceRef(input.resource)) {
    errors.push('A resource type is required.');
  }

  if (input.filters !== undefined && !isValidFilters(input.filters)) {
    errors.push('Filters are invalid.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Full structural type guard for a persisted {@link SavedView}. Used by the
 * migration layer to drop malformed entries instead of crashing.
 */
export function isValidSavedView(value: unknown): value is SavedView {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    isNonEmptyString(value.id) &&
    value.schemaVersion === 1 &&
    isNonEmptyString(value.name) &&
    value.name.length <= LIMITS.MAX_NAME_LENGTH &&
    (value.description === undefined ||
      (typeof value.description === 'string' &&
        value.description.length <= LIMITS.MAX_DESCRIPTION_LENGTH)) &&
    isNonEmptyString(value.cluster) &&
    isValidResourceRef(value.resource) &&
    isValidFilters(value.filters) &&
    typeof value.favorite === 'boolean' &&
    isNonEmptyString(value.createdAt) &&
    !Number.isNaN(Date.parse(value.createdAt)) &&
    isNonEmptyString(value.updatedAt) &&
    !Number.isNaN(Date.parse(value.updatedAt))
  );
}
