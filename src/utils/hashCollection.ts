import { isKeyed } from "../predicates/isKeyed";
import { isOrdered } from "../predicates/isOrdered";

import { Collection } from "../Collection";
import { hash } from "../Hash";

import { hashMerge } from "./hashMerge";
import { murmurHashOfSize } from "./murmurHashOfSize";

export function hashCollection(collection: Collection) {
  if (collection.size === Infinity) {
    return 0;
  }
  const ordered = isOrdered(collection);
  const keyed = isKeyed(collection);
  let h = ordered ? 1 : 0;
  const size = collection.__iterate(
    keyed
      ? ordered
        ? (v, k) => {
            h = (31 * h + hashMerge(hash(v), hash(k))) | 0;
          }
        : (v, k) => {
            h = (h + hashMerge(hash(v), hash(k))) | 0;
          }
      : ordered
      ? v => {
          h = (31 * h + hash(v)) | 0;
        }
      : v => {
          h = (h + hash(v)) | 0;
        }
  );
  return murmurHashOfSize(size, h);
}
