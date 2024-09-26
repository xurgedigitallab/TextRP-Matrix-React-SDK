"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useUserOnboardingContext = useUserOnboardingContext;
var _logger = require("matrix-js-sdk/src/logger");
var _matrix = require("matrix-js-sdk/src/matrix");
var _react = require("react");
var _MatrixClientPeg = require("../MatrixClientPeg");
var _Notifier = require("../Notifier");
var _DMRoomMap = _interopRequireDefault(require("../utils/DMRoomMap"));
/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

const USER_ONBOARDING_CONTEXT_INTERVAL = 5000;

/**
 * Returns a persistent, non-changing reference to a function
 * This function proxies all its calls to the current value of the given input callback
 *
 * This allows you to use the current value of e.g., a state in a callback that’s used by e.g., a useEventEmitter or
 * similar hook without re-registering the hook when the state changes
 * @param value changing callback
 */
function useRefOf(value) {
  const ref = (0, _react.useRef)(value);
  ref.current = value;
  return (0, _react.useCallback)(function () {
    return ref.current(...arguments);
  }, []);
}
function useUserOnboardingContextValue(defaultValue, callback) {
  const [value, setValue] = (0, _react.useState)(defaultValue);
  const cli = _MatrixClientPeg.MatrixClientPeg.get();
  const handler = useRefOf(callback);
  (0, _react.useEffect)(() => {
    if (value) {
      return;
    }
    let handle = null;
    let enabled = true;
    const repeater = async () => {
      if (handle !== null) {
        clearTimeout(handle);
        handle = null;
      }
      setValue(await handler(cli));
      if (enabled) {
        handle = window.setTimeout(repeater, USER_ONBOARDING_CONTEXT_INTERVAL);
      }
    };
    repeater().catch(err => _logger.logger.warn("could not update user onboarding context", err));
    cli.on(_matrix.ClientEvent.AccountData, repeater);
    return () => {
      enabled = false;
      cli.off(_matrix.ClientEvent.AccountData, repeater);
      if (handle !== null) {
        clearTimeout(handle);
        handle = null;
      }
    };
  }, [cli, handler, value]);
  return value;
}
function useUserOnboardingContext() {
  const hasAvatar = useUserOnboardingContextValue(false, async cli => {
    const profile = await cli.getProfileInfo(cli.getUserId());
    return Boolean(profile?.avatar_url);
  });
  const hasDevices = useUserOnboardingContextValue(false, async cli => {
    const myDevice = cli.getDeviceId();
    const devices = await cli.getDevices();
    return Boolean(devices.devices.find(device => device.device_id !== myDevice));
  });
  const hasDmRooms = useUserOnboardingContextValue(false, async () => {
    const dmRooms = _DMRoomMap.default.shared().getUniqueRoomsWithIndividuals() ?? {};
    return Boolean(Object.keys(dmRooms).length);
  });
  const hasNotificationsEnabled = useUserOnboardingContextValue(false, async () => {
    return _Notifier.Notifier.isPossible();
  });
  return (0, _react.useMemo)(() => ({
    hasAvatar,
    hasDevices,
    hasDmRooms,
    hasNotificationsEnabled
  }), [hasAvatar, hasDevices, hasDmRooms, hasNotificationsEnabled]);
}
//# sourceMappingURL=useUserOnboardingContext.js.map