"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/*
Copyright 2018 - 2020 The Matrix.org Foundation C.I.C.

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
implements DOM/CSS operations for resizing.
The sizer determines what CSS mechanism is used for sizing items, like flexbox, ...
*/
class Sizer {
  constructor(container, vertical, reverse) {
    this.container = container;
    this.vertical = vertical;
    this.reverse = reverse;
  }

  /**
      @param {Element} item the dom element being resized
      @return {number} how far the edge of the item is from the edge of the container
  */
  getItemOffset(item) {
    const offset = (this.vertical ? item.offsetTop : item.offsetLeft) - this.getOffset();
    if (this.reverse) {
      return this.getTotalSize() - (offset + this.getItemSize(item));
    } else {
      return offset;
    }
  }

  /**
      @param {Element} item the dom element being resized
      @return {number} the width/height of an item in the container
  */
  getItemSize(item) {
    return this.vertical ? item.offsetHeight : item.offsetWidth;
  }

  /** @return {number} the width/height of the container */
  getTotalSize() {
    return this.vertical ? this.container.offsetHeight : this.container.offsetWidth;
  }

  /** @return {number} container offset to offsetParent */
  getOffset() {
    return this.vertical ? this.container.offsetTop : this.container.offsetLeft;
  }

  /** @return {number} container offset to document */
  getPageOffset() {
    let element = this.container;
    let offset = 0;
    while (element) {
      const pos = this.vertical ? element.offsetTop : element.offsetLeft;
      offset = offset + pos;
      element = element.offsetParent;
    }
    return offset;
  }
  getDesiredItemSize(item) {
    if (this.vertical) {
      return item.style.height;
    } else {
      return item.style.width;
    }
  }
  setItemSize(item, size) {
    if (this.vertical) {
      item.style.height = size;
    } else {
      item.style.width = size;
    }
  }
  clearItemSize(item) {
    if (this.vertical) {
      item.style.removeProperty("height");
    } else {
      item.style.removeProperty("width");
    }
  }
  start(item) {}
  finish(item) {}

  /**
      @param {MouseEvent} event the mouse event
      @return {number} the distance between the cursor and the edge of the container,
          along the applicable axis (vertical or horizontal)
  */
  offsetFromEvent(event) {
    const pos = this.vertical ? event.pageY : event.pageX;
    if (this.reverse) {
      return this.getPageOffset() + this.getTotalSize() - pos;
    } else {
      return pos - this.getPageOffset();
    }
  }
}
exports.default = Sizer;
//# sourceMappingURL=sizer.js.map