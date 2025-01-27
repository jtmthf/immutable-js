import { Collection } from "../Collection";

/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const IS_ORDERED_SYMBOL = "@@__IMMUTABLE_ORDERED__@@";

export function isOrdered(
  maybeOrdered: any
): maybeOrdered is Collection<any, any> {
  return Boolean(maybeOrdered && maybeOrdered[IS_ORDERED_SYMBOL]);
}
