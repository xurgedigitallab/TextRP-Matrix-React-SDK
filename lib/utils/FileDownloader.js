"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FileDownloader = exports.DEFAULT_STYLES = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

const DEFAULT_STYLES = {
  imgSrc: "",
  imgStyle: null,
  // css props
  style: "",
  textContent: ""
};
exports.DEFAULT_STYLES = DEFAULT_STYLES;
// set up the iframe as a singleton so we don't have to figure out destruction of it down the line.
let managedIframe;
let onLoadPromise;
function getManagedIframe() {
  if (managedIframe) return {
    iframe: managedIframe,
    onLoadPromise
  };
  managedIframe = document.createElement("iframe");

  // Need to append the iframe in order for the browser to load it.
  document.body.appendChild(managedIframe);

  // Dev note: the reassignment warnings are entirely incorrect here.

  managedIframe.style.display = "none";

  // @ts-ignore
  // noinspection JSConstantReassignment
  managedIframe.sandbox = "allow-scripts allow-downloads allow-downloads-without-user-activation";
  onLoadPromise = new Promise(resolve => {
    managedIframe.onload = () => {
      resolve();
    };
    managedIframe.src = "usercontent/"; // XXX: Should come from the skin
  });

  return {
    iframe: managedIframe,
    onLoadPromise
  };
}

// TODO: If we decide to keep the download link behaviour, we should bring the style management into here.

/**
 * Helper to handle safe file downloads. This operates off an iframe for reasons described
 * by the blob helpers. By default, this will use a hidden iframe to manage the download
 * through a user content wrapper, but can be given an iframe reference if the caller needs
 * additional control over the styling/position of the iframe itself.
 */
