/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { is } from "./is";
import { isAssociative } from "./predicates/isAssociative";
import { IS_COLLECTION_SYMBOL, isCollection } from "./predicates/isCollection";
import { isIndexed } from "./predicates/isIndexed";
import { isKeyed } from "./predicates/isKeyed";

import assertNotInfinite from "./utils/assertNotInfinite";
import deepEqual from "./utils/deepEqual";
import { hashCollection } from "./utils/hashCollection";

import {
  ITERATE_ENTRIES,
  ITERATE_KEYS,
  ITERATE_VALUES,
  Iterator,
  ITERATOR_SYMBOL
} from "./Iterator";
import { List } from "./List";
import { Map } from "./Map";
import { getIn } from "./methods/getIn";
import { hasIn } from "./methods/hasIn";
import { toObject } from "./methods/toObject";
import {
  filterFactory,
  mapFactory,
  reify,
  ToIndexedSequence,
  ToKeyedSequence,
  ToSetSequence
} from "./Operations";
import { OrderedMap } from "./OrderedMap";
import { OrderedSet } from "./OrderedSet";
import { ArraySeq, IndexedSeq, KeyedSeq, Seq, SetSeq } from "./Seq";
import { Set } from "./Set";
import { Stack } from "./Stack";
import { toJS } from "./toJS";
import { NOT_SET, returnTrue } from "./TrieUtils";

export abstract class Collection<K, V> {
  protected __hash?: number;

  static from(value) {
    return isCollection(value) ? value : new Seq(value);
  }

  // Value equality

  /**
   * True if this and the other Collection have value equality, as defined
   * by `Immutable.is()`.
   *
   * Note: This is equivalent to `Immutable.is(this, other)`, but provided to
   * allow for chained expressions.
   */
  equals(other: unknown): boolean {
    return deepEqual(this, other);
  }

  /**
   * Computes and returns the hashed identity for this Collection.
   *
   * The `hashCode` of a Collection is used to determine potential equality,
   * and is used when adding this to a `Set` or as a key in a `Map`, enabling
   * lookup via a different instance.
   *
   * <!-- runkit:activate
   *      { "preamble": "const { Set,  List } = require('immutable')" }
   * -->
   * ```js
   * const a = List([ 1, 2, 3 ]);
   * const b = List([ 1, 2, 3 ]);
   * assert.notStrictEqual(a, b); // different instances
   * const set = Set([ a ]);
   * assert.equal(set.has(b), true);
   * ```
   *
   * If two values have the same `hashCode`, they are [not guaranteed
   * to be equal][Hash Collision]. If two values have different `hashCode`s,
   * they must not be equal.
   *
   * [Hash Collision]: http://en.wikipedia.org/wiki/Collision_(computer_science)
   */
  hashCode(): number {
    return this.__hash || (this.__hash = hashCollection(this));
  }

  // Reading values

  /**
   * Returns the value associated with the provided key, or notSetValue if
   * the Collection does not contain this key.
   *
   * Note: it is possible a key may be associated with an `undefined` value,
   * so if `notSetValue` is not provided and this method returns `undefined`,
   * that does not guarantee the key was not found.
   */
  get<NSV>(key: K, notSetValue: NSV): V | NSV;
  get(key: K): V | undefined;
  get(searchKey: K, notSetValue?: any): V | undefined {
    return this.find((_, key) => is(key, searchKey), undefined, notSetValue);
  }

  /**
   * True if a key exists within this `Collection`, using `Immutable.is`
   * to determine equality
   */
  has(searchKey: K): boolean {
    return this.get(searchKey, NOT_SET) !== NOT_SET;
  }

  /**
   * True if a value exists within this `Collection`, using `Immutable.is`
   * to determine equality
   * @alias contains
   */
  includes(searchValue: V): boolean {
    return this.some(value => is(value, searchValue));
  }
  contains!: (value: V) => boolean;

  /**
   * In case the `Collection` is not empty returns the first element of the
   * `Collection`.
   * In case the `Collection` is empty returns the optional default
   * value if provided, if no default value is provided returns undefined.
   */
  first<NSV>(notSetValue?: NSV): V | NSV {
    return this.find(returnTrue, null, notSetValue);
  }

  /**
   * In case the `Collection` is not empty returns the last element of the
   * `Collection`.
   * In case the `Collection` is empty returns the optional default
   * value if provided, if no default value is provided returns undefined.
   */
  last<NSV>(notSetValue?: NSV): V | NSV {
    return this.toSeq()
      .reverse()
      .first(notSetValue);
  }

