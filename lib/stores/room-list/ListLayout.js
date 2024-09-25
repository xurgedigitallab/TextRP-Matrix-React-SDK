"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ListLayout = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

const TILE_HEIGHT_PX = 44;
class ListLayout {
  constructor(tagId) {
    this.tagId = tagId;
    (0, _defineProperty2.default)(this, "_n", 0);
    (0, _defineProperty2.default)(this, "_previews", false);
    (0, _defineProperty2.default)(this, "_collapsed", false);
    const serialized = localStorage.getItem(this.key);
    if (serialized) {
      // We don't use the setters as they cause writes.
      const parsed = JSON.parse(serialized);
      this._n = parsed.numTiles;
      this._previews = parsed.showPreviews;
      this._collapsed = parsed.collapsed;
    }
  }
  get isCollapsed() {
    return this._collapsed;
  }
  set isCollapsed(v) {
    this._collapsed = v;
    this.save();
  }
  get showPreviews() {
    return this._previews;
  }
  set showPreviews(v) {
    this._previews = v;
    this.save();
  }
  get tileHeight() {
    return TILE_HEIGHT_PX;
  }
  get key() {
    return `mx_sublist_layout_${this.tagId}_boxed`;
  }
  get visibleTiles() {
    if (this._n === 0) return this.defaultVisibleTiles;
    return Math.max(this._n, this.minVisibleTiles);
  }
  set visibleTiles(v) {
    this._n = v;
    this.save();
  }
  get minVisibleTiles() {
    return 1;
  }
  get defaultVisibleTiles() {
    // This number is what "feels right", and mostly subject to design's opinion.
    return 8;
  }
  tilesWithPadding(n, paddingPx) {
    return this.pixelsToTiles(this.tilesToPixelsWithPadding(n, paddingPx));
  }
  tilesToPixelsWithPadding(n, paddingPx) {
    return this.tilesToPixels(n) + paddingPx;
  }
  tilesToPixels(n) {
    return n * this.tileHeight;
  }
  pixelsToTiles(px) {
    return px / this.tileHeight;
  }
  reset() {
    localStorage.removeItem(this.key);
  }
  save() {
    localStorage.setItem(this.key, JSON.stringify(this.serialize()));
  }
  serialize() {
    return {
      numTiles: this.visibleTiles,
      showPreviews: this.showPreviews,
      collapsed: this.isCollapsed
    };
  }
}
exports.ListLayout = ListLayout;
//# sourceMappingURL=ListLayout.js.map