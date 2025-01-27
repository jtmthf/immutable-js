/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import invariant from "./invariant";

export default function assertNotInfinite(size: number): void {
  invariant(
    size !== Infinity,
    "Cannot perform this action with an infinite size."
  );
}