  // Reading deep values

  /**
   * Returns the value found by following a path of keys or indices through
   * nested Collections.
   *
   * <!-- runkit:activate -->
   * ```js
   * const { Map, List } = require('immutable')
   * const deepData = Map({ x: List([ Map({ y: 123 }) ]) });
   * deepData.getIn(['x', 0, 'y']) // 123
   * ```
   *
   * Plain JavaScript Object or Arrays may be nested within an Immutable.js
   * Collection, and getIn() can access those values as well:
   *
   * <!-- runkit:activate -->
   * ```js
   * const { Map, List } = require('immutable')
   * const deepData = Map({ x: [ { y: 123 } ] });
   * deepData.getIn(['x', 0, 'y']) // 123
   * ```
   */
  getIn!: (searchKeyPath: Iterable<unknown>, notSetValue?: unknown) => unknown;

  /**
   * True if the result of following a path of keys or indices through nested
   * Collections results in a set value.
   */
  hasIn!: (searchKeyPath: Iterable<unknown>) => boolean;

  // Persistent changes

  /**
   * This can be very useful as a way to "chain" a normal function into a
   * sequence of methods. RxJS calls this "let" and lodash calls it "thru".
   *
   * For example, to sum a Seq after mapping and filtering:
   *
   * <!-- runkit:activate -->
   * ```js
   * const { Seq } = require('immutable')
   *
   * function sum(collection) {
   *   return collection.reduce((sum, x) => sum + x, 0)
   * }
   *
   * Seq([ 1, 2, 3 ])
   *   .map(x => x + 1)
   *   .filter(x => x % 2 === 0)
   *   .update(sum)
   * // 6
   * ```
   */
  update<R>(updater: (value: this) => R): R {
    return updater(this);
  }

  // Conversion to JavaScript types

  /**
   * Deeply converts this Collection to equivalent native JavaScript Array or Object.
   *
   * `Collection.Indexed`, and `Collection.Set` become `Array`, while
   * `Collection.Keyed` become `Object`, converting keys to Strings.
   */
  toJS(): Array<unknown> | { [key: string]: unknown } {
    return toJS(this);
  }

  /**
   * Shallowly converts this Collection to equivalent native JavaScript Array or Object.
   *
   * `Collection.Indexed`, and `Collection.Set` become `Array`, while
   * `Collection.Keyed` become `Object`, converting keys to Strings.
   */
  toJSON!: () => Array<V> | { [key: string]: V };

  /**
   * Shallowly converts this collection to an Array.
   *
   * `Collection.Indexed`, and `Collection.Set` produce an Array of values.
   * `Collection.Keyed` produce an Array of [key, value] tuples.
   */
  toArray(): Array<V> | Array<[K, V]> {
    assertNotInfinite(this.size);
    const array = new Array(this.size || 0);
    const useTuples = isKeyed(this);
    let i = 0;
    this.__iterate((v, k) => {
      // Keyed collections produce an array of tuples.
      array[i++] = useTuples ? [k, v] : v;
    });
    return array;
  }

  /**
   * Shallowly converts this Collection to an Object.
   *
   * Converts keys to Strings.
   */
  toObject!: () => { [key: string]: V };

  // Conversion to Collections

  /**
   * Converts this Collection to a Map, Throws if keys are not hashable.
   *
   * Note: This is equivalent to `Map(this.toKeyedSeq())`, but provided
   * for convenience and to allow for chained expressions.
   */
  toMap(): Map<K, V> {
    return new Map(this.toKeyedSeq());
  }

  /**
   * Converts this Collection to a Map, maintaining the order of iteration.
   *
   * Note: This is equivalent to `OrderedMap(this.toKeyedSeq())`, but
   * provided for convenience and to allow for chained expressions.
   */
  toOrderedMap(): OrderedMap<K, V> {
    return new OrderedMap(this.toKeyedSeq());
  }

  /**
   * Converts this Collection to a Set, discarding keys. Throws if values
   * are not hashable.
   *
   * Note: This is equivalent to `Set(this)`, but provided to allow for
   * chained expressions.
   */
  toSet(): Set<V> {
    return new Set(isKeyed(this) ? this.valueSeq() : this);
  }

  /**
   * Converts this Collection to a Set, maintaining the order of iteration and
   * discarding keys.
   *
   * Note: This is equivalent to `OrderedSet(this.valueSeq())`, but provided
   * for convenience and to allow for chained expressions.
   */
  toOrderedSet(): OrderedSet<V> {
    return new OrderedSet(isKeyed(this) ? this.valueSeq() : this);
  }

