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

/**
 * Bounds on saved-view data, chosen to keep the persisted config small and
 * the UI usable, not as arbitrary large ceilings. See DECISIONS.md.
 */
export const LIMITS = {
  /** Maximum number of saved views a user may keep at once. */
  MAX_VIEWS: 200,
  MAX_NAME_LENGTH: 80,
  MAX_DESCRIPTION_LENGTH: 280,
  MAX_SEARCH_LENGTH: 200,
  MAX_LABEL_SELECTOR_LENGTH: 400,
  MAX_NAMESPACES: 50,
  MAX_NAMESPACE_NAME_LENGTH: 253, // Kubernetes DNS subdomain limit.
} as const;
