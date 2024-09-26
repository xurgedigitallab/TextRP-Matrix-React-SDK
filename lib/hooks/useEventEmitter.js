"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useEventEmitter = useEventEmitter;
exports.useEventEmitterState = useEventEmitterState;
exports.useTypedEventEmitter = useTypedEventEmitter;
exports.useTypedEventEmitterState = useTypedEventEmitterState;
var _react = require("react");
/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

function useTypedEventEmitter(emitter, eventName, handler) {
  useEventEmitter(emitter, eventName, handler);
}

/**
 * Hook to wrap an EventEmitter on and off in hook lifecycle
 */
function useEventEmitter(emitter, eventName, handler) {
  // Create a ref that stores handler
  const savedHandler = (0, _react.useRef)(handler);

  // Update ref.current value if handler changes.
  (0, _react.useEffect)(() => {
    savedHandler.current = handler;
  }, [handler]);
  (0, _react.useEffect)(() => {
    // allow disabling this hook by passing a falsy emitter
    if (!emitter) return;

    // Create event listener that calls handler function stored in ref
    const eventListener = function () {
      return savedHandler.current(...arguments);
    };

    // Add event listener
    emitter.on(eventName, eventListener);

    // Remove event listener on cleanup
    return () => {
      emitter.off(eventName, eventListener);
    };
  }, [eventName, emitter] // Re-run if eventName or emitter changes
  );
}

/**
 * {@link useEventEmitterState}
 */
function useTypedEventEmitterState(emitter, eventName, fn) {
  return useEventEmitterState(emitter, eventName, fn);
}

/**
 * Creates a state, that can be updated by events.
 *
 * @param emitter The emitter sending the event
 * @param eventName Event name to listen for
 * @param fn The callback function, that should return the state value.
 *           It should have the signature of the event callback, except that all parameters are optional.
 *           If the params are not set, a default value for the state should be returned.
 * @returns State
 */
function useEventEmitterState(emitter, eventName, fn) {
  const [value, setValue] = (0, _react.useState)(fn);
  const handler = (0, _react.useCallback)(function () {
    setValue(fn(...arguments));
  }, [fn]);
  // re-run when the emitter changes
  (0, _react.useEffect)(handler, [emitter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEventEmitter(emitter, eventName, handler);
  return value;
}
//# sourceMappingURL=useEventEmitter.js.map