"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _CommandProvider = _interopRequireDefault(require("./CommandProvider"));
var _RoomProvider = _interopRequireDefault(require("./RoomProvider"));
var _UserProvider = _interopRequireDefault(require("./UserProvider"));
var _EmojiProvider = _interopRequireDefault(require("./EmojiProvider"));
var _NotifProvider = _interopRequireDefault(require("./NotifProvider"));
var _promise = require("../utils/promise");
var _SpaceProvider = _interopRequireDefault(require("./SpaceProvider"));
var _RoomContext = require("../contexts/RoomContext");
var _arrays = require("../utils/arrays");
/*
Copyright 2016 Aviral Dasgupta
Copyright 2017, 2018 New Vector Ltd

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

const PROVIDERS = [_UserProvider.default, _RoomProvider.default, _EmojiProvider.default, _NotifProvider.default, _CommandProvider.default, _SpaceProvider.default];

// Providers will get rejected if they take longer than this.
const PROVIDER_COMPLETION_TIMEOUT = 3000;
class Autocompleter {
  constructor(room) {
    let renderingType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : _RoomContext.TimelineRenderingType.Room;
    (0, _defineProperty2.default)(this, "room", void 0);
    (0, _defineProperty2.default)(this, "providers", void 0);
    this.room = room;
    this.providers = PROVIDERS.map(Prov => {
      return new Prov(room, renderingType);
    });
  }
  destroy() {
    this.providers.forEach(p => {
      p.destroy();
    });
  }
  async getCompletions(query, selection) {
    let force = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    let limit = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : -1;
    /* Note: This intentionally waits for all providers to return,
     otherwise, we run into a condition where new completions are displayed
     while the user is interacting with the list, which makes it difficult
     to predict whether an action will actually do what is intended
    */
    // list of results from each provider, each being a list of completions or null if it times out
    const completionsList = await Promise.all(this.providers.map(async provider => {
      return (0, _promise.timeout)(provider.getCompletions(query, selection, force, limit), null, PROVIDER_COMPLETION_TIMEOUT);
    }));

    // map then filter to maintain the index for the map-operation, for this.providers to line up
    return (0, _arrays.filterBoolean)(completionsList.map((completions, i) => {
      if (!completions || !completions.length) return;
      return {
        completions,
        provider: this.providers[i],
        /* the currently matched "command" the completer tried to complete
         * we pass this through so that Autocomplete can figure out when to
         * re-show itself once hidden.
         */
        command: this.providers[i].getCurrentCommand(query, selection, force)
      };
    }));
  }
}
exports.default = Autocompleter;
//# sourceMappingURL=Autocompleter.js.map