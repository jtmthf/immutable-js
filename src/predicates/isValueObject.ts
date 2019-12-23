/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ValueObject } from "../ValueObject";

export function isValueObject(maybeValue: any): maybeValue is ValueObject {
  return Boolean(
    maybeValue &&
      typeof maybeValue.equals === "function" &&
      typeof maybeValue.hashCode === "function"
  );
}