  /**
   * Converts this Collection to a List, discarding keys.
   *
   * This is similar to `List(collection)`, but provided to allow for chained
   * expressions. However, when called on `Map` or other keyed collections,
   * `collection.toList()` discards the keys and creates a list of only the
   * values, whereas `List(collection)` creates a list of entry tuples.
   *
   * <!-- runkit:activate -->
   * ```js
   * const { Map, List } = require('immutable')
   * var myMap = Map({ a: 'Apple', b: 'Banana' })
   * List(myMap) // List [ [ "a", "Apple" ], [ "b", "Banana" ] ]
   * myMap.toList() // List [ "Apple", "Banana" ]
   * ```
   */
  toList(): List<V> {
    return new List(isKeyed(this) ? this.valueSeq() : this);
  }

  /**
   * Converts this Collection to a Stack, discarding keys. Throws if values
   * are not hashable.
   *
   * Note: This is equivalent to `Stack(this)`, but provided to allow for
   * chained expressions.
   */
  toStack(): Stack<V> {
    return new Stack(isKeyed(this) ? this.valueSeq() : this);
  }

  // Conversion to Seq

  /**
   * Converts this Collection to a Seq of the same kind (indexed,
   * keyed, or set).
   */
  toSeq(): Seq<K, V> {
    return isIndexed(this)
      ? this.toIndexedSeq()
      : isKeyed(this)
      ? this.toKeyedSeq()
      : this.toSetSeq();
  }

  /**
   * Returns a Seq.Keyed from this Collection where indices are treated as keys.
   *
   * This is useful if you want to operate on an
   * Collection.Indexed and preserve the [index, value] pairs.
   *
   * The returned Seq will have identical iteration order as
   * this Collection.
   *
   * <!-- runkit:activate -->
   * ```js
   * const { Seq } = require('immutable')
   * const indexedSeq = Seq([ 'A', 'B', 'C' ])
   * // Seq [ "A", "B", "C" ]
   * indexedSeq.filter(v => v === 'B')
   * // Seq [ "B" ]
   * const keyedSeq = indexedSeq.toKeyedSeq()
   * // Seq { 0: "A", 1: "B", 2: "C" }
   * keyedSeq.filter(v => v === 'B')
   * // Seq { 1: "B" }
   * ```
   */
  toKeyedSeq(): Seq.Keyed<K, V> {
    return new ToKeyedSequence(this, true);
  }

  /**
   * Returns an Seq.Indexed of the values of this Collection, discarding keys.
   */
  toIndexedSeq(): Seq.Indexed<V> {
    return new ToIndexedSequence(this);
  }

  /**
   * Returns a Seq.Set of the values of this Collection, discarding keys.
   */
  toSetSeq(): Seq.Set<V> {
    return new ToSetSequence(this);
  }

  // Iterators

  /**
   * An iterator of this `Collection`'s keys.
   *
   * Note: this will return an ES6 iterator which does not support
   * Immutable.js sequence algorithms. Use `keySeq` instead, if this is
   * what you want.
   */
  keys(): IterableIterator<K> {
    return this.__iterator(ITERATE_KEYS);
  }

  /**
   * An iterator of this `Collection`'s values.
   *
   * Note: this will return an ES6 iterator which does not support
   * Immutable.js sequence algorithms. Use `valueSeq` instead, if this is
   * what you want.
   */
  values(): IterableIterator<V> {
    return this.__iterator(ITERATE_VALUES);
  }

  /**
   * An iterator of this `Collection`'s entries as `[ key, value ]` tuples.
   *
   * Note: this will return an ES6 iterator which does not support
   * Immutable.js sequence algorithms. Use `entrySeq` instead, if this is
   * what you want.
   */
  entries(): IterableIterator<[K, V]> {
    return this.__iterator(ITERATE_ENTRIES);
  }

  // Collections (Seq)

  /**
   * Returns a new Seq.Indexed of the keys of this Collection,
   * discarding values.
   */
  keySeq(): Seq.Indexed<K> {
    return this.toSeq()
      .map(keyMapper)
      .toIndexedSeq();
  }

  /**
   * Returns an Seq.Indexed of the values of this Collection, discarding keys.
   */
  valueSeq(): Seq.Indexed<V> {
    return this.toIndexedSeq();
  }

