"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useDispatcher = void 0;
var _react = require("react");
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

// Hook to simplify listening to event dispatches
const useDispatcher = (dispatcher, handler) => {
  // Create a ref that stores handler
  const savedHandler = (0, _react.useRef)(payload => {});

  // Update ref.current value if handler changes.
  (0, _react.useEffect)(() => {
    savedHandler.current = handler;
  }, [handler]);
  (0, _react.useEffect)(() => {
    // Create event listener that calls handler function stored in ref
    const ref = dispatcher.register(payload => savedHandler.current(payload));
    // Remove event listener on cleanup
    return () => {
      dispatcher.unregister(ref);
    };
  }, [dispatcher]);
};
exports.useDispatcher = useDispatcher;
//# sourceMappingURL=useDispatcher.js.map