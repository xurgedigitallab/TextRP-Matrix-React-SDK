"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useTimeout = exports.useInterval = exports.useExpiringCounter = void 0;
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

// Hook to simplify timeouts in functional components
const useTimeout = (handler, timeoutMs) => {
  // Create a ref that stores handler
  const savedHandler = (0, _react.useRef)();

  // Update ref.current value if handler changes.
  (0, _react.useEffect)(() => {
    savedHandler.current = handler;
  }, [handler]);

  // Set up timer
  (0, _react.useEffect)(() => {
    const timeoutID = window.setTimeout(() => {
      savedHandler.current?.();
    }, timeoutMs);
    return () => clearTimeout(timeoutID);
  }, [timeoutMs]);
};

// Hook to simplify intervals in functional components
exports.useTimeout = useTimeout;
const useInterval = (handler, intervalMs) => {
  // Create a ref that stores handler
  const savedHandler = (0, _react.useRef)();

  // Update ref.current value if handler changes.
  (0, _react.useEffect)(() => {
    savedHandler.current = handler;
  }, [handler]);

  // Set up timer
  (0, _react.useEffect)(() => {
    const intervalID = window.setInterval(() => {
      savedHandler.current?.();
    }, intervalMs);
    return () => clearInterval(intervalID);
  }, [intervalMs]);
};

// Hook to simplify a variable counting down to 0, handler called when it reached 0
exports.useInterval = useInterval;
const useExpiringCounter = (handler, intervalMs, initialCount) => {
  const [count, setCount] = (0, _react.useState)(initialCount);
  useInterval(() => setCount(c => c - 1), intervalMs);
  if (count === 0) {
    handler();
  }
  return count;
};
exports.useExpiringCounter = useExpiringCounter;
//# sourceMappingURL=useTimeout.js.map