  /**
   * Returns a new Seq.Indexed of [key, value] tuples.
   */
  entrySeq(): Seq.Indexed<[K, V]> {
    const collection = this;
    if (collection._cache) {
      // We cache as an entries array, so we can just return the cache!
      return new ArraySeq(collection._cache);
    }
    const entriesSequence = collection
      .toSeq()
      .map(entryMapper)
      .toIndexedSeq();
    entriesSequence.fromEntrySeq = () => collection.toSeq();
    return entriesSequence;
  }

  // Sequence algorithms

  /**
   * Returns a new Collection of the same type with values passed through a
   * `mapper` function.
   *
   * <!-- runkit:activate -->
   * ```js
   * const { Collection } = require('immutable')
   * Collection({ a: 1, b: 2 }).map(x => 10 * x)
   * // Seq { "a": 10, "b": 20 }
   * ```
   *
   * Note: `map()` always returns a new instance, even if it produced the same
   * value at every step.
   */
  map<M>(
    mapper: (value: V, key: K, iter: this) => M,
    context?: unknown
  ): Collection<K, M> {
    return reify(this, mapFactory(this, mapper, context));
  }

  /**
   * Returns a new Collection of the same type with only the entries for which
   * the `predicate` function returns true.
   *
   * <!-- runkit:activate -->
   * ```js
   * const { Map } = require('immutable')
   * Map({ a: 1, b: 2, c: 3, d: 4}).filter(x => x % 2 === 0)
   * // Map { "b": 2, "d": 4 }
   * ```
   *
   * Note: `filter()` always returns a new instance, even if it results in
   * not filtering out any values.
   */
  filter<F extends V>(
    predicate: (value: V, key: K, iter: this) => value is F,
    context?: unknown
  ): Collection<K, F>;
  filter(
    predicate: (value: V, key: K, iter: this) => unknown,
    context?: unknown
  ): this;
  filter(
    predicate: (value: V, key: K, iter: this) => unknown,
    context?: unknown
  ): this {
    return reify(this, filterFactory(this, predicate, context, true));
  }

  /**
   * Returns a new Collection of the same type with only the entries for which
   * the `predicate` function returns false.
   *
   * <!-- runkit:activate -->
   * ```js
   * const { Map } = require('immutable')
   * Map({ a: 1, b: 2, c: 3, d: 4}).filterNot(x => x % 2 === 0)
   * // Map { "a": 1, "c": 3 }
   * ```
   *
   * Note: `filterNot()` always returns a new instance, even if it results in
   * not filtering out any values.
   */
  filterNot(
    predicate: (value: V, key: K, iter: this) => boolean,
    context?: unknown
  ): this {
    return this.filter(not(predicate), context);
  }

  // Internal

  protected abstract __iterate(
    fn: (value: V, key: K) => void,
    reverse?: boolean
  );
  protected abstract __iterator(
    type: typeof ITERATE_KEYS | typeof ITERATE_VALUES | typeof ITERATE_ENTRIES,
    reverse?: boolean
  ): Iterator;

  static Keyed: typeof KeyedCollection;
  static Indexed: typeof IndexedCollection;
  static Set: typeof SetCollection;
}

Collection.prototype[IS_COLLECTION_SYMBOL] = true;
Collection.prototype[ITERATOR_SYMBOL] = Collection.prototype.values;
Collection.prototype.contains = Collection.prototype.includes;
Collection.prototype.getIn = getIn;
Collection.prototype.hasIn = hasIn;
Collection.prototype.toJSON = Collection.prototype.toArray;
Collection.prototype.toObject = toObject;

export class KeyedCollection<K, V> extends Collection<K, V> {
  static from(value) {
    return isKeyed(value) ? value : new KeyedSeq(value);
  }
}

export class IndexedCollection<T> extends Collection<number, T> {
  static from(value) {
    return isIndexed(value) ? value : new IndexedSeq(value);
  }
}

export class SetCollection<T> extends Collection<T, T> {
  static from(value) {
    return isCollection(value) && !isAssociative(value)
      ? value
      : new SetSeq(value);
  }
}

Collection.Keyed = KeyedCollection;
Collection.Indexed = IndexedCollection;
Collection.Set = SetCollection;

function keyMapper<K, V>(_: V, k: K) {
  return k;
}

function entryMapper<K, V>(v: V, k: K): [K, V] {
  return [k, v];
}

function not<T>(predicate: (value: T) => boolean) {
  return function() {
    return !predicate.apply(this, arguments);
  };
}