class FileDownloader {
  /**
   * Creates a new file downloader
   * @param iframeFn Function to get a pre-configured iframe. Set to null to have the downloader
   * use a generic, hidden, iframe.
   */
  constructor(iframeFn) {
    this.iframeFn = iframeFn;
    (0, _defineProperty2.default)(this, "onLoadPromise", void 0);
  }
  get iframe() {
    const iframe = this.iframeFn?.();
    if (!iframe) {
      const managed = getManagedIframe();
      this.onLoadPromise = managed.onLoadPromise;
      return managed.iframe;
    }
    this.onLoadPromise = undefined;
    return iframe;
  }
  async download(_ref) {
    let {
      blob,
      name,
      autoDownload = true,
      opts = DEFAULT_STYLES
    } = _ref;
    const iframe = this.iframe; // get the iframe first just in case we need to await onload
    if (this.onLoadPromise) await this.onLoadPromise;
    iframe.contentWindow?.postMessage(_objectSpread(_objectSpread({}, opts), {}, {
      blob: blob,
      download: name,
      auto: autoDownload
    }), "*");
  }
}
exports.FileDownloader = FileDownloader;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJERUZBVUxUX1NUWUxFUyIsImltZ1NyYyIsImltZ1N0eWxlIiwic3R5bGUiLCJ0ZXh0Q29udGVudCIsImV4cG9ydHMiLCJtYW5hZ2VkSWZyYW1lIiwib25Mb2FkUHJvbWlzZSIsImdldE1hbmFnZWRJZnJhbWUiLCJpZnJhbWUiLCJkb2N1bWVudCIsImNyZWF0ZUVsZW1lbnQiLCJib2R5IiwiYXBwZW5kQ2hpbGQiLCJkaXNwbGF5Iiwic2FuZGJveCIsIlByb21pc2UiLCJyZXNvbHZlIiwib25sb2FkIiwic3JjIiwiRmlsZURvd25sb2FkZXIiLCJjb25zdHJ1Y3RvciIsImlmcmFtZUZuIiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJtYW5hZ2VkIiwidW5kZWZpbmVkIiwiZG93bmxvYWQiLCJfcmVmIiwiYmxvYiIsIm5hbWUiLCJhdXRvRG93bmxvYWQiLCJvcHRzIiwiY29udGVudFdpbmRvdyIsInBvc3RNZXNzYWdlIiwiX29iamVjdFNwcmVhZCIsImF1dG8iXSwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvRmlsZURvd25sb2FkZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDIxIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuZXhwb3J0IHR5cGUgR2V0SWZyYW1lRm4gPSAoKSA9PiBIVE1MSUZyYW1lRWxlbWVudCB8IG51bGw7XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NUWUxFUyA9IHtcbiAgICBpbWdTcmM6IFwiXCIsXG4gICAgaW1nU3R5bGU6IG51bGwgYXMgc3RyaW5nIHwgbnVsbCwgLy8gY3NzIHByb3BzXG4gICAgc3R5bGU6IFwiXCIsXG4gICAgdGV4dENvbnRlbnQ6IFwiXCIsXG59O1xuXG50eXBlIERvd25sb2FkT3B0aW9ucyA9IHtcbiAgICBibG9iOiBCbG9iO1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBhdXRvRG93bmxvYWQ/OiBib29sZWFuO1xuICAgIG9wdHM/OiB0eXBlb2YgREVGQVVMVF9TVFlMRVM7XG59O1xuXG4vLyBzZXQgdXAgdGhlIGlmcmFtZSBhcyBhIHNpbmdsZXRvbiBzbyB3ZSBkb24ndCBoYXZlIHRvIGZpZ3VyZSBvdXQgZGVzdHJ1Y3Rpb24gb2YgaXQgZG93biB0aGUgbGluZS5cbmxldCBtYW5hZ2VkSWZyYW1lOiBIVE1MSUZyYW1lRWxlbWVudDtcbmxldCBvbkxvYWRQcm9taXNlOiBQcm9taXNlPHZvaWQ+O1xuZnVuY3Rpb24gZ2V0TWFuYWdlZElmcmFtZSgpOiB7IGlmcmFtZTogSFRNTElGcmFtZUVsZW1lbnQ7IG9uTG9hZFByb21pc2U6IFByb21pc2U8dm9pZD4gfSB7XG4gICAgaWYgKG1hbmFnZWRJZnJhbWUpIHJldHVybiB7IGlmcmFtZTogbWFuYWdlZElmcmFtZSwgb25Mb2FkUHJvbWlzZSB9O1xuXG4gICAgbWFuYWdlZElmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpZnJhbWVcIik7XG5cbiAgICAvLyBOZWVkIHRvIGFwcGVuZCB0aGUgaWZyYW1lIGluIG9yZGVyIGZvciB0aGUgYnJvd3NlciB0byBsb2FkIGl0LlxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobWFuYWdlZElmcmFtZSk7XG5cbiAgICAvLyBEZXYgbm90ZTogdGhlIHJlYXNzaWdubWVudCB3YXJuaW5ncyBhcmUgZW50aXJlbHkgaW5jb3JyZWN0IGhlcmUuXG5cbiAgICBtYW5hZ2VkSWZyYW1lLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICAvLyBub2luc3BlY3Rpb24gSlNDb25zdGFudFJlYXNzaWdubWVudFxuICAgIG1hbmFnZWRJZnJhbWUuc2FuZGJveCA9IFwiYWxsb3ctc2NyaXB0cyBhbGxvdy1kb3dubG9hZHMgYWxsb3ctZG93bmxvYWRzLXdpdGhvdXQtdXNlci1hY3RpdmF0aW9uXCI7XG5cbiAgICBvbkxvYWRQcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgbWFuYWdlZElmcmFtZS5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIH07XG4gICAgICAgIG1hbmFnZWRJZnJhbWUuc3JjID0gXCJ1c2VyY29udGVudC9cIjsgLy8gWFhYOiBTaG91bGQgY29tZSBmcm9tIHRoZSBza2luXG4gICAgfSk7XG5cbiAgICByZXR1cm4geyBpZnJhbWU6IG1hbmFnZWRJZnJhbWUsIG9uTG9hZFByb21pc2UgfTtcbn1cblxuLy8gVE9ETzogSWYgd2UgZGVjaWRlIHRvIGtlZXAgdGhlIGRvd25sb2FkIGxpbmsgYmVoYXZpb3VyLCB3ZSBzaG91bGQgYnJpbmcgdGhlIHN0eWxlIG1hbmFnZW1lbnQgaW50byBoZXJlLlxuXG4vKipcbiAqIEhlbHBlciB0byBoYW5kbGUgc2FmZSBmaWxlIGRvd25sb2Fkcy4gVGhpcyBvcGVyYXRlcyBvZmYgYW4gaWZyYW1lIGZvciByZWFzb25zIGRlc2NyaWJlZFxuICogYnkgdGhlIGJsb2IgaGVscGVycy4gQnkgZGVmYXVsdCwgdGhpcyB3aWxsIHVzZSBhIGhpZGRlbiBpZnJhbWUgdG8gbWFuYWdlIHRoZSBkb3dubG9hZFxuICogdGhyb3VnaCBhIHVzZXIgY29udGVudCB3cmFwcGVyLCBidXQgY2FuIGJlIGdpdmVuIGFuIGlmcmFtZSByZWZlcmVuY2UgaWYgdGhlIGNhbGxlciBuZWVkc1xuICogYWRkaXRpb25hbCBjb250cm9sIG92ZXIgdGhlIHN0eWxpbmcvcG9zaXRpb24gb2YgdGhlIGlmcmFtZSBpdHNlbGYuXG4gKi9cbmV4cG9ydCBjbGFzcyBGaWxlRG93bmxvYWRlciB7XG4gICAgcHJpdmF0ZSBvbkxvYWRQcm9taXNlPzogUHJvbWlzZTx2b2lkPjtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgZmlsZSBkb3dubG9hZGVyXG4gICAgICogQHBhcmFtIGlmcmFtZUZuIEZ1bmN0aW9uIHRvIGdldCBhIHByZS1jb25maWd1cmVkIGlmcmFtZS4gU2V0IHRvIG51bGwgdG8gaGF2ZSB0aGUgZG93bmxvYWRlclxuICAgICAqIHVzZSBhIGdlbmVyaWMsIGhpZGRlbiwgaWZyYW1lLlxuICAgICAqL1xuICAgIHB1YmxpYyBjb25zdHJ1Y3Rvcihwcml2YXRlIGlmcmFtZUZuPzogR2V0SWZyYW1lRm4pIHt9XG5cbiAgICBwcml2YXRlIGdldCBpZnJhbWUoKTogSFRNTElGcmFtZUVsZW1lbnQge1xuICAgICAgICBjb25zdCBpZnJhbWUgPSB0aGlzLmlmcmFtZUZuPy4oKTtcbiAgICAgICAgaWYgKCFpZnJhbWUpIHtcbiAgICAgICAgICAgIGNvbnN0IG1hbmFnZWQgPSBnZXRNYW5hZ2VkSWZyYW1lKCk7XG4gICAgICAgICAgICB0aGlzLm9uTG9hZFByb21pc2UgPSBtYW5hZ2VkLm9uTG9hZFByb21pc2U7XG4gICAgICAgICAgICByZXR1cm4gbWFuYWdlZC5pZnJhbWU7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5vbkxvYWRQcm9taXNlID0gdW5kZWZpbmVkO1xuICAgICAgICByZXR1cm4gaWZyYW1lO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBkb3dubG9hZCh7IGJsb2IsIG5hbWUsIGF1dG9Eb3dubG9hZCA9IHRydWUsIG9wdHMgPSBERUZBVUxUX1NUWUxFUyB9OiBEb3dubG9hZE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgaWZyYW1lID0gdGhpcy5pZnJhbWU7IC8vIGdldCB0aGUgaWZyYW1lIGZpcnN0IGp1c3QgaW4gY2FzZSB3ZSBuZWVkIHRvIGF3YWl0IG9ubG9hZFxuICAgICAgICBpZiAodGhpcy5vbkxvYWRQcm9taXNlKSBhd2FpdCB0aGlzLm9uTG9hZFByb21pc2U7XG4gICAgICAgIGlmcmFtZS5jb250ZW50V2luZG93Py5wb3N0TWVzc2FnZShcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAuLi5vcHRzLFxuICAgICAgICAgICAgICAgIGJsb2I6IGJsb2IsXG4gICAgICAgICAgICAgICAgZG93bmxvYWQ6IG5hbWUsXG4gICAgICAgICAgICAgICAgYXV0bzogYXV0b0Rvd25sb2FkLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFwiKlwiLFxuICAgICAgICApO1xuICAgIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFJTyxNQUFNQSxjQUFjLEdBQUc7RUFDMUJDLE1BQU0sRUFBRSxFQUFFO0VBQ1ZDLFFBQVEsRUFBRSxJQUFxQjtFQUFFO0VBQ2pDQyxLQUFLLEVBQUUsRUFBRTtFQUNUQyxXQUFXLEVBQUU7QUFDakIsQ0FBQztBQUFDQyxPQUFBLENBQUFMLGNBQUEsR0FBQUEsY0FBQTtBQVNGO0FBQ0EsSUFBSU0sYUFBZ0M7QUFDcEMsSUFBSUMsYUFBNEI7QUFDaEMsU0FBU0MsZ0JBQWdCQSxDQUFBLEVBQWdFO0VBQ3JGLElBQUlGLGFBQWEsRUFBRSxPQUFPO0lBQUVHLE1BQU0sRUFBRUgsYUFBYTtJQUFFQztFQUFjLENBQUM7RUFFbEVELGFBQWEsR0FBR0ksUUFBUSxDQUFDQyxhQUFhLENBQUMsUUFBUSxDQUFDOztFQUVoRDtFQUNBRCxRQUFRLENBQUNFLElBQUksQ0FBQ0MsV0FBVyxDQUFDUCxhQUFhLENBQUM7O0VBRXhDOztFQUVBQSxhQUFhLENBQUNILEtBQUssQ0FBQ1csT0FBTyxHQUFHLE1BQU07O0VBRXBDO0VBQ0E7RUFDQVIsYUFBYSxDQUFDUyxPQUFPLEdBQUcsdUVBQXVFO0VBRS9GUixhQUFhLEdBQUcsSUFBSVMsT0FBTyxDQUFFQyxPQUFPLElBQUs7SUFDckNYLGFBQWEsQ0FBQ1ksTUFBTSxHQUFHLE1BQU07TUFDekJELE9BQU8sQ0FBQyxDQUFDO0lBQ2IsQ0FBQztJQUNEWCxhQUFhLENBQUNhLEdBQUcsR0FBRyxjQUFjLENBQUMsQ0FBQztFQUN4QyxDQUFDLENBQUM7O0VBRUYsT0FBTztJQUFFVixNQUFNLEVBQUVILGFBQWE7SUFBRUM7RUFBYyxDQUFDO0FBQ25EOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1hLGNBQWMsQ0FBQztFQUd4QjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ1dDLFdBQVdBLENBQVNDLFFBQXNCLEVBQUU7SUFBQSxLQUF4QkEsUUFBc0IsR0FBdEJBLFFBQXNCO0lBQUEsSUFBQUMsZ0JBQUEsQ0FBQUMsT0FBQTtFQUFHO0VBRXBELElBQVlmLE1BQU1BLENBQUEsRUFBc0I7SUFDcEMsTUFBTUEsTUFBTSxHQUFHLElBQUksQ0FBQ2EsUUFBUSxHQUFHLENBQUM7SUFDaEMsSUFBSSxDQUFDYixNQUFNLEVBQUU7TUFDVCxNQUFNZ0IsT0FBTyxHQUFHakIsZ0JBQWdCLENBQUMsQ0FBQztNQUNsQyxJQUFJLENBQUNELGFBQWEsR0FBR2tCLE9BQU8sQ0FBQ2xCLGFBQWE7TUFDMUMsT0FBT2tCLE9BQU8sQ0FBQ2hCLE1BQU07SUFDekI7SUFDQSxJQUFJLENBQUNGLGFBQWEsR0FBR21CLFNBQVM7SUFDOUIsT0FBT2pCLE1BQU07RUFDakI7RUFFQSxNQUFha0IsUUFBUUEsQ0FBQUMsSUFBQSxFQUE2RjtJQUFBLElBQTVGO01BQUVDLElBQUk7TUFBRUMsSUFBSTtNQUFFQyxZQUFZLEdBQUcsSUFBSTtNQUFFQyxJQUFJLEdBQUdoQztJQUFnQyxDQUFDLEdBQUE0QixJQUFBO0lBQzdGLE1BQU1uQixNQUFNLEdBQUcsSUFBSSxDQUFDQSxNQUFNLENBQUMsQ0FBQztJQUM1QixJQUFJLElBQUksQ0FBQ0YsYUFBYSxFQUFFLE1BQU0sSUFBSSxDQUFDQSxhQUFhO0lBQ2hERSxNQUFNLENBQUN3QixhQUFhLEVBQUVDLFdBQVcsQ0FBQUMsYUFBQSxDQUFBQSxhQUFBLEtBRXRCSCxJQUFJO01BQ1BILElBQUksRUFBRUEsSUFBSTtNQUNWRixRQUFRLEVBQUVHLElBQUk7TUFDZE0sSUFBSSxFQUFFTDtJQUFZLElBRXRCLEdBQ0osQ0FBQztFQUNMO0FBQ0o7QUFBQzFCLE9BQUEsQ0FBQWUsY0FBQSxHQUFBQSxjQUFBIn0=