/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default function invariant(condition: boolean, error: string) {
  if (!condition) {
    throw new Error(error);
  }
}
