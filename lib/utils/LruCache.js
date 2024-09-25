"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LruCache = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * Least Recently Used cache.
 * Can be initialised with a capacity and drops the least recently used items.
 * This cache should be error robust: Cache miss on error.
 *
 * Implemented via a key lookup map and a double linked list:
 *             head              tail
 *              a next → b next → c → next null
 *  null ← prev a ← prev b ← prev c
 *
 * @template K - Type of the key used to look up the values inside the cache
 * @template V - Type of the values inside the cache
 */
class LruCache {
  /**
   * @param capacity - Cache capcity.
   * @throws {Error} - Raises an error if the cache capacity is less than 1.
   */
  constructor(capacity) {
    this.capacity = capacity;
    /** Head of the list. */
    (0, _defineProperty2.default)(this, "head", null);
    /** Tail of the list */
    (0, _defineProperty2.default)(this, "tail", null);
    /** Key lookup map */
    (0, _defineProperty2.default)(this, "map", void 0);
    if (this.capacity < 1) {
      throw new Error("Cache capacity must be at least 1");
    }
    this.map = new Map();
  }

  /**
   * Whether the cache contains an item under this key.
   * Marks the item as most recently used.
   *
   * @param key - Key of the item
   * @returns true: item in cache, else false
   */
  has(key) {
    try {
      return this.getItem(key) !== undefined;
    } catch (e) {
      // Should not happen but makes it more robust to the unknown.
      this.onError(e);
      return false;
    }
  }

  /**
   * Returns an item from the cache.
   * Marks the item as most recently used.
   *
   * @param key - Key of the item
   * @returns The value if found, else undefined
   */
  get(key) {
    try {
      return this.getItem(key)?.value;
    } catch (e) {
      // Should not happen but makes it more robust to the unknown.
      this.onError(e);
      return undefined;
    }
  }

  /**
   * Adds an item to the cache.
   * A newly added item will be the set as the most recently used.
   *
   * @param key - Key of the item
   * @param value - Item value
   */
  set(key, value) {
    try {
      this.safeSet(key, value);
    } catch (e) {
      // Should not happen but makes it more robust to the unknown.
      this.onError(e);
    }
  }

  /**
   * Deletes an item from the cache.
   *
   * @param key - Key of the item to be removed
   */
  delete(key) {
    const item = this.map.get(key);

    // Unknown item.
    if (!item) return;
    try {
      this.removeItemFromList(item);
      this.map.delete(key);
    } catch (e) {
      // Should not happen but makes it more robust to the unknown.
      this.onError(e);
    }
  }

  /**
   * Clears the cache.
   */
  clear() {
    this.map = new Map();
    this.head = null;
    this.tail = null;
  }

  /**
   * Returns an iterator over the cached values.
   */
  *values() {
    for (const item of this.map.values()) {
      yield item.value;
    }
  }
  safeSet(key, value) {
    const item = this.getItem(key);
    if (item) {
      // The item is already stored under this key. Update the value.
      item.value = value;
      return;
    }
    const newItem = {
      key,
      value,
      next: null,
      prev: null
    };
    if (this.head) {
      // Put item in front of the list.
      this.head.prev = newItem;
      newItem.next = this.head;
    }
    this.setHeadTail(newItem);

    // Store item in lookup map.
    this.map.set(key, newItem);
    if (this.tail && this.map.size > this.capacity) {
      // Map size exceeded cache capcity. Drop tail item.
      this.delete(this.tail.key);
    }
  }
  onError(e) {
    _logger.logger.warn("LruCache error", e);
    this.clear();
  }
  getItem(key) {
    const item = this.map.get(key);

    // Not in cache.
    if (!item) return undefined;

    // Item is already at the head of the list.
    // No update required.
    if (item === this.head) return item;
    this.removeItemFromList(item);

    // Put item to the front.

    if (this.head) {
      this.head.prev = item;
    }
    item.prev = null;
    item.next = this.head;
    this.setHeadTail(item);
    return item;
  }
  setHeadTail(item) {
    if (item.prev === null) {
      // Item has no previous item → head
      this.head = item;
    }
    if (item.next === null) {
      // Item has no next item → tail
      this.tail = item;
    }
  }
  removeItemFromList(item) {
    if (item === this.head) {
      this.head = item.next;
    }
    if (item === this.tail) {
      this.tail = item.prev;
    }
    if (item.prev) {
      item.prev.next = item.next;
    }
    if (item.next) {
      item.next.prev = item.prev;
    }
  }
}
exports.LruCache = LruCache;
//# sourceMappingURL=LruCache.js.map