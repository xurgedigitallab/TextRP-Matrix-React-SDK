"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ProxiedModuleApi = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var Matrix = _interopRequireWildcard(require("matrix-js-sdk/src/matrix"));
var _Modal = _interopRequireDefault(require("../Modal"));
var _languageHandler = require("../languageHandler");
var _ModuleUiDialog = require("../components/views/dialogs/ModuleUiDialog");
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
var _PlatformPeg = _interopRequireDefault(require("../PlatformPeg"));
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _navigator = require("../utils/permalinks/navigator");
var _Permalinks = require("../utils/permalinks/Permalinks");
var _MatrixClientPeg = require("../MatrixClientPeg");
var _RoomAliasCache = require("../RoomAliasCache");
var _actions = require("../dispatcher/actions");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
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
/**
 * Glue between the `ModuleApi` interface and the react-sdk. Anticipates one instance
 * to be assigned to a single module.
 */
class ProxiedModuleApi {
  constructor() {
    (0, _defineProperty2.default)(this, "cachedTranslations", void 0);
    (0, _defineProperty2.default)(this, "overrideLoginResolve", void 0);
    (0, _defineProperty2.default)(this, "onAction", payload => {
      if (payload.action === _actions.Action.OnLoggedIn) {
        this.overrideLoginResolve?.();
      }
    });
    _dispatcher.default.register(this.onAction);
  }
  /**
   * All custom translations used by the associated module.
   */
  get translations() {
    return this.cachedTranslations;
  }

  /**
   * @override
   */
  registerTranslations(translations) {
    this.cachedTranslations = translations;
  }

  /**
   * @override
   */
  translateString(s, variables) {
    return (0, _languageHandler._t)(s, variables);
  }

  /**
   * @override
   */
  openDialog(title, body) {
    return new Promise(resolve => {
      _Modal.default.createDialog(_ModuleUiDialog.ModuleUiDialog, {
        title: title,
        contentFactory: body,
        contentProps: {
          moduleApi: this
        }
      }, "mx_CompoundDialog").finished.then(_ref => {
        let [didOkOrSubmit, model] = _ref;
        resolve({
          didOkOrSubmit: !!didOkOrSubmit,
          model: model
        });
      });
    });
  }

  /**
   * @override
   */
  async registerSimpleAccount(username, password, displayName) {
    const hsUrl = _SdkConfig.default.get("validated_server_config")?.hsUrl;
    if (!hsUrl) throw new Error("Could not get homeserver url");
    const client = Matrix.createClient({
      baseUrl: hsUrl
    });
    const deviceName = _SdkConfig.default.get("default_device_display_name") || _PlatformPeg.default.get()?.getDefaultDeviceDisplayName();
    const req = {
      username,
      password,
      initial_device_display_name: deviceName,
      auth: undefined,
      inhibit_login: false
    };
    const creds = await client.registerRequest(req).catch(resp => client.registerRequest(_objectSpread(_objectSpread({}, req), {}, {
      auth: {
        session: resp.data.session,
        type: "m.login.dummy"
      }
    })));
    if (displayName) {
      const profileClient = Matrix.createClient({
        baseUrl: hsUrl,
        userId: creds.user_id,
        deviceId: creds.device_id,
        accessToken: creds.access_token
      });
      await profileClient.setDisplayName(displayName);
    }
    return {
      homeserverUrl: hsUrl,
      userId: creds.user_id,
      deviceId: creds.device_id,
      accessToken: creds.access_token
    };
  }

  /**
   * @override
   */
  async overwriteAccountAuth(accountInfo) {
    _dispatcher.default.dispatch({
      action: _actions.Action.OverwriteLogin,
      credentials: _objectSpread(_objectSpread({}, accountInfo), {}, {
        guest: false
      })
    }, true); // require to be sync to match inherited interface behaviour

    // wait for login to complete
    await new Promise(resolve => {
      this.overrideLoginResolve = resolve;
    });
  }

