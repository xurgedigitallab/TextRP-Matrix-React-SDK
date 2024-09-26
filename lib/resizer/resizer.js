"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _lodash = require("lodash");
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

class Resizer {
  // TODO move vertical/horizontal to config option/container class
  // as it doesn't make sense to mix them within one container/Resizer
  constructor(container, distributorCtor, config) {
    this.container = container;
    this.distributorCtor = distributorCtor;
    this.config = config;
    (0, _defineProperty2.default)(this, "classNames", void 0);
    (0, _defineProperty2.default)(this, "onMouseDown", event => {
      const LEFT_MOUSE_BUTTON = 0;
      if (event.button !== LEFT_MOUSE_BUTTON) {
        return;
      }
      // use closest in case the resize handle contains
      // child dom nodes that can be the target
      const resizeHandle = event.target && event.target.closest(`.${this.classNames.handle}`);
      const hasHandler = this?.config?.handler;
      // prevent that stacked resizer's are both activated with one mouse event
      // (this is possible because the mouse events are connected to the containers not the handles)
      if (!resizeHandle ||
      // if no resizeHandle exist / mouse event hit the container not the handle
      !hasHandler && resizeHandle.parentElement !== this.container ||
      // no handler from config -> check if the containers match
      hasHandler && resizeHandle !== hasHandler) {
        // handler from config -> check if the handlers match
        return;
      }

      // prevent starting a drag operation
      event.preventDefault();

      // mark as currently resizing
      if (this.classNames.resizing) {
        this.container?.classList?.add(this.classNames.resizing);
      }
      this.config?.onResizeStart?.();
      const {
        sizer,
        distributor
      } = this.createSizerAndDistributor(resizeHandle);
      distributor.start();
      const onMouseMove = event => {
        const offset = sizer.offsetFromEvent(event);
        distributor.resizeFromContainerOffset(offset);
      };
      const body = document.body;
      const finishResize = () => {
        if (this.classNames.resizing) {
          this.container?.classList?.remove(this.classNames.resizing);
        }
        distributor.finish();
        this.config?.onResizeStop?.();
        body.removeEventListener("mouseup", finishResize, false);
        document.removeEventListener("mouseleave", finishResize, false);
        body.removeEventListener("mousemove", onMouseMove, false);
      };
      body.addEventListener("mouseup", finishResize, false);
      document.addEventListener("mouseleave", finishResize, false);
      body.addEventListener("mousemove", onMouseMove, false);
    });
    (0, _defineProperty2.default)(this, "onResize", (0, _lodash.throttle)(() => {
      const distributors = this.getDistributors();

      // relax all items if they had any overconstrained flexboxes
      distributors.forEach(d => d.start());
      distributors.forEach(d => d.finish());
    }, 100, {
      trailing: true,
      leading: true
    }));
    (0, _defineProperty2.default)(this, "getDistributors", () => {
      return this.getResizeHandles().map(handle => {
        const {
          distributor
        } = this.createSizerAndDistributor(handle);
        return distributor;
      });
    });
    this.classNames = {
      handle: "resizer-handle",
      reverse: "resizer-reverse",
      vertical: "resizer-vertical",
      resizing: "resizer-resizing"
    };
  }
  setClassNames(classNames) {
    this.classNames = classNames;
  }
  attach() {
    const attachment = this?.config?.handler?.parentElement ?? this.container;
    attachment?.addEventListener("mousedown", this.onMouseDown, false);
    window.addEventListener("resize", this.onResize);
  }
  detach() {
    const attachment = this?.config?.handler?.parentElement ?? this.container;
    attachment?.removeEventListener("mousedown", this.onMouseDown, false);
    window.removeEventListener("resize", this.onResize);
  }

  /**
  Gives the distributor for a specific resize handle, as if you would have started
  to drag that handle. Can be used to manipulate the size of an item programmatically.
  @param {number} handleIndex the index of the resize handle in the container
  @return {FixedDistributor} a new distributor for the given handle
  */
  forHandleAt(handleIndex) {
    const handles = this.getResizeHandles();
    const handle = handles[handleIndex];
    if (handle) {
      const {
        distributor
      } = this.createSizerAndDistributor(handle);
      return distributor;
    }
  }
  forHandleWithId(id) {
    const handles = this.getResizeHandles();
    const handle = handles.find(h => h.getAttribute("data-id") === id);
    if (handle) {
      const {
        distributor
      } = this.createSizerAndDistributor(handle);
      return distributor;
    }
  }
  isReverseResizeHandle(el) {
    return el.classList.contains(this.classNames.reverse);
  }
  isResizeHandle(el) {
    return el.classList.contains(this.classNames.handle);
  }
  createSizerAndDistributor(resizeHandle) {
    const vertical = resizeHandle.classList.contains(this.classNames.vertical);
    const reverse = this.isReverseResizeHandle(resizeHandle);
    const Distributor = this.distributorCtor;
    const useItemContainer = this.config?.handler ? this.container : undefined;
    const sizer = Distributor.createSizer(this.container, vertical, reverse);
    const item = Distributor.createItem(resizeHandle, this, sizer, useItemContainer ?? undefined);
    const distributor = new Distributor(item);
    return {
      sizer,
      distributor
    };
  }
  getResizeHandles() {
    if (this?.config?.handler) {
      return [this.config.handler];
    }
    if (!this.container?.children) return [];
    return Array.from(this.container.querySelectorAll(`.${this.classNames.handle}`));
  }
}
exports.default = Resizer;
//# sourceMappingURL=resizer.js.map