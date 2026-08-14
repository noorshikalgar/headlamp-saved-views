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

import { describe, expect, it } from 'vitest';
import { resolveClusterStatus } from './clusterIdentity';

describe('resolveClusterStatus', () => {
  it('reports "found" when the cluster name is a key in the configured clusters map', () => {
    expect(resolveClusterStatus('prod', { prod: {}, staging: {} })).toEqual({ status: 'found' });
  });

  it('reports "not-found" when the cluster name is absent', () => {
    expect(resolveClusterStatus('prod', { staging: {} })).toEqual({ status: 'not-found' });
  });

  it('reports "loading" when the configured clusters map is null (not yet loaded)', () => {
    expect(resolveClusterStatus('prod', null)).toEqual({ status: 'loading' });
  });

  it('reports "loading" when the configured clusters map is undefined', () => {
    expect(resolveClusterStatus('prod', undefined)).toEqual({ status: 'loading' });
  });

  it('reports "not-found" for an empty configured clusters map', () => {
    expect(resolveClusterStatus('prod', {})).toEqual({ status: 'not-found' });
  });

  it('does not match a similarly named cluster via prototype properties', () => {
    // Guards against a name like "toString" or "constructor" being treated
    // as a configured cluster just because it exists on Object.prototype.
    expect(resolveClusterStatus('toString', {})).toEqual({ status: 'not-found' });
  });
});