  /**
   * @override
   */
  async navigatePermalink(uri, andJoin) {
    (0, _navigator.navigateToPermalink)(uri);
    const parts = (0, _Permalinks.parsePermalink)(uri);
    if (parts?.roomIdOrAlias && andJoin) {
      let roomId = parts.roomIdOrAlias;
      let servers = parts.viaServers;
      if (roomId.startsWith("#")) {
        roomId = (0, _RoomAliasCache.getCachedRoomIDForAlias)(parts.roomIdOrAlias);
        if (!roomId) {
          // alias resolution failed
          const result = await _MatrixClientPeg.MatrixClientPeg.get().getRoomIdForAlias(parts.roomIdOrAlias);
          roomId = result.room_id;
          if (!servers) servers = result.servers; // use provided servers first, if available
        }
      }

      _dispatcher.default.dispatch({
        action: _actions.Action.ViewRoom,
        room_id: roomId,
        via_servers: servers
      });
      if (andJoin) {
        _dispatcher.default.dispatch({
          action: _actions.Action.JoinRoom
        });
      }
    }
  }

  /**
   * @override
   */
  getConfigValue(namespace, key) {
    // Force cast to `any` because the namespace won't be known to the SdkConfig types
    const maybeObj = _SdkConfig.default.get(namespace);
    if (!maybeObj || !(typeof maybeObj === "object")) return undefined;
    return maybeObj[key];
  }
}
exports.ProxiedModuleApi = ProxiedModuleApi;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJNYXRyaXgiLCJfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZCIsInJlcXVpcmUiLCJfTW9kYWwiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX2xhbmd1YWdlSGFuZGxlciIsIl9Nb2R1bGVVaURpYWxvZyIsIl9TZGtDb25maWciLCJfUGxhdGZvcm1QZWciLCJfZGlzcGF0Y2hlciIsIl9uYXZpZ2F0b3IiLCJfUGVybWFsaW5rcyIsIl9NYXRyaXhDbGllbnRQZWciLCJfUm9vbUFsaWFzQ2FjaGUiLCJfYWN0aW9ucyIsIl9nZXRSZXF1aXJlV2lsZGNhcmRDYWNoZSIsIm5vZGVJbnRlcm9wIiwiV2Vha01hcCIsImNhY2hlQmFiZWxJbnRlcm9wIiwiY2FjaGVOb2RlSW50ZXJvcCIsIm9iaiIsIl9fZXNNb2R1bGUiLCJkZWZhdWx0IiwiY2FjaGUiLCJoYXMiLCJnZXQiLCJuZXdPYmoiLCJoYXNQcm9wZXJ0eURlc2NyaXB0b3IiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImdldE93blByb3BlcnR5RGVzY3JpcHRvciIsImtleSIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsImRlc2MiLCJzZXQiLCJvd25LZXlzIiwib2JqZWN0IiwiZW51bWVyYWJsZU9ubHkiLCJrZXlzIiwiZ2V0T3duUHJvcGVydHlTeW1ib2xzIiwic3ltYm9scyIsImZpbHRlciIsInN5bSIsImVudW1lcmFibGUiLCJwdXNoIiwiYXBwbHkiLCJfb2JqZWN0U3ByZWFkIiwidGFyZ2V0IiwiaSIsImFyZ3VtZW50cyIsImxlbmd0aCIsInNvdXJjZSIsImZvckVhY2giLCJfZGVmaW5lUHJvcGVydHkyIiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyIsImRlZmluZVByb3BlcnRpZXMiLCJQcm94aWVkTW9kdWxlQXBpIiwiY29uc3RydWN0b3IiLCJwYXlsb2FkIiwiYWN0aW9uIiwiQWN0aW9uIiwiT25Mb2dnZWRJbiIsIm92ZXJyaWRlTG9naW5SZXNvbHZlIiwiZGlzcGF0Y2hlciIsInJlZ2lzdGVyIiwib25BY3Rpb24iLCJ0cmFuc2xhdGlvbnMiLCJjYWNoZWRUcmFuc2xhdGlvbnMiLCJyZWdpc3RlclRyYW5zbGF0aW9ucyIsInRyYW5zbGF0ZVN0cmluZyIsInMiLCJ2YXJpYWJsZXMiLCJfdCIsIm9wZW5EaWFsb2ciLCJ0aXRsZSIsImJvZHkiLCJQcm9taXNlIiwicmVzb2x2ZSIsIk1vZGFsIiwiY3JlYXRlRGlhbG9nIiwiTW9kdWxlVWlEaWFsb2ciLCJjb250ZW50RmFjdG9yeSIsImNvbnRlbnRQcm9wcyIsIm1vZHVsZUFwaSIsImZpbmlzaGVkIiwidGhlbiIsIl9yZWYiLCJkaWRPa09yU3VibWl0IiwibW9kZWwiLCJyZWdpc3RlclNpbXBsZUFjY291bnQiLCJ1c2VybmFtZSIsInBhc3N3b3JkIiwiZGlzcGxheU5hbWUiLCJoc1VybCIsIlNka0NvbmZpZyIsIkVycm9yIiwiY2xpZW50IiwiY3JlYXRlQ2xpZW50IiwiYmFzZVVybCIsImRldmljZU5hbWUiLCJQbGF0Zm9ybVBlZyIsImdldERlZmF1bHREZXZpY2VEaXNwbGF5TmFtZSIsInJlcSIsImluaXRpYWxfZGV2aWNlX2Rpc3BsYXlfbmFtZSIsImF1dGgiLCJ1bmRlZmluZWQiLCJpbmhpYml0X2xvZ2luIiwiY3JlZHMiLCJyZWdpc3RlclJlcXVlc3QiLCJjYXRjaCIsInJlc3AiLCJzZXNzaW9uIiwiZGF0YSIsInR5cGUiLCJwcm9maWxlQ2xpZW50IiwidXNlcklkIiwidXNlcl9pZCIsImRldmljZUlkIiwiZGV2aWNlX2lkIiwiYWNjZXNzVG9rZW4iLCJhY2Nlc3NfdG9rZW4iLCJzZXREaXNwbGF5TmFtZSIsImhvbWVzZXJ2ZXJVcmwiLCJvdmVyd3JpdGVBY2NvdW50QXV0aCIsImFjY291bnRJbmZvIiwiZGlzcGF0Y2giLCJPdmVyd3JpdGVMb2dpbiIsImNyZWRlbnRpYWxzIiwiZ3Vlc3QiLCJuYXZpZ2F0ZVBlcm1hbGluayIsInVyaSIsImFuZEpvaW4iLCJuYXZpZ2F0ZVRvUGVybWFsaW5rIiwicGFydHMiLCJwYXJzZVBlcm1hbGluayIsInJvb21JZE9yQWxpYXMiLCJyb29tSWQiLCJzZXJ2ZXJzIiwidmlhU2VydmVycyIsInN0YXJ0c1dpdGgiLCJnZXRDYWNoZWRSb29tSURGb3JBbGlhcyIsInJlc3VsdCIsIk1hdHJpeENsaWVudFBlZyIsImdldFJvb21JZEZvckFsaWFzIiwicm9vbV9pZCIsIlZpZXdSb29tIiwidmlhX3NlcnZlcnMiLCJKb2luUm9vbSIsImdldENvbmZpZ1ZhbHVlIiwibmFtZXNwYWNlIiwibWF5YmVPYmoiLCJleHBvcnRzIl0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL21vZHVsZXMvUHJveGllZE1vZHVsZUFwaS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMjIgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5pbXBvcnQgeyBNb2R1bGVBcGkgfSBmcm9tIFwiQG1hdHJpeC1vcmcvcmVhY3Qtc2RrLW1vZHVsZS1hcGkvbGliL01vZHVsZUFwaVwiO1xuaW1wb3J0IHsgVHJhbnNsYXRpb25TdHJpbmdzT2JqZWN0IH0gZnJvbSBcIkBtYXRyaXgtb3JnL3JlYWN0LXNkay1tb2R1bGUtYXBpL2xpYi90eXBlcy90cmFuc2xhdGlvbnNcIjtcbmltcG9ydCB7IE9wdGlvbmFsIH0gZnJvbSBcIm1hdHJpeC1ldmVudHMtc2RrXCI7XG5pbXBvcnQgeyBEaWFsb2dQcm9wcyB9IGZyb20gXCJAbWF0cml4LW9yZy9yZWFjdC1zZGstbW9kdWxlLWFwaS9saWIvY29tcG9uZW50cy9EaWFsb2dDb250ZW50XCI7XG5pbXBvcnQgUmVhY3QgZnJvbSBcInJlYWN0XCI7XG5pbXBvcnQgeyBBY2NvdW50QXV0aEluZm8gfSBmcm9tIFwiQG1hdHJpeC1vcmcvcmVhY3Qtc2RrLW1vZHVsZS1hcGkvbGliL3R5cGVzL0FjY291bnRBdXRoSW5mb1wiO1xuaW1wb3J0IHsgUGxhaW5TdWJzdGl0dXRpb24gfSBmcm9tIFwiQG1hdHJpeC1vcmcvcmVhY3Qtc2RrLW1vZHVsZS1hcGkvbGliL3R5cGVzL3RyYW5zbGF0aW9uc1wiO1xuaW1wb3J0ICogYXMgTWF0cml4IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tYXRyaXhcIjtcbmltcG9ydCB7IElSZWdpc3RlclJlcXVlc3RQYXJhbXMgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbWF0cml4XCI7XG5cbmltcG9ydCBNb2RhbCBmcm9tIFwiLi4vTW9kYWxcIjtcbmltcG9ydCB7IF90IH0gZnJvbSBcIi4uL2xhbmd1YWdlSGFuZGxlclwiO1xuaW1wb3J0IHsgTW9kdWxlVWlEaWFsb2cgfSBmcm9tIFwiLi4vY29tcG9uZW50cy92aWV3cy9kaWFsb2dzL01vZHVsZVVpRGlhbG9nXCI7XG5pbXBvcnQgU2RrQ29uZmlnIGZyb20gXCIuLi9TZGtDb25maWdcIjtcbmltcG9ydCBQbGF0Zm9ybVBlZyBmcm9tIFwiLi4vUGxhdGZvcm1QZWdcIjtcbmltcG9ydCBkaXNwYXRjaGVyIGZyb20gXCIuLi9kaXNwYXRjaGVyL2Rpc3BhdGNoZXJcIjtcbmltcG9ydCB7IG5hdmlnYXRlVG9QZXJtYWxpbmsgfSBmcm9tIFwiLi4vdXRpbHMvcGVybWFsaW5rcy9uYXZpZ2F0b3JcIjtcbmltcG9ydCB7IHBhcnNlUGVybWFsaW5rIH0gZnJvbSBcIi4uL3V0aWxzL3Blcm1hbGlua3MvUGVybWFsaW5rc1wiO1xuaW1wb3J0IHsgTWF0cml4Q2xpZW50UGVnIH0gZnJvbSBcIi4uL01hdHJpeENsaWVudFBlZ1wiO1xuaW1wb3J0IHsgZ2V0Q2FjaGVkUm9vbUlERm9yQWxpYXMgfSBmcm9tIFwiLi4vUm9vbUFsaWFzQ2FjaGVcIjtcbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gXCIuLi9kaXNwYXRjaGVyL2FjdGlvbnNcIjtcbmltcG9ydCB7IE92ZXJ3cml0ZUxvZ2luUGF5bG9hZCB9IGZyb20gXCIuLi9kaXNwYXRjaGVyL3BheWxvYWRzL092ZXJ3cml0ZUxvZ2luUGF5bG9hZFwiO1xuaW1wb3J0IHsgQWN0aW9uUGF5bG9hZCB9IGZyb20gXCIuLi9kaXNwYXRjaGVyL3BheWxvYWRzXCI7XG5cbi8qKlxuICogR2x1ZSBiZXR3ZWVuIHRoZSBgTW9kdWxlQXBpYCBpbnRlcmZhY2UgYW5kIHRoZSByZWFjdC1zZGsuIEFudGljaXBhdGVzIG9uZSBpbnN0YW5jZVxuICogdG8gYmUgYXNzaWduZWQgdG8gYSBzaW5nbGUgbW9kdWxlLlxuICovXG5leHBvcnQgY2xhc3MgUHJveGllZE1vZHVsZUFwaSBpbXBsZW1lbnRzIE1vZHVsZUFwaSB7XG4gICAgcHJpdmF0ZSBjYWNoZWRUcmFuc2xhdGlvbnM6IE9wdGlvbmFsPFRyYW5zbGF0aW9uU3RyaW5nc09iamVjdD47XG5cbiAgICBwcml2YXRlIG92ZXJyaWRlTG9naW5SZXNvbHZlPzogKCkgPT4gdm9pZDtcblxuICAgIHB1YmxpYyBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgZGlzcGF0Y2hlci5yZWdpc3Rlcih0aGlzLm9uQWN0aW9uKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uQWN0aW9uID0gKHBheWxvYWQ6IEFjdGlvblBheWxvYWQpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKHBheWxvYWQuYWN0aW9uID09PSBBY3Rpb24uT25Mb2dnZWRJbikge1xuICAgICAgICAgICAgdGhpcy5vdmVycmlkZUxvZ2luUmVzb2x2ZT8uKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQWxsIGN1c3RvbSB0cmFuc2xhdGlvbnMgdXNlZCBieSB0aGUgYXNzb2NpYXRlZCBtb2R1bGUuXG4gICAgICovXG4gICAgcHVibGljIGdldCB0cmFuc2xhdGlvbnMoKTogT3B0aW9uYWw8VHJhbnNsYXRpb25TdHJpbmdzT2JqZWN0PiB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhY2hlZFRyYW5zbGF0aW9ucztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAb3ZlcnJpZGVcbiAgICAgKi9cbiAgICBwdWJsaWMgcmVnaXN0ZXJUcmFuc2xhdGlvbnModHJhbnNsYXRpb25zOiBUcmFuc2xhdGlvblN0cmluZ3NPYmplY3QpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5jYWNoZWRUcmFuc2xhdGlvbnMgPSB0cmFuc2xhdGlvbnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG92ZXJyaWRlXG4gICAgICovXG4gICAgcHVibGljIHRyYW5zbGF0ZVN0cmluZyhzOiBzdHJpbmcsIHZhcmlhYmxlcz86IFJlY29yZDxzdHJpbmcsIFBsYWluU3Vic3RpdHV0aW9uPik6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBfdChzLCB2YXJpYWJsZXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBvdmVycmlkZVxuICAgICAqL1xuICAgIHB1YmxpYyBvcGVuRGlhbG9nPFxuICAgICAgICBNIGV4dGVuZHMgb2JqZWN0LFxuICAgICAgICBQIGV4dGVuZHMgRGlhbG9nUHJvcHMgPSBEaWFsb2dQcm9wcyxcbiAgICAgICAgQyBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCA9IFJlYWN0LkNvbXBvbmVudCxcbiAgICA+KFxuICAgICAgICB0aXRsZTogc3RyaW5nLFxuICAgICAgICBib2R5OiAocHJvcHM6IFAsIHJlZjogUmVhY3QuUmVmT2JqZWN0PEM+KSA9PiBSZWFjdC5SZWFjdE5vZGUsXG4gICAgKTogUHJvbWlzZTx7IGRpZE9rT3JTdWJtaXQ6IGJvb2xlYW47IG1vZGVsOiBNIH0+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgZGlkT2tPclN1Ym1pdDogYm9vbGVhbjsgbW9kZWw6IE0gfT4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIE1vZGFsLmNyZWF0ZURpYWxvZyhcbiAgICAgICAgICAgICAgICBNb2R1bGVVaURpYWxvZyxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiB0aXRsZSxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudEZhY3Rvcnk6IGJvZHksXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRQcm9wczogPERpYWxvZ1Byb3BzPntcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZHVsZUFwaTogdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIFwibXhfQ29tcG91bmREaWFsb2dcIixcbiAgICAgICAgICAgICkuZmluaXNoZWQudGhlbigoW2RpZE9rT3JTdWJtaXQsIG1vZGVsXSkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoeyBkaWRPa09yU3VibWl0OiAhIWRpZE9rT3JTdWJtaXQsIG1vZGVsOiBtb2RlbCBhcyBNIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBvdmVycmlkZVxuICAgICAqL1xuICAgIHB1YmxpYyBhc3luYyByZWdpc3RlclNpbXBsZUFjY291bnQoXG4gICAgICAgIHVzZXJuYW1lOiBzdHJpbmcsXG4gICAgICAgIHBhc3N3b3JkOiBzdHJpbmcsXG4gICAgICAgIGRpc3BsYXlOYW1lPzogc3RyaW5nLFxuICAgICk6IFByb21pc2U8QWNjb3VudEF1dGhJbmZvPiB7XG4gICAgICAgIGNvbnN0IGhzVXJsID0gU2RrQ29uZmlnLmdldChcInZhbGlkYXRlZF9zZXJ2ZXJfY29uZmlnXCIpPy5oc1VybDtcbiAgICAgICAgaWYgKCFoc1VybCkgdGhyb3cgbmV3IEVycm9yKFwiQ291bGQgbm90IGdldCBob21lc2VydmVyIHVybFwiKTtcbiAgICAgICAgY29uc3QgY2xpZW50ID0gTWF0cml4LmNyZWF0ZUNsaWVudCh7IGJhc2VVcmw6IGhzVXJsIH0pO1xuICAgICAgICBjb25zdCBkZXZpY2VOYW1lID1cbiAgICAgICAgICAgIFNka0NvbmZpZy5nZXQoXCJkZWZhdWx0X2RldmljZV9kaXNwbGF5X25hbWVcIikgfHwgUGxhdGZvcm1QZWcuZ2V0KCk/LmdldERlZmF1bHREZXZpY2VEaXNwbGF5TmFtZSgpO1xuICAgICAgICBjb25zdCByZXE6IElSZWdpc3RlclJlcXVlc3RQYXJhbXMgPSB7XG4gICAgICAgICAgICB1c2VybmFtZSxcbiAgICAgICAgICAgIHBhc3N3b3JkLFxuICAgICAgICAgICAgaW5pdGlhbF9kZXZpY2VfZGlzcGxheV9uYW1lOiBkZXZpY2VOYW1lLFxuICAgICAgICAgICAgYXV0aDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgaW5oaWJpdF9sb2dpbjogZmFsc2UsXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGNyZWRzID0gYXdhaXQgY2xpZW50LnJlZ2lzdGVyUmVxdWVzdChyZXEpLmNhdGNoKChyZXNwKSA9PlxuICAgICAgICAgICAgY2xpZW50LnJlZ2lzdGVyUmVxdWVzdCh7XG4gICAgICAgICAgICAgICAgLi4ucmVxLFxuICAgICAgICAgICAgICAgIGF1dGg6IHtcbiAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbjogcmVzcC5kYXRhLnNlc3Npb24sXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFwibS5sb2dpbi5kdW1teVwiLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoZGlzcGxheU5hbWUpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb2ZpbGVDbGllbnQgPSBNYXRyaXguY3JlYXRlQ2xpZW50KHtcbiAgICAgICAgICAgICAgICBiYXNlVXJsOiBoc1VybCxcbiAgICAgICAgICAgICAgICB1c2VySWQ6IGNyZWRzLnVzZXJfaWQsXG4gICAgICAgICAgICAgICAgZGV2aWNlSWQ6IGNyZWRzLmRldmljZV9pZCxcbiAgICAgICAgICAgICAgICBhY2Nlc3NUb2tlbjogY3JlZHMuYWNjZXNzX3Rva2VuLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBhd2FpdCBwcm9maWxlQ2xpZW50LnNldERpc3BsYXlOYW1lKGRpc3BsYXlOYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBob21lc2VydmVyVXJsOiBoc1VybCxcbiAgICAgICAgICAgIHVzZXJJZDogY3JlZHMudXNlcl9pZCEsXG4gICAgICAgICAgICBkZXZpY2VJZDogY3JlZHMuZGV2aWNlX2lkISxcbiAgICAgICAgICAgIGFjY2Vzc1Rva2VuOiBjcmVkcy5hY2Nlc3NfdG9rZW4hLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBvdmVycmlkZVxuICAgICAqL1xuICAgIHB1YmxpYyBhc3luYyBvdmVyd3JpdGVBY2NvdW50QXV0aChhY2NvdW50SW5mbzogQWNjb3VudEF1dGhJbmZvKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGRpc3BhdGNoZXIuZGlzcGF0Y2g8T3ZlcndyaXRlTG9naW5QYXlsb2FkPihcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBhY3Rpb246IEFjdGlvbi5PdmVyd3JpdGVMb2dpbixcbiAgICAgICAgICAgICAgICBjcmVkZW50aWFsczoge1xuICAgICAgICAgICAgICAgICAgICAuLi5hY2NvdW50SW5mbyxcbiAgICAgICAgICAgICAgICAgICAgZ3Vlc3Q6IGZhbHNlLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTsgLy8gcmVxdWlyZSB0byBiZSBzeW5jIHRvIG1hdGNoIGluaGVyaXRlZCBpbnRlcmZhY2UgYmVoYXZpb3VyXG5cbiAgICAgICAgLy8gd2FpdCBmb3IgbG9naW4gdG8gY29tcGxldGVcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIHRoaXMub3ZlcnJpZGVMb2dpblJlc29sdmUgPSByZXNvbHZlO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAb3ZlcnJpZGVcbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgbmF2aWdhdGVQZXJtYWxpbmsodXJpOiBzdHJpbmcsIGFuZEpvaW4/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIG5hdmlnYXRlVG9QZXJtYWxpbmsodXJpKTtcblxuICAgICAgICBjb25zdCBwYXJ0cyA9IHBhcnNlUGVybWFsaW5rKHVyaSk7XG4gICAgICAgIGlmIChwYXJ0cz8ucm9vbUlkT3JBbGlhcyAmJiBhbmRKb2luKSB7XG4gICAgICAgICAgICBsZXQgcm9vbUlkOiBzdHJpbmcgfCB1bmRlZmluZWQgPSBwYXJ0cy5yb29tSWRPckFsaWFzO1xuICAgICAgICAgICAgbGV0IHNlcnZlcnMgPSBwYXJ0cy52aWFTZXJ2ZXJzO1xuICAgICAgICAgICAgaWYgKHJvb21JZC5zdGFydHNXaXRoKFwiI1wiKSkge1xuICAgICAgICAgICAgICAgIHJvb21JZCA9IGdldENhY2hlZFJvb21JREZvckFsaWFzKHBhcnRzLnJvb21JZE9yQWxpYXMpO1xuICAgICAgICAgICAgICAgIGlmICghcm9vbUlkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGFsaWFzIHJlc29sdXRpb24gZmFpbGVkXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IE1hdHJpeENsaWVudFBlZy5nZXQoKS5nZXRSb29tSWRGb3JBbGlhcyhwYXJ0cy5yb29tSWRPckFsaWFzKTtcbiAgICAgICAgICAgICAgICAgICAgcm9vbUlkID0gcmVzdWx0LnJvb21faWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmICghc2VydmVycykgc2VydmVycyA9IHJlc3VsdC5zZXJ2ZXJzOyAvLyB1c2UgcHJvdmlkZWQgc2VydmVycyBmaXJzdCwgaWYgYXZhaWxhYmxlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGlzcGF0Y2hlci5kaXNwYXRjaCh7XG4gICAgICAgICAgICAgICAgYWN0aW9uOiBBY3Rpb24uVmlld1Jvb20sXG4gICAgICAgICAgICAgICAgcm9vbV9pZDogcm9vbUlkLFxuICAgICAgICAgICAgICAgIHZpYV9zZXJ2ZXJzOiBzZXJ2ZXJzLFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmIChhbmRKb2luKSB7XG4gICAgICAgICAgICAgICAgZGlzcGF0Y2hlci5kaXNwYXRjaCh7XG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbjogQWN0aW9uLkpvaW5Sb29tLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG92ZXJyaWRlXG4gICAgICovXG4gICAgcHVibGljIGdldENvbmZpZ1ZhbHVlPFQ+KG5hbWVzcGFjZTogc3RyaW5nLCBrZXk6IHN0cmluZyk6IFQgfCB1bmRlZmluZWQge1xuICAgICAgICAvLyBGb3JjZSBjYXN0IHRvIGBhbnlgIGJlY2F1c2UgdGhlIG5hbWVzcGFjZSB3b24ndCBiZSBrbm93biB0byB0aGUgU2RrQ29uZmlnIHR5cGVzXG4gICAgICAgIGNvbnN0IG1heWJlT2JqID0gU2RrQ29uZmlnLmdldChuYW1lc3BhY2UgYXMgYW55KTtcbiAgICAgICAgaWYgKCFtYXliZU9iaiB8fCAhKHR5cGVvZiBtYXliZU9iaiA9PT0gXCJvYmplY3RcIikpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIHJldHVybiBtYXliZU9ialtrZXldO1xuICAgIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUF1QkEsSUFBQUEsTUFBQSxHQUFBQyx1QkFBQSxDQUFBQyxPQUFBO0FBR0EsSUFBQUMsTUFBQSxHQUFBQyxzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQUcsZ0JBQUEsR0FBQUgsT0FBQTtBQUNBLElBQUFJLGVBQUEsR0FBQUosT0FBQTtBQUNBLElBQUFLLFVBQUEsR0FBQUgsc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFNLFlBQUEsR0FBQUosc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFPLFdBQUEsR0FBQUwsc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFRLFVBQUEsR0FBQVIsT0FBQTtBQUNBLElBQUFTLFdBQUEsR0FBQVQsT0FBQTtBQUNBLElBQUFVLGdCQUFBLEdBQUFWLE9BQUE7QUFDQSxJQUFBVyxlQUFBLEdBQUFYLE9BQUE7QUFDQSxJQUFBWSxRQUFBLEdBQUFaLE9BQUE7QUFBK0MsU0FBQWEseUJBQUFDLFdBQUEsZUFBQUMsT0FBQSxrQ0FBQUMsaUJBQUEsT0FBQUQsT0FBQSxRQUFBRSxnQkFBQSxPQUFBRixPQUFBLFlBQUFGLHdCQUFBLFlBQUFBLENBQUFDLFdBQUEsV0FBQUEsV0FBQSxHQUFBRyxnQkFBQSxHQUFBRCxpQkFBQSxLQUFBRixXQUFBO0FBQUEsU0FBQWYsd0JBQUFtQixHQUFBLEVBQUFKLFdBQUEsU0FBQUEsV0FBQSxJQUFBSSxHQUFBLElBQUFBLEdBQUEsQ0FBQUMsVUFBQSxXQUFBRCxHQUFBLFFBQUFBLEdBQUEsb0JBQUFBLEdBQUEsd0JBQUFBLEdBQUEsNEJBQUFFLE9BQUEsRUFBQUYsR0FBQSxVQUFBRyxLQUFBLEdBQUFSLHdCQUFBLENBQUFDLFdBQUEsT0FBQU8sS0FBQSxJQUFB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