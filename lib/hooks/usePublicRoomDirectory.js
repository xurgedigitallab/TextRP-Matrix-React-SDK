"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.usePublicRoomDirectory = exports.ALL_ROOMS = void 0;
var _react = require("react");
var _MatrixClientPeg = require("../MatrixClientPeg");
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _useLatestResult = require("./useLatestResult");
var _useSettings = require("./useSettings");
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

const ALL_ROOMS = "ALL_ROOMS";
exports.ALL_ROOMS = ALL_ROOMS;
const LAST_SERVER_KEY = "mx_last_room_directory_server";
const LAST_INSTANCE_KEY = "mx_last_room_directory_instance";
let thirdParty;
const NSFW_KEYWORD = "nsfw";
const cheapNsfwFilter = room => !room.name?.toLocaleLowerCase().includes(NSFW_KEYWORD) && !room.topic?.toLocaleLowerCase().includes(NSFW_KEYWORD);
const usePublicRoomDirectory = () => {
  const [publicRooms, setPublicRooms] = (0, _react.useState)([]);
  const [config, setConfigInternal] = (0, _react.useState)(undefined);
  const [protocols, setProtocols] = (0, _react.useState)(null);
  const [ready, setReady] = (0, _react.useState)(false);
  const [loading, setLoading] = (0, _react.useState)(false);
  const [updateQuery, updateResult] = (0, _useLatestResult.useLatestResult)(setPublicRooms);
  const showNsfwPublicRooms = (0, _useSettings.useSettingValue)("SpotlightSearch.showNsfwPublicRooms");
  async function initProtocols() {
    if (!_MatrixClientPeg.MatrixClientPeg.get()) {
      // We may not have a client yet when invoked from welcome page
      setReady(true);
    } else if (thirdParty) {
      setProtocols(thirdParty);
    } else {
      const response = await _MatrixClientPeg.MatrixClientPeg.get().getThirdpartyProtocols();
      thirdParty = response;
      setProtocols(response);
    }
  }
  function setConfig(config) {
    if (!ready) {
      throw new Error("public room configuration not initialised yet");
    } else {
      setConfigInternal(config);
    }
  }
  const search = (0, _react.useCallback)(async _ref => {
    let {
      limit = 20,
      query,
      roomTypes
    } = _ref;
    const opts = {
      limit
    };
    if (config?.roomServer != _MatrixClientPeg.MatrixClientPeg.getHomeserverName()) {
      opts.server = config?.roomServer;
    }
    if (config?.instanceId === ALL_ROOMS) {
      opts.include_all_networks = true;
    } else if (config?.instanceId) {
      opts.third_party_instance_id = config.instanceId;
    }
    if (query || roomTypes) {
      opts.filter = {
        generic_search_term: query,
        room_types: roomTypes && (await _MatrixClientPeg.MatrixClientPeg.get().doesServerSupportUnstableFeature("org.matrix.msc3827.stable")) ? Array.from(roomTypes) : undefined
      };
    }
    updateQuery(opts);
    try {
      setLoading(true);
      const {
        chunk
      } = await _MatrixClientPeg.MatrixClientPeg.get().publicRooms(opts);
      updateResult(opts, showNsfwPublicRooms ? chunk : chunk.filter(cheapNsfwFilter));
      return true;
    } catch (e) {
      console.error("Could not fetch public rooms for params", opts, e);
      updateResult(opts, []);
      return false;
    } finally {
      setLoading(false);
    }
  }, [config, updateQuery, updateResult, showNsfwPublicRooms]);
  (0, _react.useEffect)(() => {
    initProtocols();
  }, []);
  (0, _react.useEffect)(() => {
    if (protocols === null) {
      return;
    }
    const myHomeserver = _MatrixClientPeg.MatrixClientPeg.getHomeserverName();
    const lsRoomServer = localStorage.getItem(LAST_SERVER_KEY);
    const lsInstanceId = localStorage.getItem(LAST_INSTANCE_KEY) ?? undefined;
    let roomServer = myHomeserver;
    if (lsRoomServer && (_SdkConfig.default.getObject("room_directory")?.get("servers")?.includes(lsRoomServer) || _SettingsStore.default.getValue("room_directory_servers")?.includes(lsRoomServer))) {
      roomServer = lsRoomServer;
    }
    let instanceId = undefined;
    if (roomServer === myHomeserver && (lsInstanceId === ALL_ROOMS || Object.values(protocols).some(p => {
      p.instances.some(i => i.instance_id === lsInstanceId);
    }))) {
      instanceId = lsInstanceId;
    }
    setReady(true);
    setConfigInternal({
      roomServer,
      instanceId
    });
  }, [protocols]);
  (0, _react.useEffect)(() => {
    if (!config) return;
    localStorage.setItem(LAST_SERVER_KEY, config.roomServer);
    if (config.instanceId) {
      localStorage.setItem(LAST_INSTANCE_KEY, config.instanceId);
    } else {
      localStorage.removeItem(LAST_INSTANCE_KEY);
    }
  }, [config]);
  return {
    ready,
    loading,
    publicRooms,
    protocols,
    config,
    search,
    setConfig
  };
};
exports.usePublicRoomDirectory = usePublicRoomDirectory;
//# sourceMappingURL=usePublicRoomDirectory.js.map